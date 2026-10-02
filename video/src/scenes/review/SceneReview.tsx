import { AbsoluteFill } from 'remotion';
import { camAt, CameraView, project, type CamKey } from '../../lib/camera';
import { springSheet } from '../../lib/motion';
import { clamp, ease, lerp, PACE, prog, springAt } from '../../lib/time';
import { S } from '../../strings';
import { dark } from '../../theme';
import { Pupil, pathAt } from '../../ui/brand';
import { FC, FcNav, FcSession, FcStats, rateButtonCenter, revealButtonCenter, type FlyDir, type Rating, type SessionState } from '../../ui/flashcards';
import { Dock, dockIconCenter, MenuBar, Wallpaper, WB, WbWindow } from '../../ui/workbench';
import { wallDrift } from '../day/beats';
import { ANKI_CARDS } from '../practice/beats';
import { MemoryCurves } from './MemoryCurves';

/** 04 练习（工作台部分）与 05 记住的节拍表，单位为脚本秒。 */
export const WK = {
  night0: 16.36, // 夜色以窗口为圆心收拢
  night1: 16.64,
  chrome: 16.54, // 菜单栏 / Dock 入场
  bounce: 16.62, // Dock 上的闪卡图标弹跳
  open0: 16.7, // 闪卡窗口从 Dock 弹开
  open1: 17.0,
  cards: [
    { at: 16.98, show: 17.24, rate: 17.55, rating: 3 as Rating },
    { at: 17.64, show: 17.88, rate: 18.14, rating: 4 as Rating },
    { at: 18.26, show: 18.7, rate: 19.18, rating: 1 as Rating },
  ],
  next: 19.3, // ξ 那张飞出后，下一张卡入场（不再交互）
  glide0: 19.34, // 窗口左移，记忆曲线面板入场
  glide1: 19.84,
  curves: 19.74,
  stats: 21.24, // 窗口切到「统计」
  out0: 22.5, // 转场到收尾
  out1: 23.0,
} as const;

const REVIEW = [ANKI_CARDS[0], ANKI_CARDS[10], ANKI_CARDS[1], ANKI_CARDS[2]];
/** 新卡首评预览（FSRS-5 默认参数 + 学习步 1m / 10m）。 */
const INTERVALS: [string, string, string, string] = ['1m', '6m', '10m', '16d'];
const FLY: Record<Rating, FlyDir> = { 1: 'left', 2: 'down', 3: 'right', 4: 'up' };
const RATING_LABEL: Record<Rating, string> = { 1: S.fc.again, 2: S.fc.hard, 3: S.fc.good, 4: S.fc.easy };

const WIN = { w: 860, h: 740, y: 120 } as const;
const WIN_X0 = (1920 - WIN.w) / 2;
const WIN_X1 = 132;
const CONTENT_TOP = WB.titlebar + FC.navH;
const CONTENT_H = WIN.h - CONTENT_TOP;
export const CURVE_RECT = { x: 1044, y: 176, w: 760, h: 620 };

const winX = (t: number) => lerp(WIN_X0, WIN_X1, prog(t, WK.glide0, WK.glide1, ease.inOutCubic));
const pressAt = (t: number, at: number, w = 0.1) => Math.max(0, 1 - Math.abs(t - at) / w);

// 复习时窗口下缘压在 y≈905 以上，给左下角字幕留位
const REVIEW_CAM: CamKey[] = [
  [WK.night0, { x: 960, y: 540, zoom: 1 }],
  [WK.open1, { x: 960, y: 540, zoom: 1.02 }, ease.linear],
  [WK.cards[0].at + 0.3, { x: 960, y: 544, zoom: 1.12 }, ease.inOutCubic],
  [WK.cards[1].rate, { x: 960, y: 548, zoom: 1.14 }, ease.linear],
  [WK.cards[2].show - 0.14, { x: 960, y: 552, zoom: 1.18 }, ease.inOutCubic],
  [WK.cards[2].rate + 0.06, { x: 960, y: 556, zoom: 1.19 }, ease.linear],
  [WK.glide1, { x: 960, y: 526, zoom: 1.0 }, ease.inOutCubic],
  [WK.stats, { x: 960, y: 526, zoom: 1.01 }, ease.linear],
  [WK.out0, { x: 960, y: 528, zoom: 1.02 }, ease.linear],
  [WK.out1 - 0.06, { x: 960, y: 540, zoom: 1.0 }, ease.inOutCubic],
];

