import { AbsoluteFill } from 'remotion';
import { camAt, CameraView, clampCam, project, type CamKey } from '../../lib/camera';
import { clamp, ease, PACE, prog } from '../../lib/time';
import { S } from '../../strings';
import { dark } from '../../theme';
import { Pupil, pathAt } from '../../ui/brand';
import { AgendaWidget, BriefingWidget, DesktopShortcuts } from '../../ui/desk';
import { exitButtonCenter, FcNav, FcSession, FcStats, FcToday, rateButtonCenter, revealButtonCenter, statsTabCenter, type FcStatsData, type Rating, type SessionState } from '../../ui/flashcards';
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
  next: 19.3, // ξ 那张评「重来」后，下一张卡入场（不再交互）
  curves: 19.74, // 记忆曲线面板入场（窗口右侧）
  exit: 20.9, // 点「← 退出」回到今日页（会话页没有标签栏）
  stats: 21.24, // 点「统计」标签
  minimize: 22.5, // 点黄灯：闪卡窗口 genie 吸入 Dock
  out0: 22.5, // 记忆曲线面板下沉
  out1: 23.0,
} as const;

/** batch 复习顺序 = 卡片块顺序。 */
const REVIEW = ANKI_CARDS.slice(0, WK.cards.length + 1);
const N_BATCH = ANKI_CARDS.length;
/** 新卡首评预览（FSRS-5 默认参数 + 学习步 1m / 10m）。 */
const INTERVALS: [string, string, string, string] = ['1m', '6m', '10m', '16d'];
const RATING_LABEL: Record<Rating, string> = { 1: S.fc.again, 2: S.fc.hard, 3: S.fc.good, 4: S.fc.easy };

/** 窗口按级联 0 号槽落位（桌面 48, 48，下移菜单栏），闪卡默认尺寸 960×680（system/register.tsx），不随记忆曲线面板移动。 */
const WIN = { x: 48, y: WB.menubar + 48, w: 960, h: 680 } as const;
const CONTENT = { x: WIN.x + 1, y: WIN.y + 1 + WB.titlebar };
const STAGE = { x: CONTENT.x + 17.5, y: CONTENT.y + 125.5, w: 923, h: 437.5 };
export const CURVE_RECT = { x: 1044, y: 176, w: 760, h: 620 };

const pressAt = (t: number, at: number, w = 0.1) => Math.max(0, 1 - Math.abs(t - at) / w);

// 复习时镜头推到窗口上（窗口下缘压在 y≈912 以上，给左下角字幕留位），记忆曲线出来时拉开看全
const REVIEW_CAM: CamKey[] = [
  [WK.night0, { x: 960, y: 540, zoom: 1 }],
  [WK.open1, { x: 940, y: 532, zoom: 1.02 }, ease.linear],
  [WK.cards[0].at + 0.3, { x: 528, y: 470, zoom: 1.25 }, ease.inOutCubic],
  [WK.cards[1].rate, { x: 530, y: 474, zoom: 1.27 }, ease.linear],
  [WK.cards[2].show - 0.14, { x: 532, y: 478, zoom: 1.3 }, ease.inOutCubic],
  [WK.cards[2].rate + 0.06, { x: 532, y: 480, zoom: 1.31 }, ease.linear],
  [WK.curves + 0.1, { x: 960, y: 526, zoom: 1.0 }, ease.inOutCubic],
  [WK.stats, { x: 960, y: 526, zoom: 1.01 }, ease.linear],
  [WK.out0, { x: 960, y: 528, zoom: 1.02 }, ease.linear],
  [WK.out1 - 0.06, { x: 960, y: 540, zoom: 1.0 }, ease.inOutCubic],
];

const ratedAt = (t: number) => WK.cards.filter((c) => t >= c.rate + 0.02).length;
const dueAt = (t: number) => N_BATCH - ratedAt(t);

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

const world = (p: { x: number; y: number }) => ({ x: CONTENT.x + p.x, y: CONTENT.y + p.y });
const MIN_BTN = { x: WIN.x + trafficCenter(1).x, y: WIN.y + trafficCenter(1).y };

const REVIEW_PUPIL: Array<[number, number, number]> = (() => {
  const pts: Array<[number, number, number]> = [];
  const at = (time: number, p: { x: number; y: number }) => pts.push([time, p.x, p.y]);
  const reveal = world(revealButtonCenter());
  at(WK.cards[0].at + 0.06, { x: STAGE.x + STAGE.w * 0.62, y: STAGE.y + STAGE.h * 0.5 });
  WK.cards.forEach((c, i) => {
    if (i === 2) at(c.at + 0.18, { x: STAGE.x + STAGE.w * 0.52, y: STAGE.y + STAGE.h * 0.46 });
    at(c.show - 0.05, reveal);
    at(c.show + 0.06, reveal);
    const rb = world(rateButtonCenter(c.rating));
    at(c.rate - 0.05, rb);
    at(c.rate + 0.08, rb);
  });
  // 记忆曲线之后：退出会话 → 统计标签 → 黄灯
  const exit = world(exitButtonCenter());
  const tab = world(statsTabCenter());
  at(WK.exit - 0.3, { x: exit.x + 140, y: exit.y + 160 });
  at(WK.exit - 0.04, exit);
  at(WK.exit + 0.06, exit);
  at(WK.stats - 0.05, tab);
  at(WK.stats + 0.08, tab);
  pts.push([WK.minimize - 0.4, MIN_BTN.x + 160, MIN_BTN.y + 150]);
  pts.push([WK.minimize - 0.05, MIN_BTN.x, MIN_BTN.y]);
  pts.push([WK.minimize + 0.3, MIN_BTN.x + 50, MIN_BTN.y + 60]);
  return pts;
})();
const REVIEW_CLICKS = [...WK.cards.flatMap((c) => [c.show, c.rate]), WK.exit, WK.stats, WK.minimize];

