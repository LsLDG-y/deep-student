# DeepStudent 对外口径

> 官网（ds-web）、宣传片（video 分支）、README（中英）三处文案的唯一事实来源。
> 改任何一处对外文案前先对照本文；本文与代码冲突时以代码为准，并回头修正本文。
> 更新日期：2026-10-05（按 v0.10.1 核对；0.10.2 待发）

## 1. 定位

| 层级 | 中文 | English |
|---|---|---|
| 口号 | **只专注学习本身就够了，剩下的都交给我。** | **Just focus on learning. Leave the rest to me.** |
| 口号（短版，版面受限时） | 专注学习本身，剩下的交给我。 | Focus on learning. Leave the rest to me. |
| 品类 | 开源、本地优先的 AI 学习工作台 | An open-source, local-first AI learning workbench |
| 主张 | 一个学习 Agent，能直接操作你学习桌面上的每一个应用。 | A study agent that works directly in every app on your Study Desktop. |

- 口号里的「我」是 DeepStudent 的学习 Agent。第一人称只用在口号，正文一律用第三人称「它 / Agent」。
- 主角是 **Agent**，资料是它工作的对象，不是卖点本身。不要再写成「围绕资料问答的工具」。
- 首屏标准组合（官网首屏、README 标题下，两处逐字一致）：

  > **只专注学习本身就够了，剩下的都交给我。**
  > 开源、本地优先的 AI 学习工作台。
  > 它的学习 Agent，可直接操作学习桌面上的每一个应用。

  English：**Just focus on learning. Leave the rest to me.** / An open-source, local-first AI learning workbench. / Its study agent works directly in every app on your Study Desktop.

## 2. 三条支撑 + 底座

各渠道按此顺序讲；每条给出可直接引用的证据点。

### ① 能动手 —— Agent 直接操作学习桌面上的应用

说一句话，它去写笔记、建思维导图、出题、制卡、排复习、建待办、做调研。

- 每个应用都有 Agent 读写工具：笔记、思维导图、题目集、闪卡 / FSRS、待办、作文批改、翻译、模板、设置、备份（`docs/Agent工具面总览.md` §2）
- 操作学习桌面窗口：打开应用、观察界面、执行动作（`builtin-workbench_*`）
- 调研模式：检索、阅读文献、成稿写入笔记；论文下载入库并建立索引
- 音视频学习：网课 / 录音转写为带时间戳字幕，回答引用到具体时刻（`[媒体@id:mm:ss]`），可整理成图文讲义
- 浏览器自动化（Windows / macOS）、沙箱本地 shell、生成 Word / PPT / Excel 文件

### ② 可托付 —— 长任务自动推进，每一步可审批、可撤销

- 目标模式跨轮自动续跑；子代理并行；定时自动化（`builtin-automation_*`）
- 操作按 Low / Medium / High 分级审批；Ask / Plan / Craft 三种权限模式
- 改动可撤销：笔记改动渐隐标注并留「撤销本次修改」，学习桌面操作带撤销令牌（`builtin-workbench_undo`）
- 回答带出处：引用可回溯到原文页码、句子或导图节点

### ③ 懂你，可扩展

- 记忆与学习者画像：记住薄弱点和学习习惯，后续回答会参考
- 56 个内置技能，可安装、可自己写；接入 MCP；13 家预置模型服务商，可按功能分配模型
- 同一问题可让多个模型同时作答

### 底座 —— 数据在本机，开源可核对

- 资料、笔记、聊天记录默认存本机；调用模型、外部搜索、MCP、云同步时相应请求才会离开本机（措辞沿用官网 privacy 区块，不得写成「完全离线」）
- AGPL-3.0-or-later

## 3. 硬数字

数字只能从这里取；发版前按「核对方式」复核。

| 项 | 当前值 | 核对方式 |
|---|---|---|
| 内置技能 | **56**（对外写「56 个」或「50 多个」，不写 40+） | `builtinSkills`（8，`src/features/chat/skills/builtin/index.ts`）+ `builtinToolSkills`（48，`builtin-tools/index.ts`）；browser-tools 仅 Win/macOS，其他平台 55 |
| 预置模型服务商 | **13** | `src-tauri/src/llm_manager/builtin_vendors.rs` 的 12 家 + Gemini（`scripts/gemini-model-registry.json` 注入） |
| 联网搜索引擎 | **8**（Bing RSS 免费默认 + Google CSE / SerpAPI / Tavily / Brave / SearXNG / 智谱 / 博查） | `src-tauri/src/tools/web_search.rs` 的 `build_provider`；用户指南 03 章同为 8 |
| OCR 引擎 | 6（DeepSeek-OCR、PaddleOCR-VL 1.5、PaddleOCR-VL 旧版、GLM-4.6V、通用多模态模型、系统 OCR） | `src-tauri/src/ocr_adapters/types.rs` 的 `OcrEngineType` |
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
| 资源库 | Files | 学习中心、学习资源、学习资源中心、Learning Hub |
| 对话 | Chat | |
| 笔记 | Notes | |
| 思维导图 | Mind Map | 知识导图 |
| 题目集 | Exam Set | 题库 |
| 闪卡 | Flashcards | 经典外壳里「闪卡」页合并了复习 / 制卡 / 模板三个标签 |
| 音视频 | Media | 视频学习、媒体转写 |
| Anki 制卡 | Anki Cards | |
| 作文批改 | Essay Review | |
| 翻译 | Translation | |
| 待办 / 番茄钟 | Todo / Pomodoro | |
| 技能 | Skills | |

