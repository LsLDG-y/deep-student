import type { CSSProperties, ReactNode } from 'react';
import { AbsoluteFill } from 'remotion';
import { camAt, CameraView, project, type CamKey } from '../../lib/camera';
import { springSheet } from '../../lib/motion';
import { clamp, ease, prog, springAt } from '../../lib/time';
import { dark, light, type Tokens } from '../../theme';
import { Pupil, pathAt } from '../../ui/brand';
import { essayGradeCenter, ESSAY_H, ESSAY_W, EssayView, type EssayState } from '../../ui/essay';
import { EXAM_DROP, EXAM_H, EXAM_W, ExamView, examOptionCenter, examStartCenter, FileChip, type ExamState } from '../../ui/exam';
import { CHAT_H, CHAT_W, HUB_H, HUB_W, HubIndexView, NOTE_H, NOTE_W, NoteView, ResearchChat, type ResearchState } from '../../ui/research';
import { transButtonCenter, TRANS_H, TRANS_W, TranslateView, type TransState } from '../../ui/translate';
import { focusButtonCenter, TODAY_H, TODAY_W, TodayView } from '../../ui/today';
import { Dock, dockIconCenter, MenuBar, Wallpaper, WbWindow } from '../../ui/workbench';
import { nightMenubar, NIGHT_RUNNING } from '../review/SceneReview';
import { DAY, wallDrift } from './beats';

/**
 * 第二幕「第二天」：夜里复习完的工作台迎来清晨，之后每章从 Dock 打开一个应用。
 * 桌面（壁纸 / 菜单栏 / Dock）全程常驻，窗口在其上开合；镜头是 2D 推拉（与夜里那段同一套）。
 */
type Rect = { x: number; y: number; w: number; h: number };

export const TODAY_RECT: Rect = { x: (1920 - TODAY_W) / 2, y: 150, w: TODAY_W, h: TODAY_H };
export const EXAM_RECT: Rect = { x: (1920 - EXAM_W) / 2, y: 128, w: EXAM_W, h: EXAM_H };
const inWin = (r: Rect, p: { x: number; y: number }) => ({ x: r.x + p.x, y: r.y + 38 + p.y });

export const ESSAY_RECT: Rect = { x: (1920 - ESSAY_W) / 2, y: 126, w: ESSAY_W, h: ESSAY_H };
export const TRANS_RECT: Rect = { x: 420, y: 176, w: TRANS_W, h: TRANS_H };

const pressAt = (t: number, at: number, w = 0.08) => Math.max(0, 1 - Math.abs(t - at) / w);
const hoverAt = (t: number, at: number) => (t >= at - 0.16 && t < at + 0.02 ? 1 : 0);

const essayState = (t: number): EssayState => ({
  gradeHover: hoverAt(t, DAY.essayGrade),
  gradePress: pressAt(t, DAY.essayGrade),
  marks: prog(t, DAY.essayGrade + 0.08, DAY.essayScore + 0.75),
  score: prog(t, DAY.essayScore, DAY.essayScore + 0.9),
  polish: prog(t, DAY.essayPolish, DAY.essayPolish + 0.9),
  view: 0,
});

const transState = (t: number): TransState => ({
  run: prog(t, DAY.translateRun + 0.06, DAY.writingOut - 0.55),
  press: pressAt(t, DAY.translateRun),
  scroll: ease.inOutCubic(prog(t, DAY.translateRun + 1.0, DAY.writingOut - 0.1)),
});

export const CHAT_RECT: Rect = { x: 230, y: 118, w: CHAT_W, h: CHAT_H };
export const NOTE_RECT: Rect = { x: 1130, y: 150, w: NOTE_W, h: NOTE_H };
export const HUB_RECT: Rect = { x: (1920 - HUB_W) / 2, y: 196, w: HUB_W, h: HUB_H };
const DL_BTN = { x: CHAT_W - 126, y: 322 };

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

const night = (t: number) => 1 - prog(t, DAY.dawn0, DAY.dawn1, ease.inOutCubic);
const themeK = (t: number) => prog(t, DAY.theme0, DAY.theme1, ease.inOutCubic);

