# Harness 独立复核

审查日期：2026-09-28。审查对象：`benchmarks/deep-student/bench.py` 的任务准备、补丁采集、路径边界、Rust 测试脱敏、Vitest 结果解析和分数汇总。审查者只修改 `tests/test_harness.py` 与本报告，runner 修复由主 agent 完成。

## 实际执行证据

- 使用真实 CLI 运行 `prepare DS-F10`，产物 `/tmp/ds-harness-review-workspace`。该目录独立 Git 历史仅有 1 个起始提交，未携带仓库原始历史，Markdown 只保留本题 `TASK.md`。
- 在该目录的真实生产组件完成参考修复，执行普通 `git add` / `git commit`，随后使用真实 CLI `collect DS-F10`。结果 `/tmp/ds-harness-collected.patch` 只包含 `AnkiCardUpdateDiff.tsx` 的正常修复差异，证明提交 commit 不会令采集遗漏修复，也不依赖参赛者的 Git ref。
- 第一次快照扫描发现 29 个非 vendor Rust 文件仍含测试属性，包括独立 `pipeline_tests.rs`、`note_storage_tests.rs`、`tests.rs` 以及条件测试模块。向主 agent 回报后，第二次真实 CLI `prepare` 产物 `/tmp/ds-harness-review-sanitized` 中只剩 `scripts/migration-ci/fixture-upgrade-harness.rs` 一个未处理的导出脚本。两个真实 `#[cfg(not(test))]` 生产分支保留，未被测试剥离误删。
- 回归命令：`python3 -m unittest discover -s benchmarks/deep-student/tests -v`。最初 29 个边界测试通过；真实嵌套 Git 仓库回归扩展到 33 个；计分入口与失败材料留存回归后，38 个测试全部通过，最新输出 `/tmp/ds-harness-review-grading-boundaries.log`。覆盖测试脱敏、Git 上级仓库隔离、汇总输入层级、失败补丁留存和 suite 版本匹配。

## 已发现并修复的问题

| 问题 | 风险/影响 | 复核证据 |
| --- | --- | --- |
| 顶层 `src` 是目录 symlink 时，单文件 `is_symlink()` 看不到祖先 | 采集可能读取工作区外内容 | 根目录 symlink 与文件 symlink 的拒绝回归均通过 |
| 仅排除 tests 目录，没有排除独立 Rust 测试文件 | 向参赛者泄露历史回归断言和答案线索 | 真实快照发现 29 个测试文件；新增 `_tests.rs`、`tests.rs` 等覆盖 |
| 精确 `#[cfg(test)]` 匹配漏空格、组合条件、直接测试函数 | 残留旧回归测试 | 空格 cfg、直接同步/异步测试函数剥离均通过 |
| 初次加宽 cfg 匹配误删 `not(test)` 与共享 feature 的生产项 | 公开起始环境偏离真实生产行为 | 三值 cfg 语义后的保留生产分支测试通过；真实两个生产分支亦保留 |
| 重复任务选择器允许相同任务重复进入流程 | 重复工作及潜在汇总歧义 | 重复 selector 拒绝测试通过 |
| summary 对 `resolved` 使用宽松 truthiness | 字符串 `"false"` 或 invalid 状态可被计为成功 | malformed 类型与状态/分数矛盾均被拒绝 |
| collect 缺少无末尾换行的 Git 标记 | 合法编辑生成 corrupt patch | 无末尾换行的编辑可采集、应用并逐字节保留 |
| 快照在外层 Git 仓库目录内，`git apply` 向上发现外层仓库 | 返回 0 但跳过缺陷补丁，导致所谓 buggy 快照仍是正确版本 | 真实 parent/.git 与 tmp/snapshot 回归直接比较文件，正向/反向均仅修改快照 |
| `git apply --numstat` 继承 caller cwd 或 Git 环境覆盖 | 在仓库子目录解析时可能遗漏受保护路径 | 子目录解析拒绝 package.json，正常源码路径完整返回；五项 Git 环境覆盖不改变结果 |

## 已确认的防线

- 没有测试、跳过目标测试、缺失测试、新增替代测试、进程非零退出、运行时错误均不能得到满分。
- Vitest 重复完整测试名称被拒；目标集合必须与校准集合完全相同。
- 未完成任务仍计入全套分母；未知任务结果、重复任务结果、类型错误或状态矛盾的结果被拒。
- 顶层依赖、锁文件、Vitest 配置、隐藏评测目录、仓库外路径、`..` 路径、反斜线路径、Git symlink/submodule 模式均不能进入被评分补丁。
- 生产源码正常修改可以采集；Agent 是否提交本地 commit 不影响差异。
- 公开快照没有历史 Git 提交、原始 Markdown 决策文档、评测私有目录。