- 「音视频 / Media」是应用名（0.10.2 起为独立应用，经典侧栏与 Dock 里都有；v0.10.1 里还在资源库内）。应用列表、导航一律用应用名；正文描述这项能力时可写「音视频学习」。

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

## 7. 待修正的不一致

### 2026-10-05 复查

- [x] 本文：联网搜索引擎 7 → 8（漏了默认免费的 Bing RSS）；补 OCR 引擎 6；音视频改按应用名「音视频 / Media」；首屏标准组合按 README / 官网实际文案统一
- [x] README：搜索引擎 8、音视频按应用名、架构图应用层补音视频、功能模块 23 → 26、「路线图」链接改为「项目历程」、Agent 导语改书面语（docs/readme-refresh）
- [x] 官网：首页去掉「共用同一份数据」「而不是通用聊天」，题库 → 题目集，英文 Files / Study Desktop，首屏主张与 README 一致，站点默认描述改为学习 Agent；关于页重写、项目历程补到 v0.10；指南 04 / 11 标题；首页各区块按 §5 改书面语（ds-web feat/messaging-agent）
- [x] 用户指南：第 04 章「资源库」、第 11 章「题目集与练习」，只改标题与互链文字，文件名与官网 slug 不变
- [x] 应用内：命令面板 `nav.goto.learning-hub` 改为「跳转到资源库 / Go to Files」，搜索仍认「学习中心 / hub」
- [x] 宣传片：video 分支推到 origin（139a2f14a）
- [ ] 发布：README（docs/readme-refresh PR）；官网（ds-web PR，合并前用「main 8f9f164c0 + demo/site-i18n-hide」重出演示镜像，否则英文页演示退回中文界面）
- [x] 宣传片 v6：经典侧栏 5 → 6 项（加「音视频」，video 分支 6b2836dfb）；第二幕翻译与调研之间加 10 秒音视频镜头（全部应用 → 音视频 → B 站链接导入 5 个分 P → 应用内播放、字幕逐句高亮 → 点字幕跳转），全片 2:30 → 2:40（2ebf5c585）；locale 同步 main（5768e4d75）；成片 video/out/deep-student-pv-2026-10-06-v6.mp4（1080p 160s）。新增字幕：「网课和讲座，它陪你一起学。」/「粘贴 B 站链接即导入字幕，不下载视频，直接在应用内播放。」；「点一句字幕，回到那一刻。」/「字幕随播放逐句高亮，它回答里的时间引用同样可以点开跳转。」
- [ ] 0.10.2 发版后（余项）：官网应用列表加「音视频」并链第 19 章；官网指南全量同步（源仍是 44b223ea0）；演示镜像经典侧栏 5 → 6 项；FSRS-6 等新功能写进 README / 官网 / 本文

### 截至 2026-10-04

- [x] 宣传片：片尾副标题（含「12 家」）删除；片尾口号换成 §1 口号；字幕第四版改为 Agent 视角（video 分支 c63a4d0e0）；画面内界面文案同步 main 的 locale（ffaf1cd8b）
- [x] 宣传片：成片重新渲染（video/out/deep-student-pv-2026-10-04-v4.mp4，1080p 150s；video 分支 48b9dd0d7 修复复数键渲染中断）
- [x] 宣传片：跟进闪卡合并（经典壳侧栏去掉 Anki / 模板两项）与技能 56，重渲染为 video/out/deep-student-pv-2026-10-04-v5.mp4（video 分支 139a2f14a）
- [ ] 官网 promo/（30 秒短片，未提交）核心概念仍是「统一数据层」旧口径，待定
- [x] 官网首屏换口号与品类、新增 Agent 一节、站内自有文案「知识导图」→「思维导图」（ds-web 分支 feat/messaging-agent 1b6eb65，未合并）
- [x] 官网：用户指南「知识导图」→「思维导图」、第 08 章改名（本仓库 8ec65cd21），ds-web 同步与英文应用名对齐（feat/messaging-agent 604fd26，未合并）
- [x] 官网：演示镜像换成主仓库本地构建，首屏海报 / 功能截图 / 分享卡（og-2026-10-agent.png）重出（ds-web feat/messaging-agent ca69373，未合并）；闪卡合并后按 main 8f9f164c0 再出一版（4691551）
- [x] README：事实与术语全部更正、中英重写（docs/readme-refresh 分支）；中英截图各 8 张均已真机重拍（docs/readme-refresh 6d3d04ce1，未合并）；跟进音视频学习与闪卡合并：新增中英 media 图，中文主图 / 对话图按新输入框重拍（384b11775）
- [x] 应用内：Agent 控制中心「题库 / Question bank」→「题目集 / Exam Set」（ea02573b2）
- [x] 应用内：`learningHub.json`（桌面快捷方式，宣传片画面里可见）与 `mcp.json` 的工具名仍写「知识导图」→「思维导图」（ea02573b2；模型侧 skill 描述里作为同义词保留）
