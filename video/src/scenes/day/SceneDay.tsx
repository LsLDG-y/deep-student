import type { ReactNode } from 'react';
import { AbsoluteFill } from 'remotion';
import { camAt, CameraView, clampCam, project, type CamKey } from '../../lib/camera';
import { ease, PACE, prog } from '../../lib/time';
import { S } from '../../strings';
import { dark, light, type Tokens } from '../../theme';
import { Pupil, pathAt } from '../../ui/brand';
import { agendaOpenCenter, AgendaWidget, BriefingWidget, DesktopShortcuts, shortcutCenter, type ShortcutId } from '../../ui/desk';
import { essayGradeCenter, ESSAY_H, ESSAY_W, EssayView, type EssayState } from '../../ui/essay';
import { EXAM_DROP, EXAM_H, EXAM_W, ExamView, examOptionCenter, examStartCenter, FileChip, type ExamState } from '../../ui/exam';
import { CHAT_H, CHAT_W, HUB_H, HUB_W, HubIndexView, NOTE_H, NOTE_W, NoteView, ResearchChat, type ResearchState } from '../../ui/research';
import { POMO_RECT, PomodoroWindowBody, pomoTitle, TODO_H, TODO_ITEMS, TODO_W, TodoApp, todoPlayCenter, todoRowCenter, TodoToolbar, type TodoState } from '../../ui/todo';
import { transButtonCenter, TRANS_H, TRANS_W, TranslateView, type TransState } from '../../ui/translate';
import { APP_NAMES, Dock, dockBounceAt, dockIconCenter, type DockBadge, GENIE_S, IND_S, MenuBar, menuClock, TIP_DELAY_S, TIP_FADE_S, Wallpaper, WbWindow, winLife, type Rect } from '../../ui/workbench';
import { nightDock, nightMenubar } from '../review/SceneReview';
import { DAY, DBL, wallDrift } from './beats';

/**
 * 第二幕「第二天」：夜里复习完的学习桌面迎来清晨，之后按产品里真实的路径打开应用：
 * 日程小组件「待办 →」→ 待办「今日」→ 开始专注 → 双击桌面「显示桌面」→ 双击桌面快捷方式打开题目集 / 作文批改 / 翻译
 * → 再次「显示桌面」→ Dock 还原对话 → 调研建出的笔记 → Dock 打开资源库。
 * 桌面（壁纸 / 快捷方式 / 小组件 / 菜单栏 / Dock）全程常驻，窗口在其上开合；镜头是 2D 推拉。
 */
export const TODO_RECT: Rect = { x: 48, y: 88, w: TODO_W, h: TODO_H };
export const EXAM_RECT: Rect = { x: (1920 - EXAM_W) / 2, y: 128, w: EXAM_W, h: EXAM_H };
const inWin = (r: Rect, p: { x: number; y: number }) => ({ x: r.x + p.x, y: r.y + 38 + p.y });

export const ESSAY_RECT: Rect = { x: (1920 - ESSAY_W) / 2, y: 126, w: ESSAY_W, h: ESSAY_H };
export const TRANS_RECT: Rect = { x: 420, y: 176, w: TRANS_W, h: TRANS_H };
export const CHAT_RECT: Rect = { x: 230, y: 118, w: CHAT_W, h: CHAT_H };
export const NOTE_RECT: Rect = { x: 1130, y: 150, w: NOTE_W, h: NOTE_H };
export const HUB_RECT: Rect = { x: (1920 - HUB_W) / 2, y: 196, w: HUB_W, h: HUB_H };
const DL_BTN = { x: CHAT_W - 126, y: 322 };

const pressAt = (t: number, at: number, w = 0.08) => Math.max(0, 1 - Math.abs(t - at) / w);
const hoverAt = (t: number, at: number) => (t >= at - 0.16 && t < at + 0.02 ? 1 : 0);

/** 「显示桌面」：第二击后窗口开始 genie。 */
const SHOW_MIN = DAY.showDesk + DBL + 0.02;
const SHOW_MIN2 = DAY.showDesk2 + DBL + 0.02;
/** Dock 图标点按时刻（还原对话 / 打开资源库）。 */
const CHAT_CLICK = DAY.researchOpen - 0.02;
const HUB_CLICK = DAY.hubIndex - 0.02;

