# Deep Student Debug Bench 维护者题目目录

本文件含修复提交、生产入口与测评边界，只供维护者使用，不得放入被测 Agent 的工作目录。候选 Agent 只接收物化后的缺陷仓库和题面；`private/`、本目录文件、历史说明及原始 Git 历史都属于答案侧材料。

## 当前规模与解释口径

当前有 **34 个任务包**：后端/协议/同步 10 题、笔记/编辑器/导图/闪卡 12 题、聊天/附件/会话 12 题；对应 **28 个唯一修复提交**。一个提交可含多个不同缺陷，一组相同模块的题也可能来自不同提交。因此“任务数”“唯一提交数”和“独立事故数”不可互换，本版不声称有 34 个独立历史事故。

难度为维护者预估，尚未经过多种 Agent 的实测通过率校准：1 级 2 题、2 级 11 题、3 级 18 题、4 级 3 题。1 级主要检查局部协议/身份契约；2 级需要连接少量生产边界；3 级涉及跨模块生命周期、状态权威或文本映射；4 级聚焦异步 ABA、持久化迁移或历史窗口竞态。代码改动少不意味着阅读范围小。

下表“参考变更行”是当前缺陷回移补丁的 **新增行+删除行**，包括少量邻近注释变化，不含隐藏测试和整个历史提交的其他改动；它是任务量参考，不是强制最优解行数。当前范围 1–201 行；跨整个历史大重构的题不纳入。所有题采用 `historical_backport`：在同一锚点上移植有提交 diff 证据的旧行为，未承诺逐字恢复当时整个工程。

## 任务表

完整 SHA、题面、预计用时和证据在各题 `case.json`；表内用 9 位 SHA 便于浏览。“未建立补修链”只表示未收集到该题相同根因的多轮证据，不能据此称其历史上一次就成功。

### 后端、协议与同步

| ID / 题目 | 类型 | 难度 | 参考变更行 | 修复 SHA | 补修证据 / 同源家族 | 机器实际执行的生产范围 |
|---|---|---:|---:|---|---|---|
| DS-B01 标准 MCP 服务的工具和能力无法加载 | `protocol_serialization` | 2 | 25 | `3185361c3` | MCP 家族；不同协议断点，非同根因反复失败。 家族：`mcp-wire`。 | Rust 完整 `mcp/client.rs` 的协议类型；标准 wire JSON 反序列化/序列化。无外部 MCP 服务。 |
| DS-B02 无参数 MCP 请求在严格服务端挂起 | `protocol_serialization` | 1 | 6 | `71d22c6f9` | MCP 家族；后续发现的 params:null 兼容性缺口。 家族：`mcp-wire`。 | Rust 同模块 JSON-RPC 请求/通知的 None/Some/missing 参数；无远程握手。 |
| DS-B03 MCP 服务变更通知被静默吞掉 | `protocol_dispatch` | 3 | 201 | `3e5d8394a` | MCP 家族；envelope 判别/通知方法名的独立缺陷。 家族：`mcp-wire`。 | Rust 同模块真实接收/分发路径；本地传输夹具驱动通知、响应与等待请求。 |
| DS-B04 薄弱卡片排序打断到期学习步骤 | `scheduling_priority` | 2 | 17 | `1a66bd145` | 未建立同根因补修链。 | Rust `mastery/bias.rs` 排序/到期偏置；不运行完整复习 UI。 |
| DS-B05 长事件的细粒度流式分片导致解析停顿 **候选：需 Linux 性能校准** | `algorithmic_performance` | 3 | 34 | `b1397c5d6` | 未建立同根因补修链。 | Rust `utils/sse_buffer.rs` 与 UTF-8 decoder；固定长事件/细分片负载，release 计时。 |
| DS-B06 历史卡片归一化升级触发唯一键冲突 | `database_migration` | 4 | 44 | `6aec93509` | 未建立同根因补修链。 家族：`sync-squash`。 | Python sqlite3 在真实 SQLite 表/唯一索引上执行生产迁移 SQL。 |
| DS-B07 同步前检遗漏设备状态与派生表 | `schema_evolution` | 3 | 120 | `23abd4b26` | 23abd4b26→977f2c979：后续表演进补齐，不等于原修复失败。 | Rust `sync/classification.rs` 完整表分类 API；不执行真实跨设备同步。 |
| DS-B08 合法下调的统计值在同步后反弹 | `distributed_merge_semantics` | 3 | 51 | `6aec93509` | 未建立同根因补修链。 家族：`sync-squash`。 | Rust `sync/field_merge.rs` 合并注册表与策略；不连接云端。 |
| DS-B09 跨平台同步把不同资产文件名折叠成同一键 | `filesystem_encoding` | 3 | 19 | `6aec93509` | 未建立同根因补修链。 家族：`sync-squash`。 | Rust `sync/asset_filenames.rs` 编解码与旧键兼容；不读写真实云资产。 |
| DS-B10 一次操作超时后同一按钮永远无法重试 | `async_lifecycle` | 3 | 15 | `7e6d89c25` | 未建立同根因补修链。 | 生产 generative-ui action 包装/超时/冷却/遥测；虚拟时钟控制异步时序。 |

