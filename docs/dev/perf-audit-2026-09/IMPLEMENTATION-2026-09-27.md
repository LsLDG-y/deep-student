# 性能优化落地与验证

日期：2026-09-27（Asia/Shanghai）。本轮基线为 `main @ 0a12cff12` 及开工时已有的版本回退工作区，应用版本为 0.9.68。此前已存在的本目录 README 使用的是另一份旧基线，不作为本轮测量依据。

当前状态：15 个优化/验收工具切片已提交，以下已完成的编译、回归及真实应用观察均有对应记录。**最后的索引 OCR 补充修复已编译并启动，但其 A/B/C/D 端到端复测因 Mac 锁屏尚未执行，不能算该项验收完成。**

## 范围与环境

本轮落实二轮复核确认的优化，覆盖 Windows/macOS/Android 共用前后端，以及 Android 专用 SAF、无 Lance 能力分流和日志路径。没有调整缺少真机证据的 GPU、材质、SQLite 缓存/连接池、编译优化档位，也没有更改模型调用协议、搜索 Unicode 规则或同步加密格式。

- macOS 26.5.2 / M5 Pro / 48 GiB，真实 Tauri WKWebView。
- 真实桌面验证通过 `npm run tauri dev` 启动，使用独立 identifier `com.deepstudent.perfaudit20260927`；没有打开 demo/hero。
- 合成会话、独立 SQLite 数据库、本地 OCR mock 与临时文件均为本轮测试数据。没有修改个人资料库，没有使用付费模型，没有部署或推送远端。
- 保留开工前已有的 release manifest、版本、Cargo、CHANGELOG、第三方 notices 改动。package/lock 只提交本轮依赖补丁部分，原版本回退未混入提交。
- 原始证据位于 `/tmp/deep-student-perf-audit-20260927/`。`ROUND2.md` 为实施方案及此前方案对比，不应把原型结果误认成实施后实测。

## 已提交的实现

| 提交 | 改动 | 保留的行为与边界 |
|---|---|---|
| `05bae311c` | 搜索专用 Worker、变化块缓存；隐藏会话 suspended 透传 | 搜索关闭释放 Worker，查询代次隔离旧结果；后台 store 继续接收流式内容 |
| `63998e811` | Todo/Pomodoro 57 个同步数据库命令改为 async 外层及完整 blocking 工作单元 | 连接和事务不拆散，保留错误封装与事件顺序 |
| `728c209ac` | 词法检索范围先于 LIMIT，批量必要元数据；无 Lance 时在外部向量请求前分流 | 保留类型别名、未知类型回退、最新文件夹挂载语义和 SQLite 非向量路径；disabled 索引不再高频空转 |
| `fb23000d0` | 去掉备份成功步骤固定等待；ZIP 恢复检查点改为标量；手工 JSON 同步使用缓冲读写 | 保留 Busy/Locked 退避、维护屏障、非 ZIP 任务检查点和原 JSON 格式 |
| `7e32e6bed` | 详细工具诊断跟随已有显式开关 | 关闭时不启动收集器/定时器、不构造大 detail；保留必要产品日志 |
| `b026808aa` | note driver 从已挂载编辑器 API 读取状态；generative schema 与 UI 注册分离 | 复用现有模块和 schema 定义，不新增另一套注册协议 |
| `1dbd8fbcc` | OCR 请求前归还数据库连接；跨文件共享 4 个 OCR permit；有界图片 CPU blocking 路径 | bytes→bytes 保留压缩策略；permit 随实际任务存活；排队取消和写回前校验仍生效 |
| `a49e19ce3` | 历史先做轻量 ID/压缩边界/尾窗，再批量物化 blocks/replay；中间保存只写 dirty payload | 同 ID 替换、replay、finalizer、外部 Anki 块均覆盖；COMMIT 成功后才清 dirty；最终完整 flush 保留；失败 COMMIT 主动 ROLLBACK |
| `fd87fed3f` | FlowToken 固定 2.0.6，使用可重放 patch 延迟 DefaultCode 依赖 | 保留行内 code、真正语言代码节点、复制与原动画；安装时自动应用补丁 |
| `30a41b38a` | Markdown renderer 身份稳定；AgentTaskPanel 缩窄订阅 | 新内容仍可读取当前回调/能力；纯正文 chunk 不驱动任务面板提交 |
| `72e62ee64` | 只对命中且可见的消息生成高亮；折叠图片先读前 8 个 | 导航目标可提前生成 mark；展开/全屏读取剩余图片；前 8 张全部缺失时仍保留展开入口 |
| `cca2e6e30` | 文件同步加密、解密、KDF 与哈希移出 async worker | 复用原 cipher cache，格式、KDF 强度和串行性不变；最终 rename 仍由持有同步许可的调用者执行 |
| `6975f3c91` | Android SAF 改为持久队列落地后原生唤醒，后台串行扫描 | 移除 400ms 主线程轮询；保留 onResume 补扫、权限拒绝和目录授权回退 |
| `6a010db7d` | 修复既有包体检查器对实际 `main-*.js` 入口的漏识别，支持 `--dist-dir` | 保留原预算和 CI warn-only；入口文件大小不冒充首屏闭包大小 |
| `8c8714ab7` | 真实验收补出的索引 OCR 兜底复用同一 4 槽；等待前释放连接；自动索引遵守开关 | `LLMManager` 仅拥有共享许可，LLM 方法不嵌套获取；保留现有索引提交/取消状态语义 |