// ── 桌面状态 ─────────────────────────────────────────
/** 有窗口的应用（含最小化），按最早开窗保序。番茄钟在 07 的时间跳转处已结束（会话结束即收起投射窗口）。 */
const runningAt = (t: number): string[] => {
  const r = [...nightDock(DAY.start).running];
  if (t >= DAY.todayOpen) r.push('todo');
  if (t >= DAY.todayFocus && t < DAY.essayOpen) r.push('pomodoro');
  if (t >= DAY.examOpen) r.push('exam');
  if (t >= DAY.essayOpen) r.push('essay');
  if (t >= DAY.translateOpen) r.push('translation');
  if (t >= DAY.researchNote) r.push('notes');
  if (t >= DAY.hubIndex) r.push('files');
  return r;
};
const FIRST_OPEN: Record<string, number> = {
  todo: DAY.todayOpen,
  pomodoro: DAY.todayFocus,
  exam: DAY.examOpen,
  essay: DAY.essayOpen,
  translation: DAY.translateOpen,
  notes: DAY.researchNote,
  files: DAY.hubIndex,
};

/** 闪卡到期数：清晨 12 张；07 的时间跳转之后「复习到期卡片」已完成。 */
const dueAt = (t: number) => (t < DAY.clock ? nightMenubar(t).due : t < DAY.essayOpen ? 12 : 0);
/** 今日待办完成数（简报的「已完成 n/4」与日程列表随章节推进）。 */
const doneAt = (t: number) => (t < DAY.essayOpen ? 0 : t < DAY.researchOpen ? 2 : 3);

const focusLeft = (t: number) => {
  const left = Math.max(0, 25 * 60 - Math.floor((t - DAY.todayFocus) * PACE));
  return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
};

/** 菜单栏：时钟翻页前与夜里那段逐帧一致；白天随焦点窗口切换应用名、随章节走时间。 */
const dayMenubar = (t: number) => {
  if (t < DAY.clock) return { ...nightMenubar(t), pomo: null as string | null };
  const app =
    t < DAY.todayOpen
      ? S.desk.appName
      : t < SHOW_MIN
        ? APP_NAMES.todo
        : t < DAY.examOpen
          ? S.desk.appName
          : t < DAY.essayOpen
            ? APP_NAMES.exam
            : t < DAY.translateOpen
              ? APP_NAMES.essay
              : t < SHOW_MIN2
                ? APP_NAMES.translation
                : t < DAY.researchOpen
                  ? S.desk.appName
                  : t < DAY.researchNote
                    ? APP_NAMES.chat
                    : t < DAY.paperSend
                      ? APP_NAMES.notes
                      : t < DAY.hubIndex
                        ? APP_NAMES.chat
                        : APP_NAMES.files;
  const clock = t < DAY.essayOpen ? menuClock(3, 7, 30) : t < DAY.translateOpen ? menuClock(3, 14, 10) : t < DAY.researchOpen ? menuClock(3, 15, 40) : menuClock(3, 20, 5);
  const pomo = t >= DAY.todayFocus && t < DAY.essayOpen ? focusLeft(t) : null;
  return { app, clock, due: dueAt(t), pomo };
};

/** 有可见窗口时小组件淡到 0.55（280ms ease-out）。 */
const dimAt = (t: number) => {
  const on = (a: number) => prog(t, a, a + 0.14, ease.wbOut);
  const off = (a: number) => prog(t, a, a + 0.14, ease.wbOut);
  return Math.max(on(DAY.todayOpen) * (1 - off(SHOW_MIN + GENIE_S)), on(DAY.examOpen) * (1 - off(SHOW_MIN2 + GENIE_S)), on(DAY.researchOpen));
};

const night = (t: number) => 1 - prog(t, DAY.dawn0, DAY.dawn1, ease.inOutCubic);
const themeK = (t: number) => prog(t, DAY.theme0, DAY.theme1, ease.inOutCubic);

// ── 各段内容状态 ─────────────────────────────────────
const TODO_ROW_IN = 26.78;
const TODO_ROW_OUT = 27.92;
const todoState = (t: number): TodoState => ({
  view: 'today',
  navHover: 0,
  navPress: 0,
  rowHover: prog(t, TODO_ROW_IN, TODO_ROW_IN + 0.03) * (1 - prog(t, TODO_ROW_OUT, TODO_ROW_OUT + 0.03)),
  playHover: t >= DAY.todayFocus - 0.2 && t < TODO_ROW_OUT ? 1 : 0,
  playPress: pressAt(t, DAY.todayFocus),
  focusing: t >= DAY.todayFocus,
  remaining: t >= DAY.todayFocus ? focusLeft(t) : '25:00',
  ring: t >= DAY.todayFocus ? ((t - DAY.todayFocus) * PACE) / 1500 : 0,
});