/** 窗口从 Dock 图标弹开、关闭时缩回去（与夜里闪卡窗口同一套弹簧）。 */
const winAnim = (t: number, rect: Rect, icon: string, openAt: number, closeAt?: number) => {
  const open = springAt(t, openAt, springSheet);
  const close = closeAt === undefined ? 0 : prog(t, closeAt, closeAt + 0.3, ease.inCubic);
  const shown = open * (1 - close);
  const c = dockIconCenter(icon);
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const style: CSSProperties = {
    opacity: clamp(shown * 3),
    transform: `translate(${(c.x - cx) * (1 - shown)}px, ${(c.y - cy) * (1 - shown)}px) scale(${0.34 + 0.66 * shown})`,
    transformOrigin: '50% 50%',
  };
  return { shown, style };
};

const dockBounce = (t: number, at: number) => (t >= at && t < at + 0.16 ? Math.sin(((t - at) / 0.16) * Math.PI) * 16 : 0);

/** 菜单栏：时钟翻页前与夜里那段逐帧一致；白天随章节切换前台应用、走时间、番茄钟倒计时。 */
const dayMenubar = (t: number) => {
  if (t < DAY.clock) return nightMenubar(t);
  const app =
    t < DAY.todayOpen
      ? 'DeepStudent'
      : t < DAY.examOpen
        ? '待办'
        : t < DAY.essayOpen
          ? '题目集'
          : t < DAY.translateOpen
            ? '作文批改'
            : t < DAY.researchOpen
              ? '翻译'
              : t < DAY.researchNote
                ? '对话'
                : t < DAY.paperSend
                  ? '笔记'
                  : t < DAY.hubIndex
                    ? '对话'
                    : '资源库';
  const clock = t < DAY.examOpen ? '周六 07:30' : t < DAY.essayOpen ? '周六 09:05' : t < DAY.translateOpen ? '周六 14:10' : t < DAY.researchOpen ? '周六 15:40' : '周六 20:05';
  let focus = '25:00';
  if (t >= DAY.todayFocus) {
    const left = Math.max(0, 25 * 60 - Math.floor((t - DAY.todayFocus) * 2));
    focus = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  }
  return { app, due: t < DAY.examMastery ? 12 : 13, clock, focus };
};

