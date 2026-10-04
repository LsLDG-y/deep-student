# DeepStudent 对外口径

> 官网（ds-web）、宣传片（video 分支）、README（中英）三处文案的唯一事实来源。
> 改任何一处对外文案前先对照本文；本文与代码冲突时以代码为准，并回头修正本文。
> 更新日期：2026-10-04（v0.10.0）

## 1. 定位

| 层级 | 中文 | English |
|---|---|---|
| 口号 | **只专注学习本身就够了，剩下的都交给我。** | **Just focus on learning. Leave the rest to me.** |
| 口号（短版，版面受限时） | 专注学习本身，剩下的交给我。 | Focus on learning. Leave the rest to me. |
| 品类 | 开源、本地优先的 AI 学习工作台 | An open-source, local-first AI learning workbench |
| 主张 | 一个学习 Agent，能直接操作你学习桌面上的每一个应用。 | A study agent that works directly in every app on your Study Desktop. |

- 口号里的「我」是 DeepStudent 的学习 Agent。第一人称只用在口号，正文一律用第三人称「它 / Agent」。
- 主角是 **Agent**，资料是它工作的对象，不是卖点本身。不要再写成「围绕资料问答的工具」。
- 首屏标准组合（官网首屏、README 标题下）：

  > **只专注学习本身就够了，剩下的都交给我。**
  > DeepStudent 是开源、本地优先的 AI 学习工作台。它的学习 Agent 能直接操作笔记、思维导图、题目集、闪卡和待办，把整理、出题、制卡和复习安排都替你做好。

## 2. 三条支撑 + 底座

各渠道按此顺序讲；每条给出可直接引用的证据点。

### ① 能动手 —— Agent 直接操作学习桌面上的应用

说一句话，它去写笔记、建思维导图、出题、制卡、排复习、建待办、做调研。

- 每个应用都有 Agent 读写工具：笔记、思维导图、题目集、闪卡 / FSRS、待办、作文批改、翻译、模板、设置、备份（`docs/Agent工具面总览.md` §2）
- 操作学习桌面窗口：打开应用、观察界面、执行动作（`builtin-workbench_*`）
- 调研模式：检索、阅读文献、成稿写入笔记；论文下载入库并建立索引
- 浏览器自动化（Windows / macOS）、沙箱本地 shell、生成 Word / PPT / Excel 文件

### ② 可托付 —— 长任务自动推进，每一步可审批、可撤销

- 目标模式跨轮自动续跑；子代理并行；定时自动化（`builtin-automation_*`）
- 操作按 Low / Medium / High 分级审批；Ask / Plan / Craft 三种权限模式
- 改动可撤销：笔记改动渐隐标注并留「撤销本次修改」，学习桌面操作带撤销令牌（`builtin-workbench_undo`）
- 回答带出处：引用可回溯到原文页码、句子或导图节点

### ③ 懂你，可扩展

- 记忆与学习者画像：记住薄弱点和学习习惯，后续回答会参考
- 55 个内置技能，可安装、可自己写；接入 MCP；13 家预置模型服务商，可按功能分配模型
- 同一问题可让多个模型同时作答

### 底座 —— 数据在本机，开源可核对

- 资料、笔记、聊天记录默认存本机；调用模型、外部搜索、MCP、云同步时相应请求才会离开本机（措辞沿用官网 privacy 区块，不得写成「完全离线」）
- AGPL-3.0-or-later

## 3. 硬数字

数字只能从这里取；发版前按「核对方式」复核。

| 项 | 当前值 | 核对方式 |
|---|---|---|
| 内置技能 | **55**（对外写「55 个」或「50 多个」，不写 40+） | `builtinSkills`（7，`src/features/chat/skills/builtin/index.ts`）+ `builtinToolSkills`（48，`builtin-tools/index.ts`）；browser-tools 仅 Win/macOS，其他平台 54 |
| 预置模型服务商 | **13** | `src-tauri/src/llm_manager/builtin_vendors.rs` 的 12 家 + Gemini（`scripts/gemini-model-registry.json` 注入） |
| 联网搜索引擎 | 7 | `src-tauri/src/tools/web_search.rs` |
| 翻译领域预设 | 7 | 翻译应用预设 |
| 平台 | macOS（Apple Silicon / Intel）、Windows x64、Linux x86_64（deb / rpm / AppImage）、Android ARM64；iOS 仅源码构建 | `.github/workflows/reusable-build-*.yml`；Linux **没有** arm64 |
| 许可证 | AGPL-3.0-or-later | `package.json` |
| 官网 / 文档 | https://deepstudent.cn ・ https://deepstudent.cn/docs/ | |

