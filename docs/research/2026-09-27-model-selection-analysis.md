# DeepStudent 模型选择深度分析与优化方案

> 审阅基线：`ecaed019921ec6ec122c629ef6cebbf66d81d980`。本文记录代码审计、外部资料边界和本分支的实施方案。用户要求本轮不运行测试；本文也不把未执行的运行验证写成事实。

## 结论

DeepStudent 当前模型选择的问题首先是身份和状态不一致，其次才是模型参数覆盖不足。模型选择入口至少同时使用全局默认、会话固定模型和会话 override 三种语义；不同入口又各自加载配置、供应商排序和能力字段。直接把 models.dev 的数据覆盖到现有布尔字段，或只在一个选择器里增加“最近选择”，都会放大冲突。

models.dev 适合作为独立的公共模型目录和参考元数据层，适合补充模型名称、上下文、输出上限、输入模态、推理和工具调用标签、参考价格及更新时间。它不能替代 DeepStudent 的供应商连接配置、凭据状态、协议选择、适配器兼容性和用户显式覆盖。第一阶段应只用于展示、搜索和建议，网络不可用时不能阻塞 Chat。

## 当前选择链路

1. `modelAssignments.model2_config_id` 是全局默认。
2. `chatParams.modelId` 与 `modelIdPinnedByUser` 表示会话固定模型；未固定会话中的 `modelId` 可能只是旧显示快照。
3. `chatParams.model2OverrideId` 是运行时优先级更高的会话覆盖。
4. 工具栏快速模型菜单在 `ComposerToolbar` 内嵌实现，经 `InputBarV2.handleSelectRuntimeModel` 进入 `handlePickSingleModel`。
5. 桌面、移动端和比较/重试面板主要使用 `ModelPicker`；`RuntimeModelMenu` 和 `MultiSelectModelPanel` 在当前源码中未发现实际挂载调用方。
6. `@模型` 的 chips 路径和面板路径最终可能写入不同的状态字段，这正是旧 override 压过新选择的来源。

## 已确认的冲突

### 1. 新的 @模型选择可能被旧 override 覆盖

模型面板先选 A 后，`model2OverrideId` 为 A；随后 `@模型` 或只剩一个比较模型 B 时，发送路径更新 `modelId=B`，但不清理 A。运行时适配器仍优先采用 A。优化分支将单模型发送路径改为同时写入新的显式选择和对应 override，并保持已有的会话固定语义。

### 2. UI 候选集与后端生成资格不一致

多个前端路径只排除 embedding/reranker；图像生成、专用 OCR 和 ASR 模型仍可能进入普通 Chat。后端上下文编译器会另外排除图像生成和专用 OCR。优化分支引入共享聊天模型资格谓词，并让运行时合法 ID 校验使用同一规则；未知字段仍保留现有失败回退语义。

### 3. 运行时能力合并无法表达显式关闭

Rust 当前把 profile、内置目录和注册表能力用布尔 OR 合并。用户显式关闭能力后，注册表的 `true` 仍可能重新打开它。该问题需要 `auto/enabled/disabled` 三态和历史数据迁移；本分支不在没有运行验证的情况下改变 Rust 能力语义，而是在下面的后续方案中保留为独立工作包。

### 4. 供应商作用域匹配不互斥

当前注册表评分在 provider scope 不匹配时只是不加分，不会排除记录。相同模型名跨供应商时，可能继承另一渠道的上下文或能力。引入更大的公共目录前，必须先规范供应商 ID，先按供应商过滤，再处理精确 ID、别名和通用记录。

### 5. 缓存、收藏和附件还有一致性风险

多个选择器重复请求配置，异步旧响应可能覆盖新结果；异步多模态判断在非空缓存时还可能跳过 TTL。模型编辑的双向转换没有完整携带 `isFavorite`，保存后可能丢收藏。附件默认模型在未固定会话中可能仍使用旧 `modelId`。优化分支优先修复这些高置信度、低侵入问题。

## 最近选择设计

最近选择应保存本地可调用模型配置的稳定 ID，而不是公共目录模型 ID、模型显示名或 URL。建议存储：

```json
{"version":1,"ids":["model-config-id"]}
```

规则：

