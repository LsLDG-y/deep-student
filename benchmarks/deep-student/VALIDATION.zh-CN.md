# 本次验证记录

验证日期：2026-09-28。源代码锚点为 `d6534ff2715e59c4c2c3e6c7bec5f6554576ce68`，评测集为 1.0.0。本文件描述测试集和执行器验证，不是对某个候选 Agent 的能力评分。

## 已完成的本地统一校准

环境：macOS ARM64、Node v26.5.0、项目已有 Vitest 3.2.7/jsdom、Rust release 最小模块 harness、Python 3.14.6/SQLite。每次从锚点导出独立目录，实际应用 `bug.patch`，剥离原测试与答案性注释，再运行组织者隐藏测试。

结果：**34/34 题有效，48 个 FAIL_TO_PASS、38 个 PASS_TO_PASS，共 86 个行为用例**。参考态全部通过；缺陷态 48 个目标行为用例失败、38 个正常行为用例继续通过。Rust 直接编译生产源模块，SQLite 直接执行生产迁移 SQL，React/TS 调用生产函数和组件；没有使用源码字符串匹配判修复成功。

主日志位于 `/tmp/ds-bench-release-local-20260928`。该次整套首跑有 33 题有效：B10 的测试迁移后仍使用旧相对导入，导致套件没有执行，被正确判为无效；改为工作区 `@/` 导入后，在 `/tmp/ds-bench-B10-fixed-import` 单独重跑成功。未改变业务断言或期望。各题最新结果保存在 `private/*/*/calibration.local.json`，不掩盖首跑故障。

## 提交链路与判分边界

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

## Linux 容器校准

最终整套校准已完成：**34/34 题有效，48 个 FAIL_TO_PASS、38 个 PASS_TO_PASS**，与本地校准的用例分类一致。每题使用新的缺陷/参考源码目录与两个断网容器；参考态 86 个行为用例全部通过，缺陷态仅目标行为失败，正常行为保留。

实际环境：Linux ARM64，Docker context `colima-amd64test`（名字含 amd64，但运行架构为 aarch64），Python 3.11.2、Node 22.22.0、Rust/Cargo 1.94.1、Vitest 3.2.7。每个评测容器限制 2 CPU / 4 GB 内存、普通用户、无网络、只读源文件系统。

- 镜像：`deep-student-bench:1.0`。
- 实际 image ID：`sha256:c36f054875bb4cef944733cf45b591e4babaec9595ff1c6ff5177918dd4d2bf1`。
- 整套原始材料：`tmp/ds-bench-release-docker-20260928/`；汇总为该目录的 `calibration.json`。
- 可随仓库复核的逐题摘要：`private/*/*/calibration.docker.json`。本批实际运行版本为 1.0.0；发布审查中新增的 `suite_version` 字段已按该真实版本补录，不改变测试状态或测试清单。以后的校准由执行器直接记录版本。
- B05 固定 2 MB / 200 万分片的历史缺陷耗时 **57.644849902 秒**，正常行为仍通过；参考版本两个测试合计 **约 0.03 秒**。3 秒阈值只计事件处理，不计编译。其状态已从候选改为正式 `ready`；其它架构仍须重新校准。

首次 Docker 执行暴露了实际环境问题，均保留旧日志而没有把失败隐藏为成功：Colima 不共享 macOS `/private/tmp`，因此改用已共享且被 Git 忽略的仓库 `tmp/`；挂载权限、Cargo 构建脚本的可执行临时目录、Cargo 的可写 home、Vite 只读配置加载及 Python 源码根路径均在实际容器路径上修正。镜像最初因 daemon 联网/本地层问题不能启动，经宿主下载官方镜像层恢复后才构建通过，未清除原有 Docker 数据。

其中最重要的执行器缺陷是 **Git 向上发现原仓库并静默跳过补丁**。旧 `tmp/ds-bench-docker-remaining` 中部分“缺陷态”实际仍是正确源码，因此那批结果被废弃。修正补丁的 Git 搜索边界与继承环境后，真实文件对比确认缺陷注入到快照、父仓库不变，再从头执行了上述 34 题校准。新增回归不是对旧结果的追认。

## Docker 交卷与计分闭环

最终控制实验材料在 `tmp/ds-bench-release-control-v2/`：

1. 用实际 `sandbox DS-F10` 导出题目并启动容器；公开 Git 历史只有 1 个初始提交。普通用户可以执行 `git status`、修改源码并提交 commit。只信任容器内固定的 `/workspace` Git 目录，未放宽到所有目录。
2. 将维护者参考补丁作为控制输入交卷，经 `collect → grade-set` 得到该题 **100 分**、全套汇总 **2.94/100（1/34）**。没有把未提交的 33 题排除出分母。
3. 同题空 patch 经独立 `grade` 得到 **0 分 / unresolved**，正常行为仍通过。
4. 每题结果同时产生原始测试结果、日志、提交补丁和 `review-request.json`。补丁被拒绝也保留原交卷，供二轮复核读取。

同一镜像的公开沙箱另实测：维护者 private 目录不可见，外部 TCP 连接返回网络不可达；在公开 `.benchmark-support/rust` 入口添加自编用例后，可断网编译并运行实际生产 SSE 模块。记录位于 `tmp/ds-bench-agent-smoke.sandbox.json`、`tmp/ds-bench-release-control/agent-isolation.txt`。这证明本次沙箱设置，不代表外部 Agent 控制器已自动剥夺宿主工具；正式评测仍须由控制器只暴露容器入口。

发现汇总器递归读取候选源码中的 `result.json` 后，已限定为组织者的直系任务结果目录，并校验目录与题号一致。真实临时文件回归同时放入伪造的已知题、重复题、未知题结果，均不能加分或干扰正常汇总。对于同进程测试感知或伪造运行报告，仍保留明确的二轮检查边界，没有宣称绝对防作弊。