### 领域：笔记、导图与闪卡

| ID / 题目 | 类型 | 难度 | 参考变更行 | 修复 SHA | 补修证据 / 同源家族 | 机器实际执行的生产范围 |
|---|---|---:|---:|---|---|---|
| DS-D01 长笔记分窗保存吞掉边界空行 | `notes/data-integrity` | 2 | 12 | `0aaa70a29` | 未建立同根因补修链。 | 生产 `composeWindowedSave` / `expandMarkdownWindow`，真实 Markdown 输入与逐字结果。 |
| DS-D02 设置批量写入失败后错误补偿 | `settings/transaction-compensation` | 3 | 18 | `f03a40f07` | 88a48fb67→f03a40f07：首次回滚遗漏可靠基线与补偿失败路径。 | 生产 `saveSettings` / `getSetting`；可失败的原生存储 IPC 夹具。 |
| DS-D03 Windows 笔记图片持久化后失联 | `notes/cross-platform-paths` | 2 | 6 | `7691dc8cd` | 未建立同根因补修链。 | 生产图片 uploader 与 URL proxy；File/base64 真实转换，落盘/读取 IPC mock。 |
| DS-D04 富文本搜索结果与用户看到的文本不一致 | `editor/text-projection` | 3 | 15 | `062870732` | 未建立同根因补修链。 | 真实 ProseMirror Schema/EditorState/Transaction 与生产搜索/全部替换。 |
| DS-D05 全局导航快捷键抢走编辑器输入 | `input/event-ownership` | 2 | 13 | `f7f696803` | 未建立同根因补修链。 | 真实 React hook 与 DOM 键鼠事件；无原生 OS 输入法进程。 |
| DS-D06 同一导图重载后被旧保存回执污染 | `mindmap/async-save-aba` | 4 | 2 | `482201b2e` | 未建立同根因补修链。 家族：`mindmap-ownership`。 | 真实 MindMap Zustand store 保存回执；可控异步 API 夹具制造同 ID 重载。 |
| DS-D07 退出或新建导图后迟到加载夺回界面 | `mindmap/async-load-lifecycle` | 3 | 5 | `482201b2e` | 未建立同根因补修链。 家族：`mindmap-ownership`。 | 同 store 的 load/create/reset/destroy；可控异步 API 夹具制造导航竞态。 |
| DS-D08 AI 正则编辑绕过笔记输出大小上限 | `notes/bounded-transformation` | 3 | 41 | `2c2ae0384` | 未建立同根因补修链。 | 生产 `computeProposedContent` 正则/普通替换；真实 UTF-8 输出。未调用 LLM。 |
| DS-D09 卡片模板中的数学公式停留在原始标记 | `anki/template-rendering` | 2 | 2 | `681e1e128` | 未建立同根因补修链。 家族：`anki-face`。 | 真实 `AnkiTemplateCardFace`→隔离 iframe srcdoc→DOMParser，检查 MathML/净化。 |
| DS-D10 导入 Cloze 卡模板缺失时泄露正面答案 | `anki/cloze-fallback` | 3 | 5 | `681e1e128` | 未建立同根因补修链。 家族：`anki-face`。 | 同真实组件的缺模板/有模板 Cloze 正反面；不连接 Anki。 |
| DS-D11 复习用时只统计翻面后的几秒 | `flashcards/measurement-contract` | 2 | 6 | `714ebad81` | 未建立同根因补修链。 | 真实 FSRS review store.rate→IPC 参数；评分后队列和状态真实运行。 |
| DS-D12 笔记改名后部分双链遗漏却报告全部同步 | `notes/bounded-scan-reporting` | 2 | 2 | `4c97052b8` | 未建立同根因补修链。 | 真实双链发现/重写/汇总链；来源搜索与 DSTU IPC mock，保留并发版本参数。 |

