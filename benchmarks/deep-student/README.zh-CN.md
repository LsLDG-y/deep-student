# DeepStudent Debug Bench

从 **2026-06-28 至 2026-09-28** 的 872 次可达提交中整理的项目专属 Debug/Coding 评测集。当前包含 **34 道题、28 个不同的历史 fix commit**，统一锚定 `d6534ff2715e59c4c2c3e6c7bec5f6554576ce68`（0.9.72）。

它是一套**历史缺陷回移评测**：保留当前工程环境，逐题移植已证实的旧行为。它不是 34 个历史版本的原样 checkout，也不是 34 个独立事故。每次任务只有一个缺陷切片，参考修复大多为小改动，最大切片 201 行；不包含大型工程重构。

| 初始难度 | 题数 | 主要考察 |
|---|---:|---|
| 1 | 2 | 定位清晰的协议/数据契约 |
| 2 | 11 | 边界条件、跨平台输入、编辑与呈现 |
| 3 | 18 | 跨模块因果链、故障组合、生命周期与状态归属 |
| 4 | 3 | 并发 ABA、窗口补载和历史数据迁移 |

难度是策划分档，尚未经过多模型实测标定。机器覆盖包括 25 道 TypeScript/React 题、8 道 Rust 题和 1 道真实 SQLite 迁移题。测试调用生产实现；React/IPC 边界使用测试替身，**不把这些结果描述为完整 Tauri 桌面、Android 或云服务 E2E 验证**。

## 先区分两份材料

- **组织者保留本目录与原始仓库**：这里包含隐藏测试、缺陷补丁、历史出处和判分程序，不能交给受测 Agent。
- **受测 Agent 只拿 `prepare`/`sandbox` 输出的工作区和 `TASK.md`**：有工程源码、普通测试工具与一个新的起始 Git 提交，没有原始历史、答案文档或隐藏用例。

在当前原仓库中直接让 Agent 解题，只能算开发自测。若 Agent 还能读本机其它目录、原始仓库或联网搜索历史，无法得到受控评测结果。正式测试应使用下述独立容器，由外部控制器只向 Agent 暴露该容器的文件/命令工具；模型 API 调用放在控制器侧。

## 快速开始

以下命令从项目根目录执行。组织者宿主需 Python 3.12+、Node/npm、Rust/Cargo、可工作的 Docker；依赖准备允许联网，解题与判分均可离线。首次构建需要下载依赖和工具链，后续复用镜像。

```sh
# 查看环境和题目
python3 benchmarks/deep-student/bench.py doctor
python3 benchmarks/deep-student/bench.py list

# Apple Silicon / Linux ARM64；x86_64 主机改为 --architecture amd64
python3 benchmarks/deep-student/build_image.py --architecture arm64

# 新机器、新架构或调整了任务时，先做空解与参考解校准
python3 benchmarks/deep-student/bench.py calibrate all \
  --output /tmp/ds-bench-calibration

# 给一个 Agent 开一题。命令返回独立容器名与 TASK.md 位置。
python3 benchmarks/deep-student/bench.py sandbox DS-F12 \
  --output /tmp/ds-trial-F12
```

将输出中的容器名填入后，外部 Agent 控制器只使用这样的工具入口：

```sh
python3 benchmarks/deep-student/bench.py exec CONTAINER_NAME -- sh -lc 'cat TASK.md'
python3 benchmarks/deep-student/bench.py exec CONTAINER_NAME -- sh -lc 'rg "关键线索" src src-tauri/src'
```

Agent 可以读取、修改工作区源码，编写并运行自己的测试，提交 Git commit。无需保持工作区未提交；`collect` 与组织者重建的起始源码比较，不信任 Agent 可修改的 Git 标签或 HEAD。Agent 的最终说明写到 `DIAGNOSIS.md`。

```sh
# Agent 交卷后，先停止其容器，再从组织者侧采集
docker stop CONTAINER_NAME
python3 benchmarks/deep-student/bench.py collect DS-F12 \
  --workspace /tmp/ds-trial-F12 \
  --output /tmp/ds-submissions/DS-F12.patch

# 单题在新容器里判分
python3 benchmarks/deep-student/bench.py grade DS-F12 \
  --patch /tmp/ds-submissions/DS-F12.patch \
  --output /tmp/ds-results/DS-F12

# 全套交卷：文件名必须是 DS-B01.patch、DS-D01.patch 等题号
python3 benchmarks/deep-student/bench.py grade-set \
  --patch-dir /tmp/ds-submissions \
  --output /tmp/ds-full-run
```

`grade-set` 输出 `summary.json`，每题输出 `result.json`、原始测试结果/日志、提交补丁和 `review-request.json`。所有输出路径必须是新路径，已有工作不会被整批覆盖或清理。临时与校准材料保留在 `/tmp`，由组织者另行管理。

仅需要导出文件时可运行 `prepare DS-F12 --output /tmp/ds-task-F12`；导出目录本身不提供宿主隔离。维护者可信本地调试可在 `calibrate`/`grade` 上使用 `--engine local`，结果会标记 `development_not_isolated`。不要用该模式执行不可信补丁。