/** 交接给「第二天」时的桌面状态：两边在 WK.out1 这一帧完全一致。 */
export const nightMenubar = (t: number) => {
  const focusSec = 18 * 60 + 24 - Math.floor((t - WK.night0) * PACE);
  return {
    app: t < WK.out0 + 0.3 ? S.apps.flashcards : 'DeepStudent',
    due: 12 - WK.cards.filter((c) => c.rating !== 1 && t >= c.rate + 0.02).length,
    clock: '周五 21:30',
    focus: `${Math.floor(focusSec / 60)}:${String(focusSec % 60).padStart(2, '0')}`,
  };
};
export const NIGHT_RUNNING = ['chat', 'flashcards'];

/** 当前复习会话状态（随时间推进的评分、计数、飞出、翻面）。 */
const sessionAt = (t: number): SessionState => {
  const cs = [...WK.cards, { at: WK.next, show: Infinity, rate: Infinity, rating: 3 as Rating }];
  let idx = 0;
  for (let i = 1; i < cs.length; i++) if (t >= cs[i].at) idx = i;
  const c = cs[idx];
  const doneCount = cs.filter((x) => t >= x.rate + 0.02).length;
  const prev = idx > 0 ? cs[idx - 1] : null;
  const leavingK = prev ? prog(t, prev.rate + 0.04, prev.rate + 0.3) : 1;
  const lastRated = [...cs].reverse().find((x) => t >= x.rate + 0.02);
  const streak = cs.slice(0, doneCount).reduce((s, x) => (x.rating === 1 ? 0 : s + 1), 0);
  const learnAdds = cs.slice(0, doneCount).filter((x) => x.rating !== 4).length;
  const nudgeSrc = lastRated ? { at: lastRated.rate, rating: lastRated.rating } : null;
  const hover = (r: Rating) => t >= c.rate - 0.12 && t < c.rate + 0.02 && c.rating === r;
  return {
    card: REVIEW[idx],
    flip: prog(t, c.show, c.show + 0.2),
    enter: prog(t, c.at, c.at + 0.14),
    leaving: prev && leavingK < 1 ? { card: REVIEW[idx - 1], k: leavingK, dir: FLY[prev.rating], rating: prev.rating } : undefined,
    rateMode: prog(t, c.show + 0.14, c.show + 0.26),
    intervals: INTERVALS,
    revealHover: t >= c.show - 0.1 && t < c.show + 0.02 ? 1 : 0,
    revealPress: pressAt(t, c.show, 0.08),
    hoverRating: ([1, 2, 3, 4] as Rating[]).find(hover) ?? null,
    pressRating: t >= c.rate - 0.03 && t < c.rate + 0.16 ? c.rating : null,
    pressK: prog(t, c.rate - 0.03, c.rate + 0.12),
    progress: doneCount / (12 + learnAdds),
    rated: doneCount,
    remaining: 12 - doneCount + learnAdds,
    streak,
    streakPop: lastRated ? prog(t, lastRated.rate + 0.02, lastRated.rate + 0.16) : 0,
    newCount: 12 - doneCount,
    learnCount: learnAdds,
    timer: `0:${String(Math.max(0, Math.floor((t - WK.cards[0].at) * PACE)) + 6).padStart(2, '0')}`,
    learnChip: prog(t, cs[2].rate + 0.08, cs[2].rate + 0.22, ease.brand),
    nudge: nudgeSrc ? { text: S.fc.undoNudge(RATING_LABEL[nudgeSrc.rating]), k: prog(t, nudgeSrc.at + 0.04, nudgeSrc.at + 0.5) } : null,
    cardHover: t >= c.at + 0.1 && t < c.show + 0.1 ? 1 : 0,
  };
};

const REVIEW_PUPIL: Array<[number, number, number]> = (() => {
  const pts: Array<[number, number, number]> = [];
  const o = { x: WIN_X0, y: WIN.y + CONTENT_TOP };
  const at = (time: number, p: { x: number; y: number }) => pts.push([time, o.x + p.x, o.y + p.y]);
  const reveal = revealButtonCenter(WIN.w, CONTENT_H);
  at(WK.cards[0].at + 0.06, { x: WIN.w * 0.66, y: CONTENT_H * 0.46 });
  WK.cards.forEach((c, i) => {
    if (i === 2) at(c.at + 0.18, { x: WIN.w * 0.56, y: CONTENT_H * 0.42 });
    at(c.show - 0.05, reveal);
    at(c.show + 0.06, reveal);
    const rb = rateButtonCenter(WIN.w, CONTENT_H, c.rating);
    at(c.rate - 0.05, rb);
    at(c.rate + 0.08, rb);
  });
  return pts;
})();
const REVIEW_CLICKS = WK.cards.flatMap((c) => [c.show, c.rate]);