const essayState = (t: number): EssayState => ({
  gradeHover: hoverAt(t, DAY.essayGrade),
  gradePress: pressAt(t, DAY.essayGrade),
  marks: prog(t, DAY.essayGrade + 0.08, DAY.essayScore + 0.75),
  score: prog(t, DAY.essayScore, DAY.essayScore + 0.9),
  polish: prog(t, DAY.essayPolish, DAY.essayPolish + 0.9),
  view: 0,
});

const transState = (t: number): TransState => ({
  run: prog(t, DAY.translateRun + 0.06, DAY.showDesk2 - 0.2),
  press: pressAt(t, DAY.translateRun),
  scroll: ease.inOutCubic(prog(t, DAY.translateRun + 1.0, DAY.showDesk2 - 0.05)),
});

const researchState = (t: number): ResearchState => ({
  sent: prog(t, DAY.researchSend, DAY.researchSend + 0.2, ease.wbOut),
  steps: prog(t, DAY.researchSteps, DAY.researchNote - 0.15),
  noteTool: prog(t, DAY.researchNote - 0.15, DAY.researchNote + 0.1),
  paperSent: prog(t, DAY.paperSend, DAY.paperSend + 0.25, ease.wbOut),
  search: prog(t, DAY.paperSend + 0.3, DAY.paperSend + 0.62),
  results: prog(t, DAY.paperSend + 0.62, DAY.paperSend + 1.0),
  dlPress: pressAt(t, DAY.paperDownload),
  dl: prog(t, DAY.paperDownload + 0.05, DAY.paperDownload + 0.62),
});

const CHIP_HOME = { x: 92, y: 690 };
const EXAM_GRAB = DAY.examOpen + 0.5;

const examState = (t: number): ExamState => {
  const left = 45 * 60 - 24 - Math.max(0, Math.floor((t - DAY.examStart) * 2));
  return {
    ocr: prog(t, DAY.examDrop, DAY.examParsed - 0.15),
    listed: 18 * prog(t, DAY.examDrop + 0.2, DAY.examParsed - 0.05),
    parsed: prog(t, DAY.examParsed - 0.15, DAY.examParsed + 0.05),
    startHover: t >= DAY.examStart - 0.16 && t < DAY.examStart + 0.02 ? 1 : 0,
    startPress: Math.max(0, 1 - Math.abs(t - DAY.examStart) / 0.08),
    practice: prog(t, DAY.examStart + 0.05, DAY.examStart + 0.3, ease.wbOut),
    pick: prog(t, DAY.examPick, DAY.examPick + 0.1),
    reveal: prog(t, DAY.examPick + 0.16, DAY.examPick + 0.3),
    explain: prog(t, DAY.examExplain, DAY.examMastery - 0.4),
    mastery: prog(t, DAY.examMastery, DAY.examMastery + 0.75),
    toast: prog(t, DAY.examMastery + 0.65, DAY.examOut - 0.2),
    timer: `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`,
    dropHover: t >= DAY.examDrop - 0.22 && t < DAY.examDrop ? 1 : 0,
  };
};

/** 试卷文件：先出现在桌面上，被瞳点拖进题目集的投放区。 */
const chipPose = (t: number) => {
  const drop = inWin(EXAM_RECT, EXAM_DROP);
  const k = prog(t, EXAM_GRAB, DAY.examDrop - 0.04, ease.inOutCubic);
  const lift = prog(t, EXAM_GRAB - 0.04, EXAM_GRAB + 0.08) * (1 - prog(t, DAY.examDrop - 0.06, DAY.examDrop + 0.04));
  const arc = Math.sin(k * Math.PI) * 60;
  return {
    x: CHIP_HOME.x + (drop.x - 150 - CHIP_HOME.x) * k,
    y: CHIP_HOME.y + (drop.y - 30 - CHIP_HOME.y) * k - arc,
    lift,
    opacity: prog(t, DAY.examOpen + 0.2, DAY.examOpen + 0.35) * (1 - prog(t, DAY.examDrop, DAY.examDrop + 0.12)),
    scale: 1 - 0.3 * prog(t, DAY.examDrop - 0.02, DAY.examDrop + 0.12),
  };
};