### 聊天、附件与会话

| ID / 题目 | 类型 | 难度 | 参考变更行 | 修复 SHA | 补修证据 / 同源家族 | 机器实际执行的生产范围 |
|---|---|---:|---:|---|---|---|
| DS-F01 图片已上传但发送门控仍等待 | `attachment_readiness` | 2 | 35 | `3df6f8878` | aaa90fbb0→784964fb9→3df6f8878：无状态回退后继续补 readyModes 空路径。 | 生产附件就绪/缺失模式计算函数；图片与 PDF 模式输入。 |
| DS-F02 删除一个附件导致其他引用一起失效 | `shared_resource_lifetime` | 3 | 11 | `00ca3c7ca` | 未建立同根因补修链。 | 真实 chat store 附件移除；同/跨会话持有者、资源取消与 blob 清理。 |
| DS-F03 迟到的流式块落到回答末尾 | `stream_ordering` | 3 | 25 | `3e3a47087` | 未建立同根因补修链。 | 真实 `createBlockInternal`，真实块集合/顺序；不渲染消息列表。 |
| DS-F04 切换会话后旧流污染新会话 | `event_isolation` | 3 | 11 | `1d2302e59` | 未建立同根因补修链。 家族：`chat-recovery`。 | 生产 eventBridge 与 eventRegistry；真实事件序列消费，宿主边界受控。 |
| DS-F05 旧历史损坏记录破坏消息块关联 | `history_recovery` | 3 | 16 | `1d2302e59` | 未建立同根因补修链。 家族：`chat-recovery`。 | 生产 restore actions 恢复记录图；资源存在查询与通知 mock。 |
| DS-F06 忙碌会话释放后缓存持续超限 | `cache_lifecycle` | 3 | 6 | `46ff59dfe` | 未建立同根因补修链。 | 真实 SessionManagerImpl 回收/租约/淘汰；chat store 与 adapter/save 为受控替身。 |
| DS-F07 未固定模型的旧会话不跟随默认值 | `model_configuration` | 3 | 5 | `15b904309` | 15b904309→471082dd2：运行时固定语义与 UI 身份分别修复。 家族：`model-identity`。 | 真实 TauriAdapter 模型选择归一化；模型设置与 IPC mock。 |
| DS-F08 同名模型显示了错误供应商 | `model_identity_ui` | 3 | 6 | `471082dd2` | 同 F07 链；后续补同名供应商显示，不是路由修复被推翻。 家族：`model-identity`。 | 真实 InputBarV2 选择逻辑并观察 runtimeModelProviderLabel；InputBarUI/非目标 hook mock。 |
| DS-F09 未激活模板引起产物错误降级 | `skill_scope` | 2 | 1 | `54abb2fa7` | 未建立同根因补修链。 家族：`artifact-scope`。 | 生产活跃技能查找与骨架校验；真实技能/intent 输入。 |
| DS-F10 不同工具命名通道缺失字段差异预览 | `tool_protocol_normalization` | 1 | 5 | `54abb2fa7` | 未建立同根因补修链。 家族：`artifact-scope`。 | 生产 Anki 更新参数识别与字段差异函数；工具别名/无效参数输入。 |
| DS-F11 分组移动期间侧栏出现重复会话 | `pagination_identity` | 2 | 7 | `6c1903ccc` | 未建立同根因补修链。 | 真实 useSidebarSessionData hook；IPC 分组/未分组结果夹具。 |
| DS-F12 历史补载竞态让窗口跳过消息 | `async_history_pagination` | 4 | 64 | `3d3972aa8` | 3d3972aa8→a61b3bf50：后者补搜索提示/测试，不当作补载修复失败证据。 | 真实 TauriAdapter 历史补载方法；deferred IPC 与受控 store/事件边界。 |

