# 本次验证记录

验证日期：2026-09-28。源代码锚点为 `d6534ff2715e59c4c2c3e6c7bec5f6554576ce68`，下方第一轮记录对应评测集 1.0.0，第二轮记录对应 1.0.1。本文件描述测试集和执行器验证，不是对某个候选 Agent 的能力评分。

## 1.0.0 本地统一校准

环境：macOS ARM64、Node v26.5.0、项目已有 Vitest 3.2.7/jsdom、Rust release 最小模块 harness、Python 3.14.6/SQLite。每次从锚点导出独立目录，实际应用 `bug.patch`，剥离原测试与答案性注释，再运行组织者隐藏测试。

结果：**34/34 题有效，48 个 FAIL_TO_PASS、38 个 PASS_TO_PASS，共 86 个行为用例**。参考态全部通过；缺陷态 48 个目标行为用例失败、38 个正常行为用例继续通过。Rust 直接编译生产源模块，SQLite 直接执行生产迁移 SQL，React/TS 调用生产函数和组件；没有使用源码字符串匹配判修复成功。

主日志位于 `/tmp/ds-bench-release-local-20260928`。该次整套首跑有 33 题有效：B10 的测试迁移后仍使用旧相对导入，导致套件没有执行，被正确判为无效；改为工作区 `@/` 导入后，在 `/tmp/ds-bench-B10-fixed-import` 单独重跑成功。未改变业务断言或期望。各题最新结果保存在 `private/*/*/calibration.local.json`，不掩盖首跑故障。

## 1.0.0 提交链路与判分边界

- 真实 CLI：`prepare DS-F10 → 修改生产代码 → git commit → collect`。即使 Agent 自己提交了 commit，组织者仍采集到正确差异。
- 参考补丁经 `reference-patch → grade` 得到 100，空补丁经 `grade` 得到 0，正常行为保持通过；详见 `/tmp/ds-bench-reference-grade-F10` 与 `/tmp/ds-bench-empty-grade-F10`。
- 新的只读配置加载方式已用 `/tmp/ds-bench-loader-readonly-smoke` 验证，避免 Vite 在只读源码/依赖目录写配置临时文件。
- 汇总仅提交一题的真实结果得到 **2.94/100（1/34）**，没有将缺失题排除出分母，见 `/tmp/ds-bench-summary-smoke.json`。
- 38 项执行器边界测试通过，涵盖零测试、缺失/多余/跳过测试、进程退出不一致、重复题号、非法分数类型、依赖与测试配置改动、路径越界、符号链接、Rust 条件测试剥离、无末尾换行的补丁、嵌套 Git 仓库、伪造结果隔离、失败交卷留存和套件版本匹配。最新日志：`/tmp/ds-harness-review-grading-boundaries.log`。
- 公开快照实查仅保留新的起始 Git 提交；原文档与历史测试已排除。Rust `not(test)` 与共享 feature 的生产分支保留，测试属性及测试专用模块剥离。

## 适用边界

本地 `--engine local` 是可信维护者调试模式，不能隔离恶意候选代码。正式机器评分应使用已校准的 Docker 镜像；镜像身份变更会要求重新校准，不能只重用同名标签。

本次模块行为测试没有验证完整 Tauri UI、Android SAF、真实云同步、远端 LLM、真实 Anki 应用或平台 OCR。也没有运行多个真实候选 Agent 来标定难度/区分度，尚不能声称本套任务已获得经验性难度排名。

仅凭历史标题或提交正文不能证明此前多次代码修复都失败；本版历史结论以实际 diff 和本次差分行为验证为限。防历史检索和测试篡改措施不等于对所有同进程测试感知攻击的绝对防护，详见 `RESEARCH.zh-CN.md` 和 `private/harness-review.md`。

## 1.0.0 Linux 容器校准

最终整套校准已完成：**34/34 题有效，48 个 FAIL_TO_PASS、38 个 PASS_TO_PASS**，与本地校准的用例分类一致。每题使用新的缺陷/参考源码目录与两个断网容器；参考态 86 个行为用例全部通过，缺陷态仅目标行为失败，正常行为保留。

实际环境：Linux ARM64，Docker context `colima-amd64test`（名字含 amd64，但运行架构为 aarch64），Python 3.11.2、Node 22.22.0、Rust/Cargo 1.94.1、Vitest 3.2.7。每个评测容器限制 2 CPU / 4 GB 内存、普通用户、无网络、只读源文件系统。