// ── 镜头 ──────────────────────────────────────────────
const FULL = { x: 960, y: 540, zoom: 1 };
const DAY_CAM: CamKey[] = [
  [DAY.start, FULL],
  [DAY.dawn1, { x: 960, y: 540, zoom: 1.015 }, ease.linear],
  [25.25, { x: 960, y: 540, zoom: 1.015 }, ease.linear],
  // 推到右列小组件：今天的日程与到期卡片
  [25.8, { x: 1193, y: 430, zoom: 1.32 }, ease.inOutCubic],
  [DAY.todayOpen + 0.05, { x: 1193, y: 430, zoom: 1.32 }, ease.linear],
  // 转到待办窗口（今日视图）
  [26.6, { x: 768, y: 470, zoom: 1.25 }, ease.inOutCubic],
  [27.2, { x: 790, y: 470, zoom: 1.27 }, ease.linear],
  [DAY.todayFocus + 0.15, { x: 760, y: 520, zoom: 1.34 }, ease.inOutCubic],
  [28.2, { x: 760, y: 520, zoom: 1.35 }, ease.linear],
  // 退到全景：菜单栏 ⏱、Dock 上的番茄钟与红点
  [28.65, FULL, ease.inOutCubic],
  [DAY.examOpen + 0.1, FULL, ease.linear],
  [EXAM_GRAB, { x: 900, y: 560, zoom: 1.02 }, ease.inOutCubic],
  [DAY.examDrop + 0.25, { x: 990, y: 520, zoom: 1.1 }, ease.inOutCubic],
  [DAY.examParsed, { x: 1000, y: 516, zoom: 1.12 }, ease.linear],
  [DAY.examStart + 0.3, { x: 920, y: 470, zoom: 1.24 }, ease.inOutCubic],
  [DAY.examExplain + 0.5, { x: 920, y: 520, zoom: 1.24 }, ease.inOutCubic],
  [DAY.examMastery - 0.05, { x: 930, y: 560, zoom: 1.22 }, ease.linear],
  [DAY.examMastery + 0.5, { x: 1010, y: 520, zoom: 1.1 }, ease.inOutCubic],
  [DAY.essayLaunch - 0.65, { x: 1010, y: 520, zoom: 1.12 }, ease.linear],
  [DAY.essayLaunch - 0.25, FULL, ease.inOutCubic],
  [DAY.essayOpen + 0.1, FULL, ease.linear],
  [DAY.essayGrade - 0.3, { x: 1040, y: 470, zoom: 1.08 }, ease.inOutCubic],
  [DAY.essayGrade + 0.45, { x: 780, y: 500, zoom: 1.24 }, ease.inOutCubic],
  [DAY.essayScore + 0.1, { x: 820, y: 520, zoom: 1.24 }, ease.linear],
  [DAY.essayScore + 0.6, { x: 990, y: 520, zoom: 1.1 }, ease.inOutCubic],
  [DAY.essayPolish - 0.05, { x: 1000, y: 520, zoom: 1.1 }, ease.linear],
  [DAY.essayPolish + 0.45, { x: 1300, y: 500, zoom: 1.3 }, ease.inOutCubic],
  [DAY.translateLaunch - 0.75, { x: 1310, y: 520, zoom: 1.32 }, ease.linear],
  [DAY.translateLaunch - 0.3, FULL, ease.inOutCubic],
  [DAY.translateOpen + 0.1, FULL, ease.linear],
  [DAY.translateOpen + 0.5, { x: 1040, y: 556, zoom: 1.04 }, ease.inOutCubic],
  [DAY.translateRun + 0.35, { x: 1040, y: 540, zoom: 1.18 }, ease.inOutCubic],
  [DAY.showDesk2 - 0.45, { x: 1040, y: 580, zoom: 1.22 }, ease.linear],
  [DAY.showDesk2 - 0.1, FULL, ease.inOutCubic],
  [DAY.researchOpen + 0.1, FULL, ease.linear],
  [DAY.researchSend - 0.15, { x: 760, y: 540, zoom: 1.12 }, ease.inOutCubic],
  [DAY.researchSteps + 0.35, { x: 740, y: 470, zoom: 1.24 }, ease.inOutCubic],
  [DAY.researchNote - 0.1, { x: 760, y: 500, zoom: 1.24 }, ease.linear],
  [DAY.researchNote + 0.45, { x: 1300, y: 520, zoom: 1.18 }, ease.inOutCubic],
  [DAY.paperSend - 0.05, { x: 1290, y: 520, zoom: 1.18 }, ease.linear],
  [DAY.paperSend + 0.45, { x: 740, y: 540, zoom: 1.18 }, ease.inOutCubic],
  [DAY.paperDownload + 0.3, { x: 820, y: 500, zoom: 1.26 }, ease.inOutCubic],
  [DAY.hubIndex - 0.3, FULL, ease.inOutCubic],
  [DAY.hubIndex + 0.1, FULL, ease.linear],
  [DAY.hubIndex + 0.55, { x: 960, y: 520, zoom: 1.12 }, ease.inOutCubic],
  [DAY.end - 0.3, { x: 1000, y: 500, zoom: 1.22 }, ease.linear],
  [DAY.end + 0.4, { x: 1000, y: 500, zoom: 1.12 }, ease.inOutCubic],
];