const inStage = (p: { x: number; y: number }) => p.x >= STAGE.x && p.x <= STAGE.x + STAGE.w && p.y >= STAGE.y && p.y <= STAGE.y + STAGE.h;

/** 当前复习会话状态（随时间推进的评分、计数、翻面、换卡）。 */
const sessionAt = (t: number): SessionState => {
  const cs = [...WK.cards, { at: WK.next, show: Infinity, rate: Infinity, rating: 3 as Rating }];
  let idx = 0;
  for (let i = 1; i < cs.length; i++) if (t >= cs[i].at) idx = i;
  const c = cs[idx];
  const rated = cs.filter((x) => t >= x.rate + 0.02);
  const learnAdds = rated.filter((x) => x.rating !== 4).length;
  const last = rated[rated.length - 1];
  // 「点击翻面」只在指针停在卡面上时出现（opacity 160ms）
  const hover = (k: number) => (inStage(pathAt(k, REVIEW_PUPIL)) ? 1 : 0);
  return {
    card: REVIEW[idx],
    back: t >= c.show,
    flipK: prog(t, c.show, c.show + 0.15),
    enter: idx === 0 ? 1 : prog(t, c.at, c.at + 0.13),
    rateMode: prog(t, c.show, c.show + 0.1, ease.outExpo),
    intervals: INTERVALS,
    revealHover: t >= c.show - 0.1 && t < c.show + 0.02 ? 1 : 0,
    revealPress: pressAt(t, c.show, 0.08),
    hoverRating: t >= c.rate - 0.12 && t < c.rate + 0.02 ? c.rating : null,
    pressRating: t >= c.rate && t < c.rate + 0.12 ? c.rating : null,
    pressK: prog(t, c.rate, c.rate + 0.12),
    progress: rated.length / (N_BATCH + learnAdds),
    rated: rated.length,
    newCount: N_BATCH - rated.length,
    learnCount: learnAdds,
    timer: `0:${String(Math.max(0, Math.floor((t - c.at) * PACE))).padStart(2, '0')}`,
    nudge: last ? { text: S.fc.undoNudge(RATING_LABEL[last.rating]), k: prog(t, last.rate + 0.02, last.rate + 0.11) } : null,
    cardHover: (hover(t) + hover(t - 0.04) + hover(t - 0.08)) / 3,
    exitHover: prog(t, WK.exit - 0.08, WK.exit - 0.03) * (t < WK.exit + 0.02 ? 1 : 0),
  };
};

/** 复习完三张后的队列（与 FC=1 取证的 fsrs mock 一致）：386 张老卡 + 12 张新卡，新 9、学习中 2+2、复习中 384+1。 */
const AFTER: FcStatsData = { reviewsToday: 3, due: 9, newCount: 9, learning: 4, review: 385, relearning: 0, suspended: 0, total: 398, streak: 47 };

export const SceneReview = ({ t }: { t: number }) => {
  const tk = dark;
  const cam = clampCam(camAt(t, REVIEW_CAM));
  const night = prog(t, WK.night0, WK.night1, ease.inOutCubic);
  const chrome = springChrome(t);
  const dock = nightDock(t);
  const flash = winLife(t, WIN, { openAt: WK.open0, openFrom: null, minimizeAt: WK.minimize, minimizeTo: dockIconCenter('flashcards', dock.running) });
  // 记忆曲线面板（片中的信息图，不是产品界面）与窗口同时下沉淡出
  const curvesOut = prog(t, WK.out0, WK.out0 + 0.26, ease.inCubic);
  const toToday = prog(t, WK.exit + 0.02, WK.exit + 0.1, ease.brand);
  const onStats = t >= WK.stats + 0.02;
  const session = sessionAt(t);
  const bar = nightMenubar(t);
  const dim = nightDim(t);

  const pw = pathAt(t, REVIEW_PUPIL);
  const pScreen = project(cam, pw.x, pw.y);
  const pOpacity = Math.max(
    prog(t, WK.cards[0].at + 0.04, WK.cards[0].at + 0.14) * (1 - prog(t, WK.cards[2].rate + 0.12, WK.cards[2].rate + 0.22)),
    prog(t, WK.exit - 0.3, WK.exit - 0.2) * (1 - prog(t, WK.minimize + 0.2, WK.minimize + 0.32)),
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
            <WbWindow tk={tk} rect={WIN} title={S.apps.flashcards} focused={t < WK.minimize} style={flash.style}>
              {toToday < 1 ? (
                <div style={{ position: 'absolute', inset: 0, opacity: 1 - toToday }}>
                  <FcSession s={session} />
                </div>
              ) : null}
              {toToday > 0 ? (
                <div style={{ position: 'absolute', inset: 0, opacity: toToday }}>
                  <FcNav active={onStats ? 'statistics' : 'today'} todayBadge={AFTER.due} />
                  {onStats ? (
                    <FcStats t={t} start={WK.stats + 0.02} d={AFTER} />
                  ) : (
                    <FcToday
                      due={AFTER.due}
                      newCount={AFTER.newCount}
                      learning={AFTER.learning}
                      waiting={2}
                      progress={WK.cards.length / N_BATCH}
                      streak={AFTER.streak}
                      upNext={ANKI_CARDS.slice(WK.cards.length).map((c) => c.front)}
                      dateLabel="10月2日星期五"
                      k={toToday}
                    />
                  )}
                </div>
              ) : null}
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
