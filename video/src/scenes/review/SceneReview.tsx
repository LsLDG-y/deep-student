import { AbsoluteFill } from 'remotion';
import { camAt, CameraView, clampCam, project, type CamKey } from '../../lib/camera';
import { clamp, ease, lerp, PACE, prog } from '../../lib/time';
import { S } from '../../strings';
import { dark } from '../../theme';
import { Pupil, pathAt } from '../../ui/brand';
import { AgendaWidget, BriefingWidget, DesktopShortcuts } from '../../ui/desk';
import { FC, FcNav, FcSession, FcStats, rateButtonCenter, revealButtonCenter, type FlyDir, type Rating, type SessionState } from '../../ui/flashcards';
import { TODO_ITEMS } from '../../ui/todo';
import { Dock, dockIconCenter, type DockBadge, GENIE_S, IND_S, MenuBar, menuClock, trafficCenter, Wallpaper, WB, WbWindow, winLife } from '../../ui/workbench';
import { wallDrift } from '../day/beats';
import { ANKI_CARDS } from '../practice/beats';
import { MemoryCurves } from './MemoryCurves';

/** 04 练习（工作台部分）与 05 记住的节拍表，单位为脚本秒。 */
export const WK = {
  night0: 16.36, // 夜色以窗口为圆心收拢
  night1: 16.64,
  chrome: 16.54, // 菜单栏 / Dock 入场
  open0: 16.7, // 闪卡窗口弹开（「复习这批」走 API 启动：图标此前不在 Dock 上，按产品回退为窗口中心弹入）
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
  minimize: 22.5, // 点黄灯：闪卡窗口 genie 吸入 Dock
  out0: 22.5, // 记忆曲线面板下沉
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

const dueAt = (t: number) => 12 - WK.cards.filter((c) => c.rating !== 1 && t >= c.rate + 0.02).length;

/** 交接给「第二天」时的桌面状态：两边在 WK.out1 这一帧完全一致。 */
export const nightMenubar = (t: number) => ({
  app: t >= WK.open0 && t < WK.minimize ? S.apps.flashcards : S.desk.appName,
  clock: menuClock(2, 21, 30),
  due: dueAt(t),
});

export const nightDock = (t: number): { running: string[]; badges: Record<string, DockBadge>; indicator: Record<string, number> } => ({
  running: t >= WK.open0 ? ['chat', 'flashcards'] : ['chat'],
  badges: { flashcards: { kind: 'count', value: dueAt(t) } },
  indicator: { flashcards: (t - WK.open0) / IND_S },
});

/** 有可见窗口时桌面小组件淡到 0.55（280ms ease-out）。 */
export const nightDim = (t: number) => prog(t, WK.open0, WK.open0 + 0.14, ease.wbOut) * (1 - prog(t, WK.minimize + GENIE_S, WK.minimize + GENIE_S + 0.14, ease.wbOut));

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

const MIN_BTN = { x: WIN_X1 + trafficCenter(1).x, y: WIN.y + trafficCenter(1).y };

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
  // 收场：瞳点回来点黄灯
  pts.push([WK.minimize - 0.4, MIN_BTN.x + 160, MIN_BTN.y + 150]);
  pts.push([WK.minimize - 0.05, MIN_BTN.x, MIN_BTN.y]);
  pts.push([WK.minimize + 0.3, MIN_BTN.x + 50, MIN_BTN.y + 60]);
  return pts;
})();
const REVIEW_CLICKS = [...WK.cards.flatMap((c) => [c.show, c.rate]), WK.minimize];

export const SceneReview = ({ t }: { t: number }) => {
  const tk = dark;
  const cam = clampCam(camAt(t, REVIEW_CAM));
  const night = prog(t, WK.night0, WK.night1, ease.inOutCubic);
  const chrome = springChrome(t);
  const x = winX(t);
  const dock = nightDock(t);
  const flash = winLife(t, { x, y: WIN.y, w: WIN.w, h: WIN.h }, { openAt: WK.open0, openFrom: null, minimizeAt: WK.minimize, minimizeTo: dockIconCenter('flashcards', dock.running) });
  // 记忆曲线面板（片中的信息图，不是产品界面）与窗口同时下沉淡出
  const curvesOut = prog(t, WK.out0, WK.out0 + 0.26, ease.inCubic);
  const statsK = prog(t, WK.stats, WK.stats + 0.2, ease.brand);
  const session = sessionAt(t);
  const bar = nightMenubar(t);
  const dim = nightDim(t);

  const pw = pathAt(t, REVIEW_PUPIL);
  const pScreen = project(cam, pw.x, pw.y);
  const pOpacity = Math.max(
    prog(t, WK.cards[0].at + 0.04, WK.cards[0].at + 0.14) * (1 - prog(t, WK.cards[2].rate + 0.12, WK.cards[2].rate + 0.22)),
    prog(t, WK.minimize - 0.4, WK.minimize - 0.28) * (1 - prog(t, WK.minimize + 0.2, WK.minimize + 0.32)),
  );

  return (
    <AbsoluteFill>
      <CameraView cam={cam}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080 }}>
          <Wallpaper drift={wallDrift(t)} style={{ opacity: night }} />
          <div style={{ position: 'absolute', inset: 0, opacity: night }}>
            <DesktopShortcuts tk={tk} />
            <AgendaWidget tk={tk} dim={dim} day={2} items={TODO_ITEMS} />
            <BriefingWidget tk={tk} dim={dim} due={dock.badges.flashcards.kind === 'count' ? dock.badges.flashcards.value : 0} done={2} total={2} />
          </div>
          {flash.visible ? (
            <WbWindow tk={tk} rect={{ x, y: WIN.y, w: WIN.w, h: WIN.h }} title={S.apps.flashcards} focused={t < WK.minimize} style={flash.style}>
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
          <div style={{ position: 'absolute', inset: 0, opacity: clamp(chrome * 1.4), transform: `translateY(${(1 - chrome) * -WB.menubar}px)` }}>
            <MenuBar tk={tk} app={bar.app} clock={bar.clock} due={bar.due} />
          </div>
          <div style={{ position: 'absolute', inset: 0, opacity: clamp(chrome * 1.4), transform: `translateY(${(1 - chrome) * 90}px)` }}>
            <Dock tk={tk} running={dock.running} badges={dock.badges} indicator={dock.indicator} />
          </div>
        </div>
      </CameraView>
      <Pupil x={pScreen.x} y={pScreen.y} t={t} opacity={pOpacity} clicks={REVIEW_CLICKS} />
    </AbsoluteFill>
  );
};

/** 菜单栏 / Dock 随夜色一起入场（工作台外壳就位，不属于产品动效）。 */
const springChrome = (t: number) => prog(t, WK.chrome, WK.chrome + 0.22, ease.wbOut);
