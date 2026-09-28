# Harness 独立复核

审查日期：2026-09-28。审查对象：`benchmarks/deep-student/bench.py` 的任务准备、补丁采集、路径边界、Rust 测试脱敏、Vitest 结果解析和分数汇总。审查者只修改 `tests/test_harness.py` 与本报告，runner 修复由主 agent 完成。

## 实际执行证据

- 使用真实 CLI 运行 `prepare DS-F10`，产物 `/tmp/ds-harness-review-workspace`。该目录独立 Git 历史仅有 1 个起始提交，未携带仓库原始历史，Markdown 只保留本题 `TASK.md`。
- 在该目录的真实生产组件完成参考修复，执行普通 `git add` / `git commit`，随后使用真实 CLI `collect DS-F10`。结果 `/tmp/ds-harness-collected.patch` 只包含 `AnkiCardUpdateDiff.tsx` 的正常修复差异，证明提交 commit 不会令采集遗漏修复，也不依赖参赛者的 Git ref。
- 第一次快照扫描发现 29 个非 vendor Rust 文件仍含测试属性，包括独立 `pipeline_tests.rs`、`note_storage_tests.rs`、`tests.rs` 以及条件测试模块。向主 agent 回报后，第二次真实 CLI `prepare` 产物 `/tmp/ds-harness-review-sanitized` 中只剩 `scripts/migration-ci/fixture-upgrade-harness.rs` 一个未处理的导出脚本。两个真实 `#[cfg(not(test))]` 生产分支保留，未被测试剥离误删。
- 回归命令：`python3 -m unittest discover -s benchmarks/deep-student/tests -v`。29 个边界测试全部通过，输出 `/tmp/ds-harness-review-unit-final29.log`。其中包含 scripts 中导出的 Rust 测试剥离覆盖。

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

## 已确认的防线

- 没有测试、跳过目标测试、缺失测试、新增替代测试、进程非零退出、运行时错误均不能得到满分。
- Vitest 重复完整测试名称被拒；目标集合必须与校准集合完全相同。
- 未完成任务仍计入全套分母；未知任务结果、重复任务结果、类型错误或状态矛盾的结果被拒。
- 顶层依赖、锁文件、Vitest 配置、隐藏评测目录、仓库外路径、`..` 路径、反斜线路径、Git symlink/submodule 模式均不能进入被评分补丁。
- 生产源码正常修改可以采集；Agent 是否提交本地 commit 不影响差异。
- 公开快照没有历史 Git 提交、原始 Markdown 决策文档、评测私有目录。

## 仍须明确的信任边界

这些验证证明输入与结果结构边界，并不证明任意参赛代码绝无作弊行为。待测 JavaScript 与 Vitest 仍处在同一进程体系，代码可以感知运行环境；容器无网络、源码只读和文件白名单不能证明代码没有测试感知、硬编码或报告干扰。因此官方判分应使用 Docker 隔离，`local` 仅用于可信参考代码调试；二轮复核入口须检查测试感知、篡改测试进程/报告、硬编码和真实泛化能力。不能将当前环境宣传为“完全防作弊”。

本次审查没有运行 Docker 构建、native Rust adapter 或完整 36 题正式校准，也没有运行真实 Tauri UI。这些属于主 agent 的整套交付验证，不能用本报告的纯函数和 CLI smoke 代替。

## 最终状态

主 agent 已将 Rust 脱敏范围覆盖全部导出 `.rs` 文件。定点执行最新 sanitize 后，`scripts/migration-ci/fixture-upgrade-harness.rs` 的残留测试属性已移除；新增第 29 个回归同时确认脚本的非测试函数保持可用。29 个测试全部通过。已发现的问题在本审查范围内均已修复；不扩大声称到尚未执行的 Docker、native adapter 或整套正式校准。