## 4. 术语表

以应用内界面名称为准（`src/locales/*/workbench.json` 的 `apps.*`）。

| 中文 | English | 不要写成 |
|---|---|---|
| 学习桌面 | Study Desktop | OS 模式、Workbench mode、工作台模式 |
| 学习 Agent / Agent | study agent / agent | AI 助手（泛称时可用「AI」） |
| 资源库 | Files | 学习中心、学习资源、Learning Hub |
| 对话 | Chat | |
| 笔记 | Notes | |
| 思维导图 | Mind Map | 知识导图 |
| 题目集 | Exam Set | 题库 |
| 闪卡 | Flashcards | |
| Anki 制卡 | Anki Cards | |
| 作文批改 | Essay Review | |
| 翻译 | Translation | |
| 待办 / 番茄钟 | Todo / Pomodoro | |
| 技能 | Skills | |

## 5. 文案语体

调研结论（Apple 中国、Notion、WPS AI、Goodnotes 产品页）：主流宣传文案是**主标题 + 副文案**两层，书面语。

- **主标题**：8–14 字，一句话说一个结论，句号收尾；可以有态度。
- **副文案**：一句完整书面陈述，交代具体事实（文件格式、算法名、数字），不写感受。
- **用词**：用「可、即可、自动、逐项、一并」；少用「就、也、了、吧、到底、讲讲」等口语虚词。
- **避免 AI 味**：句长全篇一致、对仗排比连用、「越 A 越 B」「不是…而是…」「一 X 就 Y」反复出现、只有形容词没有名词。同一篇里对仗句不超过两三处。
- **宣传片字幕**：主句读速 ≤ 4.5 字/秒；不显示章节编号；副文案晚主句约 0.3 秒出现，同时退出。

## 6. 各渠道落点

| 渠道 | 口号位置 | 结构要求 |
|---|---|---|
| README（中英） | 标题与 Logo 下第一行 | 首屏一张静态主图（学习桌面 + Agent 正在操作）→ Agent 一节 → 各应用 → 安装 → 开发者区。截图真机重拍，中英文界面各一套 |
| 官网 | 首屏主标题 | 学习桌面之后第一节讲 Agent；应用列表放后面 |
| 宣传片 | 片尾 Logo 下 | 字幕主语写「它」，让观众意识到动作是 Agent 做的；数字按 §3 |

## 7. 待修正的不一致（截至 2026-10-04）

- [x] 宣传片：片尾副标题（含「12 家」）删除；片尾口号换成 §1 口号；字幕第四版改为 Agent 视角（video 分支 c63a4d0e0）；画面内界面文案同步 main 的 locale（ffaf1cd8b）
- [ ] 宣传片：成片重新渲染（进行中）
- [ ] 官网 promo/（30 秒短片，未提交）核心概念仍是「统一数据层」旧口径，待定
- [x] 官网首屏换口号与品类、新增 Agent 一节、站内自有文案「知识导图」→「思维导图」（ds-web 分支 feat/messaging-agent 1b6eb65，未合并）
- [x] 官网：用户指南「知识导图」→「思维导图」、第 08 章改名（本仓库 8ec65cd21），ds-web 同步与英文应用名对齐（feat/messaging-agent 604fd26，未合并）
- [ ] 官网：首屏演示海报（AppShell）仍是旧侧栏（「学习资源」）；分享图需跑 `scripts/gen-share-images.mjs` 重出
- [x] README：事实与术语全部更正、中英重写（docs/readme-refresh 分支）；中文截图已真机重拍，英文截图进行中
- [x] 应用内：Agent 控制中心「题库 / Question bank」→「题目集 / Exam Set」（ea02573b2）
- [x] 应用内：`learningHub.json`（桌面快捷方式，宣传片画面里可见）与 `mcp.json` 的工具名仍写「知识导图」→「思维导图」（ea02573b2；模型侧 skill 描述里作为同义词保留）