// ── 瞳点 ──────────────────────────────────────────────
const AGENDA_BTN = agendaOpenCenter();
const ROW = { x: TODO_RECT.x + todoRowCenter().x, y: TODO_RECT.y + todoRowCenter().y };
const PLAY = { x: TODO_RECT.x + todoPlayCenter().x, y: TODO_RECT.y + todoPlayCenter().y };
/** 桌面空白处（双击「显示桌面」）：待办窗口与右列小组件之间 / 07 两个窗口左下方。 */
const DESK_SPOT = { x: 1250, y: 820 };
const DESK_SPOT2 = { x: 200, y: 800 };
const SC = (id: ShortcutId) => shortcutCenter(id);
const AGENDA_CLICK = DAY.todayOpen - 0.02;

const PUPIL_PATH: Array<[number, number, number]> = (() => {
  const drop = inWin(EXAM_RECT, EXAM_DROP);
  const start = inWin(EXAM_RECT, examStartCenter());
  const optA = inWin(EXAM_RECT, examOptionCenter(0));
  const grade = { x: ESSAY_RECT.x + essayGradeCenter().x, y: ESSAY_RECT.y + 38 + essayGradeCenter().y };
  const run = { x: TRANS_RECT.x + transButtonCenter().x, y: TRANS_RECT.y + 38 + transButtonCenter().y };
  const dl = { x: CHAT_RECT.x + DL_BTN.x, y: CHAT_RECT.y + 38 + DL_BTN.y };
  const chatIcon = dockIconCenter('chat', runningAt(CHAT_CLICK));
  const filesIcon = dockIconCenter('files', runningAt(HUB_CLICK));
  return [
    // 今日：日程小组件「待办 →」→ 第 2 行 → ▷ 开始专注 → 双击桌面空白 → 双击「题目集」
    [25.45, AGENDA_BTN.x + 140, AGENDA_BTN.y + 170],
    [AGENDA_CLICK - 0.05, AGENDA_BTN.x, AGENDA_BTN.y],
    [AGENDA_CLICK + 0.1, AGENDA_BTN.x, AGENDA_BTN.y],
    [TODO_ROW_IN, ROW.x, ROW.y],
    [27.0, ROW.x + 40, ROW.y + 4],
    [DAY.todayFocus - 0.05, PLAY.x, PLAY.y],
    [DAY.todayFocus + 0.4, PLAY.x + 40, PLAY.y + 60],
    [DAY.showDesk - 0.1, DESK_SPOT.x, DESK_SPOT.y],
    [DAY.showDesk + 0.12, DESK_SPOT.x, DESK_SPOT.y],
    [DAY.examLaunch - 0.06, SC('exam').x, SC('exam').y],
    [DAY.examLaunch + DBL + 0.06, SC('exam').x, SC('exam').y],
    // 06：把桌面上的试卷拖进题目集 → 开始练习 → 选 A
    [EXAM_GRAB - 0.04, CHIP_HOME.x + 40, CHIP_HOME.y + 24],
    [DAY.examDrop - 0.04, drop.x - 110, drop.y - 6],
    [DAY.examParsed - 0.3, drop.x + 60, drop.y + 40],
    [DAY.examStart - 0.06, start.x, start.y],
    [DAY.examStart + 0.25, start.x + 10, start.y - 20],
    [DAY.examPick - 0.07, optA.x, optA.y],
    [DAY.examPick + 0.35, optA.x + 40, optA.y + 120],
    // 07：双击「作文批改」→ 开始批改；双击「翻译」→ 翻译
    [DAY.essayLaunch - 0.45, SC('essay').x + 170, SC('essay').y + 120],
    [DAY.essayLaunch - 0.06, SC('essay').x, SC('essay').y],
    [DAY.essayLaunch + DBL + 0.06, SC('essay').x, SC('essay').y],
    [DAY.essayGrade - 0.06, grade.x, grade.y],
    [DAY.essayGrade + 0.4, grade.x - 240, grade.y + 280],
    [DAY.translateLaunch - 0.4, SC('translation').x + 200, SC('translation').y + 110],
    [DAY.translateLaunch - 0.06, SC('translation').x, SC('translation').y],
    [DAY.translateLaunch + DBL + 0.06, SC('translation').x, SC('translation').y],
    [DAY.translateRun - 0.06, run.x, run.y],
    [DAY.translateRun + 0.4, run.x - 240, run.y + 220],
    // 显示桌面 → Dock「对话」还原
    [DAY.showDesk2 - 0.3, DESK_SPOT2.x + 160, DESK_SPOT2.y - 90],
    [DAY.showDesk2 - 0.04, DESK_SPOT2.x, DESK_SPOT2.y],
    [DAY.showDesk2 + DBL + 0.05, DESK_SPOT2.x, DESK_SPOT2.y],
    [CHAT_CLICK - 0.06, chatIcon.x, chatIcon.y],
    [CHAT_CLICK + 0.12, chatIcon.x, chatIcon.y],
    [DAY.researchOpen + 0.35, CHAT_RECT.x + CHAT_W / 2, CHAT_RECT.y + CHAT_H - 120],
    [DAY.paperDownload - 0.5, dl.x - 220, dl.y + 160],
    [DAY.paperDownload - 0.06, dl.x, dl.y],
    [DAY.paperDownload + 0.3, dl.x - 60, dl.y + 120],
    [HUB_CLICK - 0.45, filesIcon.x + 150, filesIcon.y - 200],
    [HUB_CLICK - 0.06, filesIcon.x, filesIcon.y],
    [HUB_CLICK + 0.12, filesIcon.x, filesIcon.y],
    [DAY.hubIndex + 0.45, filesIcon.x - 80, filesIcon.y - 260],
  ];
})();