- 镜像：`deep-student-bench:1.0`。
- 实际 image ID：`sha256:c36f054875bb4cef944733cf45b591e4babaec9595ff1c6ff5177918dd4d2bf1`。
- 整套原始材料：`tmp/ds-bench-release-docker-20260928/`；汇总为该目录的 `calibration.json`。
- 本批摘要保存在上述原始材料目录的 `calibration.json`；逐题 `private/*/*/calibration.docker.json` 后续会被新版本校准更新。本批实际运行版本为 1.0.0；发布审查中新增的 `suite_version` 字段已按该真实版本补录，不改变测试状态或测试清单。以后的校准由执行器直接记录版本。
- B05 固定 2 MB / 200 万分片的历史缺陷耗时 **57.644849902 秒**，正常行为仍通过；参考版本两个测试合计 **约 0.03 秒**。3 秒阈值只计事件处理，不计编译。其状态已从候选改为正式 `ready`；其它架构仍须重新校准。

首次 Docker 执行暴露了实际环境问题，均保留旧日志而没有把失败隐藏为成功：Colima 不共享 macOS `/private/tmp`，因此改用已共享且被 Git 忽略的仓库 `tmp/`；挂载权限、Cargo 构建脚本的可执行临时目录、Cargo 的可写 home、Vite 只读配置加载及 Python 源码根路径均在实际容器路径上修正。镜像最初因 daemon 联网/本地层问题不能启动，经宿主下载官方镜像层恢复后才构建通过，未清除原有 Docker 数据。

其中最重要的执行器缺陷是 **Git 向上发现原仓库并静默跳过补丁**。旧 `tmp/ds-bench-docker-remaining` 中部分“缺陷态”实际仍是正确源码，因此那批结果被废弃。修正补丁的 Git 搜索边界与继承环境后，真实文件对比确认缺陷注入到快照、父仓库不变，再从头执行了上述 34 题校准。新增回归不是对旧结果的追认。

## 1.0.0 Docker 交卷与计分闭环

最终控制实验材料在 `tmp/ds-bench-release-control-v2/`：

1. 用实际 `sandbox DS-F10` 导出题目并启动容器；公开 Git 历史只有 1 个初始提交。普通用户可以执行 `git status`、修改源码并提交 commit。只信任容器内固定的 `/workspace` Git 目录，未放宽到所有目录。
2. 将维护者参考补丁作为控制输入交卷，经 `collect → grade-set` 得到该题 **100 分**、全套汇总 **2.94/100（1/34）**。没有把未提交的 33 题排除出分母。
3. 同题空 patch 经独立 `grade` 得到 **0 分 / unresolved**，正常行为仍通过。
4. 每题结果同时产生原始测试结果、日志、提交补丁和 `review-request.json`。补丁被拒绝也保留原交卷，供二轮复核读取。

同一镜像的公开沙箱另实测：维护者 private 目录不可见，外部 TCP 连接返回网络不可达；在公开 `.benchmark-support/rust` 入口添加自编用例后，可断网编译并运行实际生产 SSE 模块。记录位于 `tmp/ds-bench-agent-smoke.sandbox.json`、`tmp/ds-bench-release-control/agent-isolation.txt`。这证明本次沙箱设置，不代表外部 Agent 控制器已自动剥夺宿主工具；正式评测仍须由控制器只暴露容器入口。

发现汇总器递归读取候选源码中的 `result.json` 后，已限定为组织者的直系任务结果目录，并校验目录与题号一致。真实临时文件回归同时放入伪造的已知题、重复题、未知题结果，均不能加分或干扰正常汇总。对于同进程测试感知或伪造运行报告，仍保留明确的二轮检查边界，没有宣称绝对防作弊。


## 1.0.1 第二轮复核

本轮从实际反例出发，发现并修复了以下问题；并非仅重复执行第一轮的正常样例。

