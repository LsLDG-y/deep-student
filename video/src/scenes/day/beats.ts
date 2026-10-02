/**
 * 第二幕「第二天」：白天的学习桌面（亮色工作台）。单位为脚本秒（成片 0:46–1:48）。
 * 起点 23.0 = 夜里复习那段的 WK.out1，两边在这一帧的桌面完全一致。
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
  todayOpen: 25.75, // 「今日」窗口从 Dock 弹开
  todayFocus: 28.55, // 点「开始专注」
  todayOut: 29.7, // 「今日」窗口让位
  // 06 检验
  examOpen: 30.0,
  examDrop: 31.0, // 试卷落进题目集
  examParsed: 32.25, // 识别完成，18 题入库
  examStart: 32.75, // 开始练习
  examPick: 33.55, // 选了一个错误选项
  examExplain: 33.9, // AI 深度解析开始流式输出
  examMastery: 35.85, // 知识点掌握度更新
  examOut: 37.8,
  // 07 写作与精读
  essayOpen: 38.0,
  essayGrade: 38.95, // 点「开始批改」
  essayScore: 39.75, // 分数环滚动
  essayPolish: 41.2, // 切到逐句润色
  translateOpen: 42.85,
  translateRun: 43.55, // 译文逐段流出
  writingOut: 45.85,
  // 08 调研
  researchOpen: 46.0,
  researchSend: 46.95, // 发出调研请求
  researchSteps: 47.45, // 步骤逐条打勾
  researchNote: 49.35, // 报告存为笔记
  paperSend: 50.05, // 搜论文
  paperDownload: 51.25, // 下载入库
  hubIndex: 52.2, // 资源中心索引进度
  end: 54.0,
} as const;

/** 壁纸从夜里复习开始到第二幕结束一直缓慢平移，两段共用同一条曲线才能无缝交接。 */
export const WALL_DRIFT = { t0: 16.36, t1: DAY.end } as const;
export const wallDrift = (t: number) => Math.min(1, Math.max(0, (t - WALL_DRIFT.t0) / (WALL_DRIFT.t1 - WALL_DRIFT.t0)));