export const SceneReview = ({ t }: { t: number }) => {
  const tk = dark;
  const cam = camAt(t, REVIEW_CAM);
  const night = prog(t, WK.night0, WK.night1, ease.inOutCubic);
  const chrome = springAt(t, WK.chrome, { stiffness: 260, damping: 24 });
  const bounceK = t >= WK.bounce ? Math.max(0, Math.sin(((t - WK.bounce) / 0.16) * Math.PI)) * (t < WK.bounce + 0.16 ? 1 : 0) : 0;
  const open = springAt(t, WK.open0, springSheet);
  const icon = dockIconCenter('flashcards');
  const x = winX(t);
  const winCx = x + WIN.w / 2;
  const winCy = WIN.y + WIN.h / 2;
  // 收场：闪卡窗口缩回 Dock，记忆曲线面板下沉淡出，桌面留给「第二天」
  const close = prog(t, WK.out0, WK.out0 + 0.32, ease.inCubic);
  const curvesOut = prog(t, WK.out0, WK.out0 + 0.26, ease.inCubic);
  const shown = open * (1 - close);
  const s = 0.34 + 0.66 * shown;
  const tx = (icon.x - winCx) * (1 - shown);
  const ty = (icon.y - winCy) * (1 - shown);
  const statsK = prog(t, WK.stats, WK.stats + 0.2, ease.brand);
  const session = sessionAt(t);
  const bar = nightMenubar(t);

  const pw = pathAt(t, REVIEW_PUPIL);
  const pScreen = project(cam, pw.x, pw.y);
  const pOpacity = prog(t, WK.cards[0].at + 0.04, WK.cards[0].at + 0.14) * (1 - prog(t, WK.cards[2].rate + 0.12, WK.cards[2].rate + 0.22));

  return (
    <AbsoluteFill>
      <CameraView cam={cam}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080 }}>
          <Wallpaper drift={wallDrift(t)} style={{ opacity: night }} />
          <div style={{ opacity: clamp(chrome * 1.4), transform: `translateY(${(1 - chrome) * -WB.menubar}px)` }}>
            <MenuBar tk={tk} app={bar.app} due={bar.due} clock={bar.clock} focus={bar.focus} />
          </div>
          {shown > 0.001 ? (
            <WbWindow
              tk={tk}
              rect={{ x, y: WIN.y, w: WIN.w, h: WIN.h }}
              title={S.apps.flashcards}
              style={{
                opacity: clamp(shown * 3),
                transform: `translate(${tx}px, ${ty}px) scale(${s})`,
                transformOrigin: '50% 50%',
              }}
            >
              <FcNav tk={tk} active={statsK > 0.5 ? 'statistics' : 'today'} />
              <div style={{ position: 'absolute', left: 0, top: FC.navH, width: WIN.w, height: CONTENT_H, overflow: 'hidden' }}>
                {statsK < 1 ? (
                  <div style={{ position: 'absolute', inset: 0, opacity: 1 - statsK }}>
                    <FcSession tk={tk} s={session} w={WIN.w} h={CONTENT_H} />
                  </div>
                ) : null}
                {statsK > 0 ? <FcStats tk={tk} t={t} start={WK.stats} w={WIN.w} /> : null}
              </div>
            </WbWindow>
          ) : null}
          {curvesOut < 1 ? (
            <div style={{ opacity: 1 - curvesOut, transform: `translateY(${curvesOut * 28}px)` }}>
              <MemoryCurves tk={tk} t={t} start={WK.curves} rect={CURVE_RECT} />
            </div>
          ) : null}
          <div style={{ opacity: clamp(chrome * 1.4), transform: `translateY(${(1 - chrome) * 90}px)` }}>
            <Dock tk={tk} running={NIGHT_RUNNING} bounce={{ flashcards: bounceK * 16 }} />
          </div>
        </div>
      </CameraView>
      <Pupil x={pScreen.x} y={pScreen.y} t={t} opacity={pOpacity} clicks={REVIEW_CLICKS} />
    </AbsoluteFill>
  );
};