const dbl = (at: number) => [at, at + DBL];
const CLICKS = [
  AGENDA_CLICK,
  DAY.todayFocus,
  ...dbl(DAY.showDesk),
  ...dbl(DAY.examLaunch),
  DAY.examStart,
  DAY.examPick,
  ...dbl(DAY.essayLaunch),
  DAY.essayGrade,
  ...dbl(DAY.translateLaunch),
  DAY.translateRun,
  ...dbl(DAY.showDesk2),
  CHAT_CLICK,
  DAY.paperDownload,
  HUB_CLICK,
];

/** 瞳点可见区间：各段动作前后淡入淡出。 */
const PUPIL_SHOW: Array<[number, number]> = [
  [25.45, DAY.examLaunch + DBL + 0.3],
  [EXAM_GRAB - 0.3, DAY.examPick + 0.5],
  [DAY.essayLaunch - 0.45, DAY.essayGrade + 0.5],
  [DAY.translateLaunch - 0.4, DAY.translateRun + 0.5],
  [DAY.showDesk2 - 0.3, DAY.researchOpen + 0.45],
  [DAY.paperDownload - 0.55, DAY.paperDownload + 0.5],
  [HUB_CLICK - 0.45, DAY.hubIndex + 0.5],
];
const pupilOpacity = (t: number) => Math.max(0, ...PUPIL_SHOW.map(([a, b]) => Math.min(prog(t, a, a + 0.12), 1 - prog(t, b - 0.14, b))));

/** 双击桌面快捷方式：第一击选中（焦点底 + 标签高亮），每击按下时插画缩到 0.94；窗口打开后焦点移走。 */
const shortcutState = (t: number) => {
  for (const [id, at, open] of [
    ['exam', DAY.examLaunch, DAY.examOpen],
    ['essay', DAY.essayLaunch, DAY.essayOpen],
    ['translation', DAY.translateLaunch, DAY.translateOpen],
  ] as Array<[ShortcutId, number, number]>) {
    if (t >= at - 0.03 && t < open + 0.02) {
      return { selected: { id, k: t >= at ? 1 : 0 }, pressed: { id, k: Math.max(pressAt(t, at, 0.04), pressAt(t, at + DBL, 0.04)) } };
    }
  }
  return {};
};