## 机器分怎么算

**主分 = 100 × 完全解出的题数 / 34。每题等权。**

一个任务必须同时满足：

1. 所有 `FAIL_TO_PASS` 用例从缺陷态失败变为通过；
2. 所有 `PASS_TO_PASS` 正常行为继续通过；
3. 预期测试清单完整、无跳过、无丢失、无额外伪造结果，测试进程成功退出。

缺失提交、补丁不合法、运行失败、跳过测试、只修好一部分或引入回归，该题均为 0。F2P/P2P 的细分通过情况仍保留，用于诊断。未提交题保留在总分母里，不能通过只提交简单题刷高主分；重复题号结果不会自动挑最高分。

报告同时按难度、缺陷类型与家族分组。共享模块/同源提交的题不能视为统计独立样本。比较 Agent 时固定题集版本、预算、模型设置、工具权限与冷启动会话；首次独立尝试报告 pass@1。多次尝试需要分别报告，不能只挑最好结果。建议统一每题 60 分钟，token 与实际耗时由外部控制器记录，本程序不伪造这些指标。

机器解题率是“定位并修复工程缺陷”的可执行指标，**不是对思考质量的直接量化**。不通过文件名命中、关键词或与标准答案文本相似度给洞察力打分。`DIAGNOSIS.md`、补丁、复现说明和原始机器结果交给第二轮复核，判断因果链、影响范围、是否硬编码与任务边界。

## 校准与发布前验证

`calibrate` 在每题的两个独立源码目录中分别执行缺陷态和正常锚点态，精确比较用例名字与状态。只有“至少一个 F2P、至少一个 P2P、参考态全绿、没有套件错误”的题才会写入有效 calibration。缺陷态失败必须发生在实际行为用例中，编译失败或没有执行测试不能代替缺陷复现。

维护者可以验证整个补丁提交流程：

```sh
python3 benchmarks/deep-student/bench.py reference-patch DS-F10 \
  --output /tmp/DS-F10-reference.patch
python3 benchmarks/deep-student/bench.py grade DS-F10 \
  --patch /tmp/DS-F10-reference.patch \
  --output /tmp/DS-F10-reference-result
```

`reference-patch` 是组织者工具，不能开放给受测 Agent。空 patch 应为 0，参考 patch 应为 100；其余修复不要求与参考 diff 一致。

修改题面、测试、缺陷补丁或执行器后，应递增套件版本并重新校准。不要在正式尝试中把隐藏用例日志回传给同一个 Agent 迭代修复；否则那是有反馈的开发测试，应另报。

## 防作弊与边界

已实现的边界：

- 公开目录从固定 Git 对象重建，不复制宿主工作区、真实数据、原 Git 历史、审阅文档或 AGENTS 修复记忆。
- 删除现有测试文件、Rust 内联测试及逐题明确列出的答案性注释；保留正常类型、接口和生产实现。
- 解题容器只挂该题工作区，不挂原仓库、维护者材料、用户 HOME、Docker socket 或凭据；使用普通用户、只读根文件系统、无网络、CPU/内存/进程数上限。
- 判分在新的源码目录与新容器中执行，只接受生产源码/迁移差异；依赖、配置、测试、符号链接、子模块与越界路径不接受。
- 隐藏测试及配置来自组织者侧；不会使用 Agent 自报的“测试通过”或其工作区中的测试结果。

这些措施限制历史检索、测试篡改、环境持久化和主机越界，**不保证对任意恶意程序的绝对抗作弊**。尤其 JS 生产代码与 Vitest 同进程，刻意感知测试环境或伪造进程/结果仍需要独立复核；Docker 也不是对宿主完全控制权的补救。预训练已经见过公开历史的污染不能靠删 `.git` 消除，应披露既往暴露情况，未来增加新的私有 holdout 题。

资源限制用于约束执行环境，未加入按工具次数、关键词或相似度放行/拦截 Agent 思考的规则。

## 第二轮接口

每次 `grade` 自动生成 `review-request.json`，包含机器结果、提交补丁、Agent 的诊断说明和维护者 case 文件位置。外部 Agent 按 `review-response.schema.json` 返回结论即可。本版没有实现第二轮 Agent，也不让它静默覆盖机器分；两种结果单独保留。

## 文件入口

- `CATALOG.zh-CN.md`：34 题目录、难度、改动量、历史出处与执行范围。
- `HISTORY.zh-CN.md`：872 条历史的筛选结论、真实补修链、大重构等排除项。
- `RESEARCH.zh-CN.md`：SWE-bench、Pro V2、Live、Harbor 的官方资料和取舍。
- `VALIDATION.zh-CN.md`：本次实际执行的环境、输入、结果与未覆盖边界。
- `private/*/*/case.json`：维护者元数据；`bug.patch` 与隐藏行为测试不属于受测者材料。
- `tests/test_harness.py`：判分、路径、脱敏和结果汇总的回归测试。

完整桌面应用仍按项目要求使用 `npm run tauri dev`；本套没有打开 demo 页面做视觉验收。