## 仍须明确的信任边界

这些验证证明输入与结果结构边界，并不证明任意参赛代码绝无作弊行为。待测 JavaScript 与 Vitest 仍处在同一进程体系，代码可以感知运行环境；容器无网络、源码只读和文件白名单不能证明代码没有测试感知、硬编码或报告干扰。因此官方判分应使用 Docker 隔离，`local` 仅用于可信参考代码调试；二轮复核入口须检查测试感知、篡改测试进程/报告、硬编码和真实泛化能力。不能将当前环境宣传为“完全防作弊”。

本次审查没有运行 Docker 构建、native Rust adapter 或完整测试集正式校准，也没有运行真实 Tauri UI。这些属于主 agent 的整套交付验证，不能用本报告的纯函数和 CLI smoke 代替。

## 最终状态

主 agent 已将 Rust 脱敏范围覆盖全部导出 `.rs` 文件。定点执行最新 sanitize 后，`scripts/migration-ci/fixture-upgrade-harness.rs` 的残留测试属性已移除；新增第 29 个回归同时确认脚本的非测试函数保持可用。38 个测试全部通过。已发现的问题在本审查范围内均已修复；不扩大声称到尚未执行的 Docker、native adapter 或整套正式校准。


## 嵌套 Git 仓库补充验证

主 agent 在 Docker 正式校准中发现：快照建在工作仓库的 `tmp/` 下且没有自己的 `.git` 时，原 `git apply` 会向上发现父仓库，可能返回成功却输出 `Skipped patch`。因此仅核对退出码、仅在系统 `/tmp` 建测试目录，都无法证明缺陷已注入。补丁解析也存在调用目录改变路径过滤的同类风险。

新增 `GitIsolationTests` 使用系统 `/tmp` 中真实初始化并提交的父 Git 仓库，在其中创建无 `.git` 的 `tmp/snapshot`，而不是 mock subprocess。四项回归实际断言：

1. 正向应用补丁后快照文件从 `value = 1` 变为 `value = 2`，父仓库同路径文件仍是 `value = 1` 且 tracked 工作树干净；反向应用再将快照恢复。
2. 同时继承 `GIT_DIR`、`GIT_WORK_TREE`、`GIT_COMMON_DIR`、`GIT_INDEX_FILE`、`GIT_PREFIX` 时，快照仍被正确修改，父仓库没有改动。
3. 进程调用目录在父仓库 `src/` 下时，`validate_patch` 仍拒绝 `package.json` 修改，而不是将补丁跳过并返回空路径集合。
4. 调用目录在父仓库更深子目录且携带上述环境覆盖时，正常生产补丁仍准确返回 `src/value.ts`，解析没有修改父仓库。

四项与原有 29 项一起运行，33/33 通过。此补充验证确认最新隔离修复；此前依赖错误缺陷注入路径产生的校准结果需要主流程重新校准，不能由本回归测试追认有效。


## 计分入口与复核材料补充验证

主流程收窄 `summary` 为仅接受输入目录直系任务目录下的 `result.json`，并要求目录名与 `task_id` 一致；`grade` 先保存原始提交再验证；校准与评分同时约束 suite 版本。新增五项回归：

1. 在实际临时目录写入一条真实失败结果，并在其候选源码和原始评测子目录嵌入已知题成功、相同题号成功、未知题成功的伪造 JSON。汇总仍为 0 分、1 次尝试、另一题缺失，既没有加分也没有引发重复题号错误。
2. 一份格式正确的直系结果放在与 `task_id` 不同名的任务目录，汇总拒绝。
3. 提交会修改受保护 `package.json` 的补丁，真实 Git 路径解析拒绝；评分前已保存的 `submission.patch` 与原始输入逐字节相同，诊断文件仍保留，`review-request.json` 引用的补丁、机器结果与诊断文件实际存在。拒绝过程中没有准备源码或启动测试。
4. 使用不同 suite 版本的校准文件进行评分，在准备源码和执行测试前返回 invalid、0 分，并保留原始提交。
5. 使用可控的失败/通过执行结果校准，真实写出的校准 JSON 携带当前 suite 版本、固定源码锚点和正确的 F2P/P2P 清单。

新增五项与既有 33 项合计 38/38 通过。评分及校准编排测试模拟了源码准备和评测执行边界，没有启动 Docker；它们验证文件留存、版本决策和分数汇总，不替代主流程当前的 34 题 Docker 重新校准。