const DAY_CAM: CamKey[] = [
  [DAY.start, { x: 960, y: 540, zoom: 1 }],
  [DAY.dawn1, { x: 960, y: 540, zoom: 1.015 }, ease.linear],
  [DAY.todayOpen - 0.05, { x: 960, y: 540, zoom: 1.015 }, ease.linear],
  [DAY.todayOpen + 0.55, { x: 960, y: 500, zoom: 1.1 }, ease.inOutCubic],
  [DAY.todayFocus - 0.4, { x: 990, y: 498, zoom: 1.12 }, ease.linear],
  [DAY.todayFocus + 0.05, { x: 1150, y: 560, zoom: 1.3 }, ease.inOutCubic],
  [DAY.todayOut, { x: 1150, y: 560, zoom: 1.32 }, ease.linear],
  [DAY.examOpen, { x: 960, y: 540, zoom: 1.02 }, ease.inOutCubic],
  [EXAM_GRAB, { x: 900, y: 560, zoom: 1.02 }, ease.inOutCubic],
  [DAY.examDrop + 0.25, { x: 990, y: 520, zoom: 1.1 }, ease.inOutCubic],
  [DAY.examParsed, { x: 1000, y: 516, zoom: 1.12 }, ease.linear],
  [DAY.examStart + 0.3, { x: 920, y: 470, zoom: 1.24 }, ease.inOutCubic],
  [DAY.examExplain + 0.5, { x: 920, y: 520, zoom: 1.24 }, ease.inOutCubic],
  [DAY.examMastery - 0.05, { x: 930, y: 560, zoom: 1.22 }, ease.linear],
  [DAY.examMastery + 0.5, { x: 1010, y: 520, zoom: 1.1 }, ease.inOutCubic],
  [DAY.examOut, { x: 1010, y: 520, zoom: 1.12 }, ease.linear],
  [DAY.essayOpen, { x: 960, y: 540, zoom: 1.02 }, ease.inOutCubic],
  [DAY.essayGrade - 0.3, { x: 1040, y: 470, zoom: 1.08 }, ease.inOutCubic],
  [DAY.essayGrade + 0.45, { x: 780, y: 500, zoom: 1.24 }, ease.inOutCubic],
  [DAY.essayScore + 0.1, { x: 820, y: 520, zoom: 1.24 }, ease.linear],
  [DAY.essayScore + 0.6, { x: 990, y: 520, zoom: 1.1 }, ease.inOutCubic],
  [DAY.essayPolish - 0.05, { x: 1000, y: 520, zoom: 1.1 }, ease.linear],
  [DAY.essayPolish + 0.45, { x: 1300, y: 500, zoom: 1.3 }, ease.inOutCubic],
  [DAY.translateOpen - 0.05, { x: 1310, y: 520, zoom: 1.32 }, ease.linear],
  [DAY.translateOpen + 0.45, { x: 1040, y: 556, zoom: 1.04 }, ease.inOutCubic],
  [DAY.translateRun + 0.35, { x: 1040, y: 540, zoom: 1.18 }, ease.inOutCubic],
  [DAY.writingOut - 0.1, { x: 1040, y: 580, zoom: 1.22 }, ease.linear],
  [DAY.researchOpen, { x: 960, y: 540, zoom: 1.02 }, ease.inOutCubic],
  [DAY.researchSend - 0.15, { x: 760, y: 540, zoom: 1.12 }, ease.inOutCubic],
  [DAY.researchSteps + 0.35, { x: 740, y: 470, zoom: 1.24 }, ease.inOutCubic],
  [DAY.researchNote - 0.1, { x: 760, y: 500, zoom: 1.24 }, ease.linear],
  [DAY.researchNote + 0.45, { x: 1300, y: 520, zoom: 1.18 }, ease.inOutCubic],
  [DAY.paperSend - 0.05, { x: 1290, y: 520, zoom: 1.18 }, ease.linear],
  [DAY.paperSend + 0.45, { x: 740, y: 540, zoom: 1.18 }, ease.inOutCubic],
  [DAY.paperDownload + 0.3, { x: 820, y: 500, zoom: 1.26 }, ease.inOutCubic],
  [DAY.hubIndex - 0.05, { x: 830, y: 510, zoom: 1.24 }, ease.linear],
  [DAY.hubIndex + 0.45, { x: 960, y: 520, zoom: 1.12 }, ease.inOutCubic],
  [DAY.end - 0.3, { x: 1000, y: 500, zoom: 1.22 }, ease.linear],
  [DAY.end + 0.4, { x: 1000, y: 500, zoom: 1.12 }, ease.inOutCubic],
];

const PUPIL_PATH: Array<[number, number, number]> = (() => {
  const todo = dockIconCenter('todo');
  const f = focusButtonCenter();
  const fx = TODAY_RECT.x + f.x;
  const fy = TODAY_RECT.y + 38 + f.y;
  const drop = inWin(EXAM_RECT, EXAM_DROP);
  const start = inWin(EXAM_RECT, examStartCenter());
  const optA = inWin(EXAM_RECT, examOptionCenter(0));
  return [
    [DAY.todayOpen - 0.45, todo.x + 120, todo.y - 160],
    [DAY.todayOpen - 0.08, todo.x, todo.y],
    [DAY.todayOpen + 0.5, todo.x + 40, todo.y - 220],
    [DAY.todayFocus - 0.08, fx, fy],
    [DAY.todayFocus + 0.3, fx + 6, fy + 2],
    [DAY.examOpen + 0.15, CHIP_HOME.x + 260, CHIP_HOME.y - 40],
    [EXAM_GRAB - 0.04, CHIP_HOME.x + 40, CHIP_HOME.y + 24],
    [DAY.examDrop - 0.04, drop.x - 110, drop.y - 6],
    [DAY.examParsed - 0.3, drop.x + 60, drop.y + 40],
    [DAY.examStart - 0.06, start.x, start.y],
    [DAY.examStart + 0.25, start.x + 10, start.y - 20],
    [DAY.examPick - 0.07, optA.x, optA.y],
    [DAY.examPick + 0.35, optA.x + 40, optA.y + 120],
    [DAY.essayOpen + 0.35, ESSAY_RECT.x + ESSAY_W - 260, ESSAY_RECT.y + 200],
    [DAY.essayGrade - 0.06, ESSAY_RECT.x + essayGradeCenter().x, ESSAY_RECT.y + 38 + essayGradeCenter().y],
    [DAY.essayGrade + 0.4, ESSAY_RECT.x + ESSAY_W - 300, ESSAY_RECT.y + 300],
    [DAY.translateOpen + 0.35, TRANS_RECT.x + TRANS_W - 240, TRANS_RECT.y + 160],
    [DAY.translateRun - 0.06, TRANS_RECT.x + transButtonCenter().x, TRANS_RECT.y + 38 + transButtonCenter().y],
    [DAY.translateRun + 0.4, TRANS_RECT.x + TRANS_W - 300, TRANS_RECT.y + 240],
    [DAY.paperDownload - 0.5, CHAT_RECT.x + DL_BTN.x - 220, CHAT_RECT.y + 38 + DL_BTN.y + 160],
    [DAY.paperDownload - 0.06, CHAT_RECT.x + DL_BTN.x, CHAT_RECT.y + 38 + DL_BTN.y],
    [DAY.paperDownload + 0.4, CHAT_RECT.x + DL_BTN.x - 60, CHAT_RECT.y + 38 + DL_BTN.y + 120],
  ];
})();
const CLICKS = [DAY.todayOpen - 0.05, DAY.todayFocus, DAY.examStart, DAY.examPick, DAY.essayGrade, DAY.translateRun, DAY.paperDownload];