- 最多保留 8 项；重复选择移到最前。
- 仅在用户明确选择时写入；加载、恢复、自动默认、收藏和搜索不写入。
- 比较模式新增可以记录；取消选择不记录；重试只有确认后记录。
- 读取时与当前可用聊天模型求交集；删除或禁用后不展示，历史值可延迟清理。
- 搜索仍覆盖完整列表，不能被最近分组截断。
- 最近与收藏分离，近期条目显示供应商名。
- `localStorage` 损坏、不可用或超额时不阻断模型选择。
- 使用模块级快照和 `useSyncExternalStore`，保证工具栏、面板和多窗口读取一致。

## models.dev 评估

当前可确认的公开页面维度包括模型标识、Lab、Providers、Context、Output、文本/图像/音频/视频/PDF 输入、Reasoning、Tool Call、Structured、Temperature、Weights、价格、Release 和 Updated。它的价值在于统一公共模型描述，尤其能补充本地手工注册表缺少的来源、时间和模态维度。

当前本地 `scripts/model-capability-registry.json` 有 124 条记录、121 个唯一模型 ID；仅 21 条同时有 `source_url` 和 `verified_at`，仅 7 条声明 `provider_scope`。因此数据覆盖和来源质量都不足以让公共目录直接成为路由权威。

仍需在正式接入前核实的 models.dev 项目事实包括：许可证、价格单位与计费语义、更新策略、缺失字段含义和 provider/model 主键的长期稳定性。本报告将已观察到的 API 字段用于分析，但不把公共目录字段直接当作 DeepStudent 的执行协议。

推荐来源优先级：

```text
用户显式覆盖
→ 当前 endpoint 的已验证信息
→ 项目内置且带 provider scope 的例外
→ models.dev 的 provider+model 精确匹配
→ models.dev 通用模型记录
→ 启发式
→ unknown
```

目录能力不能自动启用 thinking、工具调用、response format 或协议切换；这些仍由供应商、适配器和用户配置决定。价格应展示为参考价格，并区分未知和明确的零值。

## OpenChamber 对照结果