const dockTipAt = (t: number) => {
  for (const [id, at] of [
    ['chat', CHAT_CLICK],
    ['files', HUB_CLICK],
  ] as Array<[string, number]>) {
    const h0 = at - 0.36;
    if (t >= h0 && t < at + 0.2) return { id, k: prog(t, h0 + TIP_DELAY_S, h0 + TIP_DELAY_S + TIP_FADE_S, ease.wbOut) * (1 - prog(t, at + 0.1, at + 0.16)) };
  }
  return undefined;
};

const Desktop = ({ t }: { t: number }) => {
  const k = themeK(t);
  const bar = dayMenubar(t);
  const dim = dimAt(t);
  const sc = shortcutState(t);
  const done = doneAt(t);
  const pending = TODO_ITEMS.slice(t < DAY.essayOpen ? 0 : t < DAY.researchOpen ? 2 : 3);
  const day = t < DAY.clock ? 2 : 3;
  const agendaPress = pressAt(t, AGENDA_CLICK, 0.06);
  const layer = (tk: Tokens, opacity: number, children: ReactNode) => (opacity > 0.001 ? <div style={{ position: 'absolute', inset: 0, opacity }}>{children}</div> : null);
  const widgets = (tk: Tokens) => (
    <>
      <AgendaWidget tk={tk} dim={dim} day={day} items={pending} openPress={agendaPress} />
      <BriefingWidget tk={tk} dim={dim} due={bar.due} done={day === 2 ? 2 : done} total={day === 2 ? 2 : 4} />
    </>
  );
  return (
    <>
      <Wallpaper drift={wallDrift(t)} night={night(t)} />
      <DesktopShortcuts tk={k > 0.5 ? light : dark} selected={sc.selected} pressed={sc.pressed} />
      {layer(dark, 1 - k, widgets(dark))}
      {layer(light, k, widgets(light))}
    </>
  );
};

const Chrome = ({ t, running }: { t: number; running: string[] }) => {
  const k = themeK(t);
  const bar = dayMenubar(t);
  const badges: Record<string, DockBadge> = {};
  if (bar.due > 0) badges.flashcards = { kind: 'count', value: bar.due };
  if (bar.pomo) badges.pomodoro = { kind: 'dot' };
  const indicator = Object.fromEntries(Object.entries(FIRST_OPEN).map(([id, at]) => [id, (t - at) / IND_S]));
  const bounce = { todo: dockBounceAt(t, DAY.todayOpen), files: dockBounceAt(t, DAY.hubIndex) };
  const tip = dockTipAt(t);
  const press = { chat: pressAt(t, CHAT_CLICK, 0.07), files: pressAt(t, HUB_CLICK, 0.07) };
  const layer = (tk: Tokens, opacity: number, children: ReactNode) => (opacity > 0.001 ? <div style={{ position: 'absolute', inset: 0, opacity }}>{children}</div> : null);
  const both = (tk: Tokens) => (
    <>
      <MenuBar tk={tk} app={bar.app} clock={bar.clock} due={bar.due} pomo={bar.pomo} />
      <Dock tk={tk} running={running} bounce={bounce} tip={tip} press={press} badges={badges} indicator={indicator} />
    </>
  );
  return (
    <>
      {layer(dark, 1 - k, both(dark))}
      {layer(light, k, both(light))}
    </>
  );
};

