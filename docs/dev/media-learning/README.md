# 音视频学习（媒体转写 → 检索 → 时间戳引用 → 学习闭环）

> 2026-10 设计契约。思路与功能借鉴贡献者项目 [BA7MLV/wangke-agent](https://github.com/BA7MLV/wangke-agent)
> （MIT, Copyright (c) 2026 BA7MLV）。**只吸收思路和功能，全部在 DeepStudent 现有架构上原生实现**；
> 直接移植的纯逻辑模块须在文件头保留原版权与许可声明。

## 0. 原则

- **不新增资源类型**：音视频仍是 VFS `File` 资源（`FileType::Audio/Video`），复用资源库、预览、备份、同步。
- **不新增工具族**：问答复用 `unified_search(resource_ids)` 与 `resource_read`；制卡/出题复用 chatanki / qbank。
- **不新增页面**：转写、字幕、讲义入口都在现有文件预览（`FileContentView` 的媒体视图）与聊天里。
- **不引入浏览器端重依赖**：解码在 Rust 后端（symphonia，纯 Rust，可交叉编译到 Android）；VAD 用自研能量 VAD；
  不用 onnxruntime / wasm（发布版 CSP 禁止 wasm 编译）。
- **不做**：B 站等平台下载/Cookie/私有接口（法律与凭据风险）；飘屏弹幕与 AI 讨论区；PWA/浏览器存储层。
  平台字幕只支持用户自行获得的字幕文件导入（`.srt/.vtt`，B 站 BCC JSON 解析）。

## 1. 核心数据：带秒数的字幕段

一切围绕"每段自带起止时间"的字幕段：转写可续做、检索命中带时间、引用可跳播放器、讲义/卡片/题目基于字幕。

### 1.1 表（VFS 库，迁移 `V20261005__media_transcripts.sql`）

```sql
CREATE TABLE media_transcript_segments (
  resource_id   TEXT    NOT NULL,       -- VFS File 资源 ID（file_*）
  idx           INTEGER NOT NULL,       -- 段序号（0 起，按 start_ms 升序）
  start_ms      INTEGER NOT NULL,
  end_ms        INTEGER NOT NULL,
  text          TEXT    NOT NULL DEFAULT '',
  status        INTEGER NOT NULL DEFAULT 0,  -- 0 待转写 / 1 完成 / 2 失败
  source        TEXT    NOT NULL DEFAULT 'asr', -- 'asr' | 'import'（字幕文件导入）
  plan_version  INTEGER NOT NULL DEFAULT 1,
  updated_at    INTEGER NOT NULL,
  PRIMARY KEY (resource_id, idx)
);
CREATE INDEX idx_media_segments_status ON media_transcript_segments(resource_id, status);

CREATE TABLE media_progress (
  resource_id      TEXT PRIMARY KEY,
  last_position_ms INTEGER NOT NULL DEFAULT 0,
  duration_ms      INTEGER,
  watched_ms       INTEGER NOT NULL DEFAULT 0,
  finished         INTEGER NOT NULL DEFAULT 0,
  updated_at       INTEGER NOT NULL
);
```

学习时长另用 `V20261006__study_time.sql`（`study_time_daily(date TEXT PRIMARY KEY, seconds INTEGER, updated_at INTEGER)`）。

### 1.2 转写流水线（Rust，`src-tauri/src/media/`）

1. **解码**：symphonia（仅开必要 codec：AAC/MP3/FLAC/PCM/Vorbis/Opus 按可用性，容器 MP4/MKV/WebM/OGG/WAV）→ 单声道 16 kHz s16。
   流式解码，不整文件进内存；重采样按**媒体时间轴全局网格**对齐（防长课时间戳漂移）；坏包跳过并按包时长补静音。
   不支持的容器/编码给出明确提示（"请转为 MP4/M4A"）。
2. **VAD**：能量 + 过零率的轻量 VAD；段合并参数：间隔 < 0.4 s 合并、单段 ≤ 15 s、< 0.5 s 并入前段。
3. **ASR**：每段编码为 WAV，走 `voice_input` 同一套 ASR 配置与模型槽位（`voice_input_asr_model_config_id`）；
   AIMD 自适应并发（连续成功 +1，429 减半并按 Retry-After 冷却；400/401/403 不重试）；每次调用记入 llm_usage。
4. **续做**：`status=1` 的段跳过；新 VAD 计划段数偏差 > 20% 时重建（`plan_version+1`）。
5. **任务承载**：扩展 `vfs/pdf_processing_service.rs` 的 `MediaType` 增加 `Audio`/`Video`，阶段 `decode → vad → asr → indexing`，
   复用 `media-processing-*` 事件与启动恢复。全局串行一个媒体转写任务。
6. **触发**：转写会产生费用 → 由用户触发（预览页"转写"按钮/聊天工具调用）；开始前展示时长与预计段数。
   原导入时 ≤ 25 MB 音频整段自动转写的路径**移除**，统一到本流水线（短音频 < 10 分钟导入后自动开始，保持原有体验）。

### 1.3 命令（Tauri）

| 命令 | 说明 |
|---|---|
| `media_transcribe_estimate(resource_id)` | `{durationMs, plannedSegments, asrModel}`（只解码+VAD 时长估算，可走快速探测） |
| `media_transcribe_start(resource_id)` | 入队；已在队/已完成返回现状 |
| `media_transcribe_cancel(resource_id)` | 取消；已完成段保留 |
| `media_transcript_get(resource_id)` | `{status, segments:[{idx,startMs,endMs,text,status}], progress}` |
| `media_transcript_import(resource_id, path)` | 导入 `.srt/.vtt/BCC .json`，写 `source='import'` 段并触发索引 |
| `media_transcript_export(resource_id, format, dest)` | 导出 `srt`/`vtt`/`txt`（含 content:// 目标） |
| `media_progress_get/set(resource_id, …)` | 断点续播与观看时长 |
| `study_time_add(seconds)` / `study_time_range(from,to)` | 学习时长 |

事件：沿用 `media-processing-progress` / `-completed` / `-error`，payload 带 `mediaType: 'audio'|'video'`、`stage`、`completedSegments`、`totalSegments`。

### 1.4 检索

- 媒体资源的 index unit 按 **~90 s 时间窗**（或 ~800 字）聚合字幕段；segment `metadata_json` 写 `{"startMs":…,"endMs":…}`。
  内容哈希只对确定性结构（数组/BTreeMap）取（AGENTS.md 禁令）。
- 检索命中带 `timeRange`；`resource_read` 支持 `time_start`/`time_end`（秒），返回逐段 `[mm:ss] 文本`，单次 ≤ 10 分钟。
- 词法路由增加 BM25 重排（中文单字 + 二字组、非负 idf、全覆盖加成），惠及所有资源，移动端（无向量）收益最大。

## 2. 引用与跳转

- 格式：**`[媒体@{resource_id}:{mm:ss}]`**（≥ 1 小时用 `h:mm:ss`）。与 `[PDF@tb_xxx:页码]` 同族，remark 插件并列解析。
- 渲染为徽章"▶ mm:ss · 文件名"；点击派发 `media-ref:focus {resourceId, seconds}`（ack 重试模式同 `chatPdfFocus`），
  打开资源并跳到该时间。
- 播放器：WebVTT 字幕轨（由段生成 blob URL；增量更新不重建轨道）、字幕面板（搜索、点击跳转、跟随高亮）、断点续播、
  "截取当前帧 → 引用到聊天"（走现有 `addContextRef` 图片链路）。

## 3. 学习闭环

- **课程问答**：一个精简的内置技能说明（检索纪律：传关键词、不中换说法；按时间读；回答带 `[媒体@…]`），不新增工具。
- **制卡/出题**：`resource_read` 带时间戳的转写即可作为 chatanki / qbank 输入；来源记录 `resource_id + 秒`，复习时可跳转。
- **讲义**：前端 `<video>` + canvas 抽帧（每 ~25 s、灰度差去重、≤ 60 帧）→ VLM 帧说明筛选 → 大纲 → 分节结构化 IR（校验 + 兜底）
  → **落为笔记**（图片为 VFS 资源，小节带 `[媒体@…]` 锚点）；笔记可导出 DOCX（新增图片块与"讲义/公文"版式）。
- **学习时长**：可见且在场才计时（播放中不判空闲），心跳 15 s、单次 ≤ 30 s、跨零点拆分；现有学习热力图增加"时长"口径。

## 4. 平台

- symphonia 进 `mobile-slim`，只开必要 codec；Android 转写在前台进行，可续做（切后台被冻结后恢复继续）。
- 大文件：媒体导入流式写入 blob（边拷边算 hash，不整文件进内存），上限 4 GB。
- CSP 不变：`media-src` 已允许 `blob:`/`filestream:`；抽帧时 `<video crossOrigin="anonymous">` 读 `filestream`（其 CORS 白名单含应用源），canvas 不被污染。