本次对照使用 [OpenChamber `main` 的固定 commit `60d836c4893b6b694610b5b0277be54111359428`](https://github.com/openchamber/openchamber/tree/60d836c4893b6b694610b5b0277be54111359428)（MIT）。模型目录数据来自 [models.dev API](https://models.dev/api.json)，项目基线是 [DeepStudent](https://github.com/helixnow/deep-student)。关键实现位置和结论如下：

- `packages/web/server/lib/opencode/models-metadata.js` 请求 `https://models.dev/api.json`，helper 默认 TTL 为 10 分钟、超时 8 秒；打包服务通过 server 配置将实际 TTL 覆盖为 5 分钟。进程内 shared cache 与 in-flight single-flight 防止重复请求，失败时优先返回 stale cache。
- OpenChamber 的 server route 将目录请求代理到 `/api/openchamber/models-metadata`，成功响应使用短期 Cache-Control，超时与上游错误分别返回明确的 504/502；这避免浏览器直接依赖 models.dev，并把失败边界留在服务端。
- `packages/ui/src/lib/modelIdentifier.ts` 使用 `providerID/modelID#variant` 作为模型身份；`packages/ui/src/hooks/useModelLists.ts` 的收藏和最近列表都使用 provider 与 model 的复合身份。
- `packages/web/server/lib/opencode/settings-helpers.js` 对 favoriteModels 保留最多 64 项、recentModels 最多 16 项，并在设置保存时清洗结构。
- `ModelPickerList.tsx` 将 Favorites、Recent 和按 provider 的完整列表分组，搜索覆盖 provider、模型名和 ID。生产构建的最近列表展示截断为 5 项。
- OpenChamber 的 small-model resolver 只把运行时 provider 返回的 enabled/active、支持文本输入和输出的模型当作可用候选，再利用 models.dev 的 family、发布时间和能力做排序；自定义模型没有 family 时才按 ID 启发式推断。它还保留会话 provider 优先和 fallback 来源，避免把公共目录存在误当成当前账户可调用。
- OpenChamber 的 runtime model list 缓存按 directory/连接作用域区分，短暂刷新失败时保留同作用域旧列表；DeepStudent 后续接入公共目录也应把连接 profile 纳入缓存键，并让 metadata 失败不撤销已验证的本地能力。

这说明 models.dev 应作为可缓存的公共目录层，最近/收藏应绑定供应商和模型的复合身份。DeepStudent 当前以本地配置 ID 记录最近选择是安全的，因为配置 ID 已经区分供应商连接；未来引入公共目录时必须升级为 `connection/profile + provider + model + variant`，禁止裸模型名跨供应商复用。

外部源码和 API 的核验依赖网络；本地缓存副本已用于核对上述文件。若后续无法访问 upstream，应将该 commit 和本地副本视为本次分析的证据边界，不把安装包内容当作 upstream 源码。

## 本地 provider scope 风险证据

`src-tauri/src/llm_manager/builtin_vendors.rs` 将内置通义千问供应商标为 `provider_type: "qwen"`，而 `scripts/model-capability-registry.json` 中 qwen3.5-plus/flash 的记录标为 `provider_scope: "bailian"`，另有 SiliconFlow 的同名或相近记录。当前 `normalize_provider_scope` 只做 trim/lowercase，注册表评分对作用域不匹配只减少分数而不淘汰记录。相同裸模型 ID 因此可能继承错误供应商的能力或参数。

在第二阶段应建立 canonical provider scope 映射（至少覆盖 `qwen`/`bailian`），并对带明确作用域的记录执行先过滤后评分；只有通用记录才允许作为跨供应商 fallback。

## 分阶段优化方案

### 本分支（高置信度、低侵入）

- 创建独立分支 `codex/model-selection-optimization`。
- 共享可用聊天模型目录、过滤和刷新逻辑。
- 将设置页的聊天模型分配候选也接入统一资格谓词，同时保留当前已分配禁用项的可见性。
- 修复单选/`@模型`/比较模式的旧 override 冲突。
- 修复附件使用的实际模型 ID和运行时合法 ID过滤。
- 保留收藏字段。
- 在真实工具栏和 ModelPicker 入口增加最近选择。
- 对最近选择使用版本化 localStorage、最多 8 项、配置 ID 去重，并通过 `useSyncExternalStore` 同步多个入口；存储损坏或不可用时不阻断选择。

### 第二阶段（需要迁移与人工重点验收）

- 引入 capability 三态与来源追踪。
- 让 provider scope 在匹配时互斥，并建立 `bailian/qwen` 等规范化映射。
- 将最近/收藏身份迁移为 `connection/profile + provider + model + variant`，并在迁移期间拒绝裸模型名的跨供应商恢复。
- 区分 requested/resolved model ID 和回退原因。
- 统一普通 Chat 与 persona strict 的 fallback 解释。

### 第三阶段（公共目录）

- 固定 models.dev 数据版本和许可证。
- 新增独立 `CatalogModel`/`CatalogDeployment`，不覆盖本地 profile ID。
- 先本地快照和后台刷新，再提供参考信息和人工应用入口。
- 对 provider+model 精确匹配、别名匹配、通用匹配和未匹配分别统计覆盖率。
- 只有经过人工审核的映射，才允许参与能力建议。
- 采用 models.dev 类似的 TTL、超时、single-flight 和 stale-cache 策略；目录请求失败不能阻塞现有本地模型选择。

## 人工验收清单

1. 面板选 A，再用 `@模型` 选 B，确认实际发送 B。
2. 对比选 A/B，移除 A，确认只发送 B。
3. 多模型重试后切换到单模型重试，确认没有残留并行选择。
4. 未固定会话切换全局默认，确认显示、推理和附件模式同步。
5. 固定会话后切换全局默认，确认固定模型不变。
6. 禁用/删除模型或移除凭据，确认各入口和发送资格一致。
7. 生图、专用 OCR、ASR 不进入普通 Chat 候选。
8. 收藏模型后编辑并保存，确认收藏保留。
9. 选择 9 个不同模型后确认最近列表淘汰最旧项；重复选择只置顶。
10. 搜索时仍能找到完整可用列表；损坏 localStorage 不阻断选择。
11. 键盘、移动端返回键和重试确认入口保持可用。
12. persona 严格模型不可用时仍明确失败，不被普通回退替代。