## 同源家族与分数解释

- **MCP：B01/B02/B03**。三个不同协议缺陷共享 `mcp/client.rs`：字段命名、无参数序列化、接收信封分发。阅读/修复其中一题可能降低另外两题的定位难度。
- **导图异步所有权：D06/D07**。同一历史提交、同一 store。D06 检查同 ID 重载后的旧保存结果；D07 检查 reset/destroy/create 对加载所有权的交接。
- **Anki 卡面：D09/D10**。同一组件、同一提交；模板数学与缺模板 Cloze 是不同可观察失败。
- **聊天恢复：F04/F05**。同一提交，分别为实时跨会话事件隔离与持久化图损坏恢复。
- **模型身份：F07/F08**。相邻提交、同一产品问题域，分别检查发送路由和显示选择。
- **产物/工具审批：F09/F10**。同一提交内的两个不同缺陷，不可重复计为两次独立修复迭代。
- **同步 squash：B06/B08/B09**。同一个保留的 squash 提交包含迁移冲突、合并语义和文件名编码三项修复；没有保留的独立子提交可供重建。B07 与其共享同步领域，但有独立演进证据。

主分仍可按任务严格通过率计算，但比较 Agent 时应同时披露这些家族的逐题结果。训练/调参集与最终保留集应按家族整体划分，不能把同一家族的一题作为示范、另一题当作完全未知保留题。家族划分只是结果解释和拆分约定，不是按关键词或调用次数限制 Agent 的运行守卫。

## 机器证据的边界

每题需在同一物化方式下对“缺陷”和“参考”两份工程做差分校准：至少一项 FAIL_TO_PASS、至少一项 PASS_TO_PASS，且参考工程全部通过；候选修复必须通过校准时的完整测试清单。以各题生成的 `calibration.<engine>.json` 为正式准入和计分依据，不把提交标题或提交者声称的验证视为本次执行结果。

领域 12 题已在本机独立锚点快照验证：正常 39/39 通过；逐题缺陷共 24 个 F2P 失败、15 个 P2P 通过；恢复后 39/39 通过，明细见 `private/domain/validation.json`。聊天题本地生产模块验证记录位于各题 `verification`。容器适配和 Rust 适配的统一校准结果应另行生成，不由这些本地记录自动推断。

这里运行的是真实生产模块行为，但范围不是完整桌面端端到端测试：IPC、云服务、通知和非目标 UI 边界使用可控夹具；Rust harness 通过 `#[path]` 编译完整生产模块，不复制被测函数；B06 使用真实 SQLite 执行 SQL。B05 的性能门槛对机器敏感，目前明确标为候选，须在固定 Linux 资源配额上重复校准后才能纳入正式跨模型总分。

## 覆盖短板

本版偏向“广泛定位、局部修复”，不是通用代码生成测评。当前对以下能力覆盖有限：完整 Rust/Tauri 工程构建、原生窗口与移动设备操作、真实云同步故障、真实 MCP/Anki/OCR 外部服务、视觉与可访问性回归、内存泄漏与长期稳定性、大规模重构、没有题面症状的开放式缺陷发现。题面给出可观察症状，因此主要衡量**有线索的诊断洞察与修复能力**，不能单独证明 Agent 能在无提示审计中发现未知漏洞。

未纳入的大重构和原生/外部链路候选，以及为什么不把“多次补修”讲成“之前全部失败”，见 `HISTORY.zh-CN.md`。