| 反例 | 修正与验证 |
|---|---|
| 将受保护的 `package.json` 改名到允许的 `src/` 路径，正向 numstat 只报告目标路径 | 同时使用 Git 正向、反向解析并验证双方路径，拒绝显式与隐式改名、复制；未自行实现 Git 引号或转义解析 |
| `new file mode 120755` 能创建符号链接，却不匹配原先只检查 120000 的规则 | 所有文件模式元数据只接受 Git 普通文件的 100644/100755；覆盖 index 行及模式变更 |
| 新增/删除空文件、仅改变可执行位被采集遗漏；将既有源码改成 FIFO 会阻塞宿主采集 | 区分“不存在”与空内容，保留普通文件模式；拒绝特殊文件，采用非阻塞打开并复查描述符文件类型 |
| 非 UTF-8 补丁使 grade 抛出未捕获异常 | 作为无效提交处理并保留原始字节，供二轮复核 |
| 不同 suite、源码锚点、local/docker 或镜像的成功结果被混合计算 | grade 写出完整身份字段；汇总在计分前验证身份一致及字段类型。缺失身份的旧结果不能冒充新版成绩 |
| 参考测试全绿却最终退出 7，或声明 3 项只运行 2 项，两边仍被认作有效校准 | 参考进程必须退出 0；Python 运行前加载测试清单，Vitest/Cargo 核对框架报告的完整性信息 |
| 第 2 题原生测试报告损坏，使第 3 题和总报告都不再执行 | 坏 JSON/报告结构成为该题的 execution_error；实际三题复现结果为 resolved / execution_error / resolved，汇总正常生成 |
| sandbox 返回时 Cargo 缓存仍在复制 | 改为同步初始化完成后返回；失败停止容器，无新增轮询或重试层 |
| root 宿主会继承 root 容器用户；B02 公开源码保留直接提示同根因的历史注释 | root 映射为容器 65534:65534；精确替换该注释，保留正常协议属性和实现 |

集成后的 **70 项执行器回归全部通过**，日志为 `tmp/ds-bench-round2-harness.log`。包括 13 项补丁/文件系统边界、6 项沙箱边界与新增评分异常路径，以及原有回归。没有通过放宽原业务断言让测试变绿。

实际沙箱检查在 `tmp/ds-sandbox-ready-backend-20260928/`：DS-B02 沙箱命令返回后的第一条检查即看到 PID 1 为 `sleep infinity`，Cargo 配置及完整缓存已到位，Git 工作区干净；公开 Rust harness 断网 release 编译成功，历史提示注释已去除而正常属性保留。该容器已停止。本机宿主实际 UID 为 501；另以容器用户 `65534:65534`、只读源码挂载进行实测，源码/Git 可读，`/tmp` 与 Cargo home 可写，公开 harness 离线编译成功，日志在 `tmp/ds-sandbox-uid65534-backend-20260928/`。这验证了回退用户的实际容器执行，不声称宿主本身以 root 身份运行。

评分异常的实际重放记录为 `/tmp/ds-score-audit-38l2h75n/after-fix-observations.json`。这些最小案例使用真实 Python runner/子进程和现有 CLI，但用小夹具替代业务源码，用来定位和验证执行器异常，不冒充 34 题业务校准。

版本已递增为 **1.0.1**，不回填旧校准的版本字段。保留的 macOS `calibration.local.json` 仍属于 1.0.0；如需新版 local 判分，必须重新运行 local 校准。正式默认路径使用新版 Docker 校准。


1.0.1 最终 Docker 全量校准结果为 **34/34 有效、48 个 FAIL_TO_PASS、38 个 PASS_TO_PASS**，86 项参考行为全部通过并成功退出。所有记录均由新版执行器直接写出 `suite_version=1.0.1` 及完整性字段，没有改写旧结果冒充新校准。环境和镜像与第一轮相同；原始结果在 `tmp/ds-bench-v1.0.1-docker-20260928/`，逐题摘要为当前 `private/*/*/calibration.docker.json`。B05 本次缺陷负载耗时 52.223118775 秒，参考版本两项测试合计约 0.03 秒，继续满足 3 秒差分门槛。

实际 Docker `grade-set` 控制批次保存在 `tmp/ds-bench-round2-controls/`，五份提交全部产生结果与二轮复核材料：

| 输入 | 结果 |
|---|---|
| F10 参考补丁 | resolved，100 分 |
| D01 空补丁 | unresolved，0 分 |
| B01 从 package.json 改名到 src 的补丁 | invalid，0 分，明确拒绝 rename/copy |
| B02 使用 120755 mode 的补丁 | invalid，0 分，明确拒绝非普通文件 |
| B03 非 UTF-8 补丁 | invalid，0 分，保留原始字节并返回明确编码错误 |

批次退出 0，汇总为 **5 份交卷、1 题解出、全套 2.94/100**。三份非法补丁没有中断后续正常题，所有 `review-request.json` 指向的原始交卷均实际存在。这里是评测器控制实验，不是候选模型成绩。