## 实际观察

### 搜索和渲染

真实 WKWebView，50 条消息、初始 250,000 字符，应用保持前台，生产搜索 hook 与真实 store。以下是单次受控验证的观测，不是 release FPS 或跨平台跑分。

| 阶段 | Worker 传输与耗时 | 观测最大 rAF 间隔 |
|---|---|---:|
| 冷首次无命中搜索 | 50 块 / 250,000 字符，235ms | 18ms |
| 仅修改查询 | 0 块 / 0 字符，低于计时分辨率 | 18ms |
| 末块追加 | 1 块 / 5,032 字符，12ms | 22ms |
| 全部消息命中 | 0 块，返回 10,531 处命中，5ms | 91ms |
| 下一处命中 | 使用已有索引 | 29ms |

实施中曾观察到 Worker 已接入但界面仍出现 356ms 间隔。定位后发现所有已挂载消息仍在同步生成高亮，随后补齐可见区域约束。最终 50 条消息仍挂载时，全匹配仅对 2 条消息生成 436 个 mark，并非对 10,531 处命中全部建 DOM。独立前台复核确认：直接定位第 50 条、全匹配回到首条、Shift+Enter 跨屏回绕到第 50 条，活动 mark 均在滚动视口内。

全匹配 91ms、关闭搜索 93ms 的局部 DOM/渲染成本仍存在；长单块、大量可见命中不应被描述为“已保证 60fps”。冷 Worker 完成时间也没有消失，改进的是主线程响应性及重复计算量。

隐藏会话真实路径：最小化后连续 10 次生产 store 追加，正文 DOM 变更为 **0**，store 保留最后一次追加，恢复后显示完整内容。二轮同路径此前为 10 次 DOM 变更。

额外实际组件验证：追加文本后，已有流式 Markdown 表格保持同一 DOM 节点；TypeScript 代码块和新追加正文正常出现。该正确性检查运行时 document 为 hidden，不用于时延比较。

证据：

- `implementation-search-visible-wkwebview.json`
- `implementation-search-navigation-visible.json`
- `implementation-hidden-wkwebview.json`
- `implementation-render-navigation-wkwebview.json`

### 生产依赖闭包

对本轮旧、新生产包使用同一静态依赖闭包算法，旧 raw 及聚合 gzip 数值逐字节复现。聚合 gzip 统一使用 level 6；早期 HTML 单项的 level 9 不混入比较。

| 依赖闭包 | 改前 raw | 改后 raw | 降幅 |
|---|---:|---:|---:|
| 初始 JS | 6,705,081 B | 5,063,115 B | 24.49% |
| 初始 + Chat | 9,368,590 B | 8,330,944 B | 11.08% |
| 初始 + 首段普通流式正文 | 14,739,296 B | 8,345,604 B | 43.38% |
| FlowToken 普通正文额外加载 | 5,370,706 B | 14,660 B | 99.73% |