export const SceneDay = ({ t }: { t: number }) => {
  const tk = light;
  const cam = clampCam(camAt(t, DAY_CAM));
  const running = runningAt(t);
  const icon = (id: string, at: number) => dockIconCenter(id, runningAt(at));

  const todo = winLife(t, TODO_RECT, { openAt: DAY.todayOpen, openFrom: icon('todo', DAY.todayOpen), minimizeAt: SHOW_MIN, minimizeTo: icon('todo', SHOW_MIN) });
  const pomoWin = winLife(t, POMO_RECT, { openAt: SHOW_MIN, minimizeAt: SHOW_MIN, minimizeTo: icon('pomodoro', SHOW_MIN) });
  const exam = winLife(t, EXAM_RECT, { openAt: DAY.examOpen, minimizeAt: SHOW_MIN2, minimizeTo: icon('exam', SHOW_MIN2) });
  const essay = winLife(t, ESSAY_RECT, { openAt: DAY.essayOpen, minimizeAt: SHOW_MIN2, minimizeTo: icon('essay', SHOW_MIN2) });
  const trans = winLife(t, TRANS_RECT, { openAt: DAY.translateOpen, minimizeAt: SHOW_MIN2, minimizeTo: icon('translation', SHOW_MIN2) });
  const chat = winLife(t, CHAT_RECT, { restoreAt: DAY.researchOpen, restoreFrom: icon('chat', DAY.researchOpen) });
  const note = winLife(t, NOTE_RECT, { openAt: DAY.researchNote });
  const hub = winLife(t, HUB_RECT, { openAt: DAY.hubIndex, openFrom: icon('files', DAY.hubIndex) });

  const exit = prog(t, DAY.end - 0.3, DAY.end + 0.2, ease.inOutCubic);
  const chip = chipPose(t);
  const pw = pathAt(t, PUPIL_PATH);
  const ps = project(cam, pw.x, pw.y);
  const pOpacity = pupilOpacity(t);

  return (
    <AbsoluteFill style={{ opacity: 1 - exit, transform: `scale(${1 - 0.04 * exit})` }}>
      <CameraView cam={cam}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080 }}>
          <Desktop t={t} />
          {pomoWin.visible ? (
            <WbWindow tk={tk} rect={POMO_RECT} title={pomoTitle} focused={false} style={pomoWin.style}>
              <PomodoroWindowBody tk={tk} remaining={focusLeft(t)} ring={((t - DAY.todayFocus) * PACE) / 1500} />
            </WbWindow>
          ) : null}
          {todo.visible ? (
            <WbWindow tk={tk} rect={TODO_RECT} focused={t < SHOW_MIN} toolbar={<TodoToolbar tk={tk} view="today" />} style={todo.style}>
              <TodoApp tk={tk} s={todoState(t)} />
            </WbWindow>
          ) : null}
          {exam.visible ? (
            <WbWindow tk={tk} rect={EXAM_RECT} title={APP_NAMES.exam} focused={t < DAY.essayOpen} style={exam.style}>
              <ExamView tk={tk} s={examState(t)} />
            </WbWindow>
          ) : null}
          {essay.visible ? (
            <WbWindow tk={tk} rect={ESSAY_RECT} title={APP_NAMES.essay} focused={t < DAY.translateOpen} style={essay.style}>
              <EssayView tk={tk} s={essayState(t)} />
            </WbWindow>
          ) : null}
          {trans.visible ? (
            <WbWindow tk={tk} rect={TRANS_RECT} title={APP_NAMES.translation} focused={t < SHOW_MIN2} style={trans.style}>
              <TranslateView tk={tk} s={transState(t)} />
            </WbWindow>
          ) : null}
          {(() => {
            const chatWin = chat.visible ? (
              <WbWindow key="chat" tk={tk} rect={CHAT_RECT} title={APP_NAMES.chat} focused={t < DAY.researchNote || (t >= DAY.paperSend && t < DAY.hubIndex)} style={chat.style}>
                <ResearchChat tk={tk} s={researchState(t)} t={t} />
              </WbWindow>
            ) : null;
            const noteWin = note.visible ? (
              <WbWindow key="note" tk={tk} rect={NOTE_RECT} title={APP_NAMES.notes} focused={t < DAY.paperSend} style={note.style}>
                <NoteView tk={tk} k={prog(t, DAY.researchNote + 0.15, DAY.researchNote + 0.75)} />
              </WbWindow>
            ) : null;
            // 焦点回到对话时，对话窗口提到最前
            return t >= DAY.paperSend ? [noteWin, chatWin] : [chatWin, noteWin];
          })()}
          {hub.visible ? (
            <WbWindow tk={tk} rect={HUB_RECT} title={APP_NAMES.files} style={hub.style}>
              <HubIndexView tk={tk} k={prog(t, DAY.hubIndex + 0.3, DAY.end - 0.35)} />
            </WbWindow>
          ) : null}
          {chip.opacity > 0.001 ? (
            <div style={{ position: 'absolute', left: chip.x, top: chip.y, opacity: chip.opacity, transform: `scale(${chip.scale})`, transformOrigin: '30% 50%' }}>
              <FileChip tk={tk} lift={chip.lift} />
            </div>
          ) : null}
          <Chrome t={t} running={running} />
        </div>
      </CameraView>
      <Pupil x={ps.x} y={ps.y} t={t} opacity={pOpacity} clicks={CLICKS} />
    </AbsoluteFill>
  );
};
