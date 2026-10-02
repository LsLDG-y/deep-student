/**
 * 第二幕「第二天」：白天的学习桌面（亮色工作台）。单位为脚本秒（成片 0:46–1:48）。
 * 起点 23.0 = 夜里复习那段的 WK.out1，两边在这一帧的桌面完全一致。
 * 打开应用的路径都是产品里真实存在的：日程小组件的「待办 →」、桌面快捷方式双击、Dock 图标、
 * 双击桌面空白处「显示桌面」（showDesktop.ts：可见窗口一起最小化）。
 */
export const DAY = {
  start: 23.0,
  // 过场：夜 → 晨
  dawn0: 23.05,
  dawn1: 24.7,
  theme0: 23.75, // 暗色 → 亮色界面
  theme1: 24.3,
  clock: 23.95, // 菜单栏时钟翻到第二天
  // 今日
  todayOpen: 26.0, // 点日程小组件「待办 →」：待办从 Dock 图标长出，直接进「今日」视图
  todayFocus: 27.45, // 第 2 行「▷ 开始专注」
  showDesk: 29.0, // 双击桌面空白处：待办与番茄钟窗口一起 genie 进 Dock
  examLaunch: 29.86, // 双击桌面「题目集」
  // 06 检验（题目集窗口级联落在 2 号槽，打开是「选择一个项目」空态）
  examOpen: 30.0,
  examNew: 30.42, // 点「＋ 新建题目集」→ 启动台
  examGrab: 30.66, // 试卷从屏幕右侧拖进来
  examDrop: 31.2, // 落进启动台 → 识别导入第 1 步（文件已选好，不自动开始）
  examParse: 31.55, // 点「解析文档」
  examParsed: 32.9, // 导入完成
  examView: 33.25, // 点「查看题目」→ 题库
  examQ7: 33.6, // 点第 7 题卡片 → 做题（顺序 7/18）
  examPick: 33.95, // 选 A
  examSubmit: 34.28, // 提交答案 → 判错
  examAI: 34.98, // 滚到结果面板底部，点「AI 解析」
  examOut: 37.8,
  // 07 写作与精读
  essayLaunch: 37.86, // 双击桌面「作文批改」
  essayOpen: 38.0,
  essayGrade: 38.95, // 点「开始批改」
  essayScore: 39.75, // 分数环滚动
  essayPolish: 41.2, // 切到逐句润色
  translateLaunch: 42.71, // 双击桌面「翻译」
  translateOpen: 42.85,
  translateRun: 43.55, // 译文逐段流出
  showDesk2: 45.45, // 再次「显示桌面」，收起 07 的窗口
  writingOut: 45.85,
  // 08 调研
  researchOpen: 46.0, // 点 Dock「对话」：最小化着的对话窗口还原
  researchSend: 46.95, // 发出调研请求
  researchSteps: 47.45, // 步骤逐条打勾
  researchNote: 49.35, // 报告存为笔记
  paperSend: 50.05, // 搜论文
  paperDownload: 51.25, // 下载入库
  hubIndex: 52.2, // 点 Dock「资源库」
  end: 54.0,
} as const;

/** 双击两下的间隔（真实约 140ms）。 */
export const DBL = 0.07;

/** 壁纸从夜里复习开始到第二幕结束一直缓慢平移，两段共用同一条曲线才能无缝交接。 */
export const WALL_DRIFT = { t0: 16.36, t1: DAY.end } as const;
export const wallDrift = (t: number) => Math.min(1, Math.max(0, (t - WALL_DRIFT.t0) / (WALL_DRIFT.t1 - WALL_DRIFT.t0)));