const Desktop = ({ t, running, bounce }: { t: number; running: string[]; bounce: Record<string, number> }) => {
  const k = themeK(t);
  const bar = dayMenubar(t);
  const layer = (tk: Tokens, opacity: number, children: ReactNode) => (opacity > 0.001 ? <div style={{ position: 'absolute', inset: 0, opacity }}>{children}</div> : null);
  return (
    <>
      <Wallpaper drift={wallDrift(t)} night={night(t)} />
      {layer(dark, 1 - k, <MenuBar tk={dark} app={bar.app} due={bar.due} clock={bar.clock} focus={bar.focus} />)}
      {layer(light, k, <MenuBar tk={light} app={bar.app} due={bar.due} clock={bar.clock} focus={bar.focus} />)}
      {layer(dark, 1 - k, <Dock tk={dark} running={running} bounce={bounce} />)}
      {layer(light, k, <Dock tk={light} running={running} bounce={bounce} />)}
    </>
  );
};

export const SceneDay = ({ t }: { t: number }) => {
  const tk = light;
  const cam = camAt(t, DAY_CAM);
  const today = winAnim(t, TODAY_RECT, 'todo', DAY.todayOpen, DAY.todayOut);
  const exam = winAnim(t, EXAM_RECT, 'exam', DAY.examOpen, DAY.examOut);
  const essay = winAnim(t, ESSAY_RECT, 'essay', DAY.essayOpen, DAY.writingOut);
  const trans = winAnim(t, TRANS_RECT, 'translation', DAY.translateOpen, DAY.writingOut + 0.04);
  const chat = winAnim(t, CHAT_RECT, 'chat', DAY.researchOpen);
  const note = winAnim(t, NOTE_RECT, 'notes', DAY.researchNote);
  const hub = winAnim(t, HUB_RECT, 'files', DAY.hubIndex);
  const opened: Array<[string, number]> = [
    ['todo', DAY.todayOpen],
    ['exam', DAY.examOpen],
    ['essay', DAY.essayOpen],
    ['translation', DAY.translateOpen],
    ['chat', DAY.researchOpen],
    ['notes', DAY.researchNote],
    ['files', DAY.hubIndex],
  ];
  const exit = prog(t, DAY.end - 0.3, DAY.end + 0.2, ease.inOutCubic);
  const running = [...NIGHT_RUNNING, ...opened.filter(([, at]) => t >= at).map(([id]) => id)];
  const bounce = Object.fromEntries(opened.map(([id, at]) => [id, dockBounce(t, at - 0.12)]));
  const focusHover = t >= DAY.todayFocus - 0.14 && t < DAY.todayFocus + 0.02 ? 1 : 0;
  const focusPress = Math.max(0, 1 - Math.abs(t - DAY.todayFocus) / 0.08);
  const chip = chipPose(t);

  const pw = pathAt(t, PUPIL_PATH);
  const ps = project(cam, pw.x, pw.y);
  const pOpacity =
    prog(t, PUPIL_PATH[0][0], PUPIL_PATH[0][0] + 0.12) * (1 - prog(t, DAY.todayOut - 0.1, DAY.todayOut + 0.1)) +
    prog(t, DAY.examOpen + 0.1, DAY.examOpen + 0.22) * (1 - prog(t, DAY.examPick + 0.4, DAY.examPick + 0.55)) +
    prog(t, DAY.essayOpen + 0.25, DAY.essayOpen + 0.4) * (1 - prog(t, DAY.essayGrade + 0.4, DAY.essayGrade + 0.55)) +
    prog(t, DAY.translateOpen + 0.25, DAY.translateOpen + 0.4) * (1 - prog(t, DAY.translateRun + 0.4, DAY.translateRun + 0.55)) +
    prog(t, DAY.paperDownload - 0.55, DAY.paperDownload - 0.4) * (1 - prog(t, DAY.paperDownload + 0.4, DAY.paperDownload + 0.55));

  return (
    <AbsoluteFill style={{ opacity: 1 - exit, transform: `scale(${1 - 0.04 * exit})` }}>
      <CameraView cam={cam}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080 }}>
          <Desktop t={t} running={running} bounce={bounce} />
          {today.shown > 0.001 ? (
            <WbWindow tk={tk} rect={TODAY_RECT} title="今日" style={today.style}>
              <TodayView tk={tk} t={t} open={clamp((t - DAY.todayOpen) / 0.9)} focusAt={DAY.todayFocus} focusHover={focusHover} focusPress={focusPress} todoDone={[0, 0, 0, 0]} />
            </WbWindow>
          ) : null}
          {exam.shown > 0.001 ? (
            <WbWindow tk={tk} rect={EXAM_RECT} title="题目集工作台" style={exam.style}>
              <ExamView tk={tk} s={examState(t)} />
            </WbWindow>
          ) : null}
          {essay.shown > 0.001 ? (
            <WbWindow tk={tk} rect={ESSAY_RECT} title="作文批改" focused={t < DAY.translateOpen} style={essay.style}>
              <EssayView tk={tk} s={essayState(t)} />
            </WbWindow>
          ) : null}
          {trans.shown > 0.001 ? (
            <WbWindow tk={tk} rect={TRANS_RECT} title="翻译工作台" style={trans.style}>
              <TranslateView tk={tk} s={transState(t)} />
            </WbWindow>
          ) : null}
          {(() => {
            const chatWin =
              chat.shown > 0.001 ? (
                <WbWindow key="chat" tk={tk} rect={CHAT_RECT} title="对话" focused={t < DAY.researchNote || (t >= DAY.paperSend && t < DAY.hubIndex)} style={chat.style}>
                  <ResearchChat tk={tk} s={researchState(t)} t={t} />
                </WbWindow>
              ) : null;
            const noteWin =
              note.shown > 0.001 ? (
                <WbWindow key="note" tk={tk} rect={NOTE_RECT} title="笔记" focused={t < DAY.paperSend} style={note.style}>
                  <NoteView tk={tk} k={prog(t, DAY.researchNote + 0.15, DAY.researchNote + 0.75)} />
                </WbWindow>
              ) : null;
            // 焦点回到对话时，对话窗口提到最前
            return t >= DAY.paperSend ? [noteWin, chatWin] : [chatWin, noteWin];
          })()}
          {hub.shown > 0.001 ? (
            <WbWindow tk={tk} rect={HUB_RECT} title="资源库" style={hub.style}>
              <HubIndexView tk={tk} k={prog(t, DAY.hubIndex + 0.3, DAY.end - 0.35)} />
            </WbWindow>
          ) : null}
          {chip.opacity > 0.001 ? (
            <div style={{ position: 'absolute', left: chip.x, top: chip.y, opacity: chip.opacity, transform: `scale(${chip.scale})`, transformOrigin: '30% 50%' }}>
              <FileChip tk={tk} lift={chip.lift} />
            </div>
          ) : null}
        </div>
      </CameraView>
      <Pupil x={ps.x} y={ps.y} t={t} opacity={pOpacity} clicks={CLICKS} />
    </AbsoluteFill>
  );
};