初始 JS 数量从 36 降至 29 个；gzip 从 2,012,801 B 降至 1,496,710 B（25.64%）。初始闭包中不再包含 Milkdown、Recharts、D3，KaTeX 仍在。约 5.355MB 的代码高亮实现仍以独立动态 DefaultCode chunk 保留，实际代码节点需要时才加载。

这是特定入口的代码依赖量，不是安装包总大小或冷启动秒数。证据：`build-closure-comparison.json`、`compare-build-closures.mjs`、`vite-build-optimized.log`。

已有包体检查器也使用旧、新真实产物验证。全部 JS gzip9 为 10,255.7→10,249.7 KiB，仍超过原上限 8,560.6 KiB，原告警保留。总包体没有大幅下降，本轮主要减少首屏和普通流式路径必须加载的代码。证据：`bundle-check-original.log`、`bundle-check-optimized.log`。

### 数据库等待与持久化

独立 VFS SQLite 持有 `BEGIN IMMEDIATE` 写锁 3 秒，同时通过真实桌面 IPC 调用创建 Todo 列表及 `get_app_version`。列表写入耗时 **3,016ms**，100ms 后发出的轻量 IPC 在 **2ms** 返回；写请求没有把轻量命令一起拖入秒级等待。证据：`implementation-native-ipc-lock-async.json`。

首次旧验证脚本因 Vite 页面重载失去待返回结果，不作为失败或性能证据。重测使用独立标题及分开记录的 promise，确认实际写入完成；没有把超时当成未写入而盲重试。

生产迁移后的 SQLite 持久化回归通过：连续添加 50 个块并中间保存 50 次，触发器观察到 **50 次 payload 写入**。旧的“每轮写全部块”算法对此输入累计为 1,275 次，这是算法计数对照，并非整个 pipeline 的耗时倍数。还验证了同 ID 替换、外部 Anki 保留、语句失败回滚、延迟外键导致 COMMIT 失败，以及后续成功重试。

历史读取仍扫描轻量 ID，但不再先物化所有历史大 JSON；中间保存仍更新消息元数据，最后仍完整 flush。因此不宣称整个管线已严格线性或完全无重复 I/O。

### OCR 真实验收发现的额外入口

真实隔离实例上传 6 份各 4 页扫描 PDF，即使 `ocr.enabled=false` 且 `indexing.enabled=false`，本地延迟 OCR 服务仍观察到 **峰值 18 个在飞请求，最终 24 次完成**。准确调用链为：上传启动 PDF 处理 → 主 OCR 正确跳过 → Stage 4 自动索引忽略关闭设置 → 索引发现缺少文本 → 每文件 3 并发 OCR 兜底。它绕过了第一批仅在 PDF 处理服务中的 4 槽限制，不是上传预解析直接发出的请求。

`8c8714ab7` 已针对这一真实缺口追加修复：共享许可由应用复用的 `LLMManager` 持有，PDF/图片服务及索引兜底三个调用点获取同一组许可；LLM 请求方法内部不重复获取，避免嵌套死锁。索引主连接和页/图片分支连接在等待许可与网络前释放，自动索引入口遵守 `indexing.enabled`。

新原生实例已确认版本 `0.9.68 (Build 15145, 8c8714ab)` 及独立资料库路径。随后验证桥连纯 JS 请求也超时，系统检查明确报告 Mac 已锁屏。复测停止在上传前预检：没有上传新文件、没有修改新测试设置、mock 请求数为 0。两次本地 mock 均已停，Tauri 及 bridge 保留以便解锁后继续。

待解锁后执行的真实验证已备好：A 两开关关闭时 0 请求；B 六份新扫描 PDF 的索引兜底峰值不超过 4；C 槽位占满时主 PDF 排队取消不发请求且无延迟 OCR 写回；D 释放后完成原 24 页和额外新 4 页，验证许可归还。脚本已做语法检查，**尚未跑过这些修复后断言**。

