# OpenCode 官方 DeepSeek 实测入口

`run_opencode.py` 是组织者侧控制器，固定使用 `opencode-go/deepseek-v4.1-flash`。候选模型只取得当前题的容器工具；不要在原仓库里直接运行 OpenCode 解题。

## 运行

先按主 README 建好镜像并完成当前套件的 Docker 校准。宿主需已安装 OpenCode CLI、Docker 和 Python，官方提供商凭据位于 `~/.local/share/opencode/auth.json` 的 `opencode-go` 项。

```sh
python3 benchmarks/deep-student/run_opencode.py \
  --opencode /Applications/OpenChamber.app/Contents/Resources/opencode-cli/opencode \
  --output tmp/ds-deepseek-v41-run-001 \
  --workers 2 --minutes 60
```

`--opencode` 改成实际 CLI 的绝对路径。本入口已在 OpenCode **v2.0.16** 验证，使用其原生插件及 MCP 配置，不能直接当作 v1 兼容入口。输出目录必须是新路径，且处于 Docker 可共享的目录中。本机 Colima 使用项目已忽略的 `tmp/`。可用 `--tasks DS-F01,DS-B01` 做独立的小样本试验；汇总主分母仍是 34，不把子集通过率冒充全套成绩。

一次运行中，每题恰好新建一个会话。不会在失败后挑选重试最优解，也不会把隐藏测试反馈给候选模型。全体候选结束后，才在新容器内进行机器判分。

## 执行边界

- 每题独立 HOME、XDG 配置/缓存/状态目录和空宿主工作目录，不继承项目历史、全局 AGENTS 或技能。
- OpenCode 原生宿主工具全部拒绝，仅开放 `bench_shell`。工具参数只有容器内命令、说明和超时；容器身份由组织者固定，模型不能选择宿主命令或挂载。
- `opencode-plugin` 在发题前等待 `bench_shell` 真正进入工具注册表。v2.0.16 实测存在 MCP 已连接、首次请求却尚未带工具的启动竞态；只等连接完成不够。本插件按实际注册状态等待，20 秒仍未就绪即报基础设施错误，不推迟或改写模型的判断。
- MCP 服务以固定 Docker CLI 和已核实的容器 ID 执行命令。容器无网络，密钥仅供宿主模型客户端使用，不传入容器。
- 单次命令可用 1–600 秒超时，默认 120 秒；GNU `timeout --signal=KILL` 在容器内终止该命令进程组。整题墙钟预算结束时，控制器停止容器并结束客户端。
- 不按关键词、工具调用次数或答案相似度拦截候选。输出较长时有明确截断提示，完整字节保留供组织者复核。
- 停止容器后用套件的 `collect` 收卷；机器判分由原 `grade` 执行器完成，不信任模型自报成功。

## 输出

- `run.json`：版本、模型、预算、时间及控制器异常。
- `attempts/<题号>/events.jsonl`：OpenCode 原始 JSON 事件。
- `attempts/<题号>/attempt.json`：退出状态、实际耗时、会话和原生用量记录。
- `attempts/<题号>/tools/`：每次容器命令的输入、退出码和完整输出。
- `attempts/<题号>/tools-sent.jsonl`：实际模型请求的工具名称记录，不含请求头、密钥或提示正文。
- `submissions/`：采集到的补丁和诊断说明。
- `grades/`：独立机器结果、测试日志和 `review-request.json` 二轮复核入口。
- `summary.json`：严格全套解题率及分类成绩。

OpenCode 的 CLI JSON 事件可能不含 token 统计。`opencode_metrics.py` 因此只读查询该题私有数据库中的会话和 assistant 消息记录；不导出数据库，也不读取凭据表。会话总用量可能含标题等辅助调用，消息用量另行保留。成本是客户端估算，不能解释为官方订阅的实际账单。

候选侧工具链必须先用不计分的 toy 验证：模型应实际写入文件并运行命令，只有文字声称调用工具不算联调通过。任何工具链联调都应与正式 pass@1 题目分开保存。