证据及复测入口：

- `ocr-live/before-summary.json`、`ocr-live/before-final-mock-state.json`
- `ocr-live/after/verification-blocked.json`
- `ocr-live/after-drive.mjs`

## 编译与回归

- macOS `cargo check --lib` 通过；真实 Tauri dev 原生二进制构建并运行成功。
- 两批相关 Rust 测试分别 **18/18**、**58/58** 通过，共 **76 项**。包含检索范围/别名、Todo blocking 线程与错误、OCR permit/取消、图片策略、真实数据库备份还原、ZIP 检查点、JSON 往返、历史压缩/replay、增量持久化、文件加密同步和 SAF 队列。
- 前端定向 TypeScript 检查通过；去除重复统计后，22 个相关文件共 **257 项**通过：搜索 Worker/隐藏会话 25、schema/启动 143、FlowToken/动画 25、任务面板 28、Markdown 身份相关 22、图片 6、搜索可见性相关 8。最终生产 Vite 构建成功（41.04s）。构建仍报告大 chunk 警告，不将“构建成功”解读为所有包体均已足够小。
- Android 原生生成工程在 JDK 17 / SDK 36 下 `:app:compileUniversalDebugKotlin` 通过。检查的是当前 SAF 实现，不使用旧 APK 代替当前版本验证。
- Android Rust `cargo check --lib --target aarch64-linux-android --no-default-features --features mobile-slim --locked -j 2` 通过（5m10s，NDK 27 clang / API 24，`CARGO_INCREMENTAL=0`），包含 SAF Android 条件编译分支。未构建完整 APK、链接或安装真机。
- 索引 OCR 补充修复后，macOS `cargo check --lib` 再次通过，两个相关 shared/cancel 回归再次通过，Android 同一 `mobile-slim` 检查再次通过（1m24s）；没有重复运行不相关测试。

主要日志：`implementation-cargo-check.log`、`implementation-cargo-check-2.log`、`implementation-rust-tests.log`、`implementation-rust-tests-2-retry.log`、`frontend-final-typecheck.log`、`vite-build-optimized.log`、`implementation-android-saf-kotlin.log`、`implementation-android-rust-check.log`。

补充 OCR 修复日志：`implementation-ocr-shared-check.log`、`implementation-ocr-shared-tests.log`、`implementation-ocr-shared-android-check.log`、`implementation-tauri-ocr-final.log`。

构建期间磁盘曾耗尽，已停止自有竞争构建，只清理可重生的本仓库 Rust incremental 缓存，之后使用 `CARGO_INCREMENTAL=0`。补充 OCR 修复再次编译前，还清理了本仓库旧代码生成 `.rcgu.o` 与静态归档缓存以腾出空间。没有删除源码、用户数据或他人的构建目录。

## 尚不能据此得出的结论

1. 没有 Windows 运行环境，也没有当前版本 Android 真机连接。WebView2/Android Worker 生命周期、SAF 授权生命周期、低内存、耗电及 release p50/p95 仍需设备实测。
2. 本轮 JS 包体、开发版帧间隔、SQLite 回归分别证明不同机制，不等价于最终安装包体积、release 启动耗时或整机内存收益。
3. 手工 JSON 同步仍持有完整变更对象图，只去掉额外 clone/string 副本；文件同步已 offload，但同步记录 payload/tombstone codec 不在本轮文件 offload 范围。
4. 搜索继续保留既有 grapheme/NFKC/lowercase 规则，包括二轮记录的希腊词尾 sigma 行为；性能改动没有暗中修订 Unicode 匹配语义。
5. 缓存、材质、连接池、启动维护调度等后续调参应由真机 trace 决定。本轮实现是当前证据下的简洁方案，不作“所有平台绝对最优”承诺。
6. 索引阶段已经进入 `index_resource` 后仍保留原有中途取消语义，没有强制丢弃整个 future 或新增 Lance/Units 状态恢复机制。排队取消验证针对主 PDF 处理服务，不能外推为完整索引过程任意时刻都可立即取消。
