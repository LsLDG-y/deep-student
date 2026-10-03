import {
  ArrowClockwise,
  ArrowCounterClockwise,
  ArrowLeft,
  ArrowsClockwise,
  CalendarBlank,
  Cards,
  ChartBar,
  ChartPieSlice,
  Eye,
  Fire,
  Info,
  Lightning,
  Pause,
  PencilSimple,
  Play,
  SkipForward,
  Timer,
  X,
} from '@phosphor-icons/react';
import type { CSSProperties, ReactNode } from 'react';
import { ease, prog, rand } from '../lib/time';
import { S } from '../strings';
import { font } from '../theme';

/**
 * 工作台闪卡应用（暗色）。取证 cap/d3-闪卡-*（FC=1 FC_START=1：对话「复习这批」→ batch 会话），
 * DOM probe-fca-* / fcb-*（会话）、fce-today / fce-stats（退出后的今日页、统计页）；坐标相对窗口内容区（标题栏下、1px 边框内）。
 */
export const FC = { navH: 40 } as const;
const FG = 'rgb(245, 245, 245)';
const MUTED = 'rgb(153, 153, 153)';
const BG = 'rgb(31, 31, 31)';
const LINE = 'rgba(46, 46, 46, 0.7)';
const at = (x: number, y: number): CSSProperties => ({ position: 'absolute', left: x, top: y });

export type Rating = 1 | 2 | 3 | 4;
const RATING_KEYS: Array<{ r: Rating; label: string }> = [
  { r: 1, label: S.fc.again },
  { r: 2, label: S.fc.hard },
  { r: 3, label: S.fc.good },
  { r: 4, label: S.fc.easy },
];

/** 评分键配色（RatingBar tone，暗色）：「重来」字是灰的，只有边框带红。 */
export const ratingTone = (r: Rating) => {
  switch (r) {
    case 1:
      return { text: MUTED, border: 'rgba(178, 52, 52, 0.4)', fill: 'rgb(178, 52, 52)' };
    case 2:
      return { text: 'rgb(251, 191, 36)', border: 'rgba(245, 158, 11, 0.4)', fill: 'rgb(245, 158, 11)' };
    case 3:
      return { text: 'rgb(52, 211, 153)', border: 'rgba(16, 185, 129, 0.4)', fill: 'rgb(16, 185, 129)' };
    default:
      return { text: 'rgb(56, 189, 248)', border: 'rgba(14, 165, 233, 0.4)', fill: 'rgb(14, 165, 233)' };
  }
};

const Kbd = ({ children, color = MUTED, style }: { children: ReactNode; color?: string; style?: CSSProperties }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: 15.5,
      padding: '0 4px',
      boxSizing: 'border-box',
      border: `1px solid color-mix(in srgb, ${color} 28%, transparent)`,
      borderRadius: 4,
      fontSize: 9,
      fontWeight: 500,
      lineHeight: '13.5px',
      color,
      ...style,
    }}
  >
    {children}
  </span>
);

const Chip = ({ tone, children }: { tone: 'new' | 'learn' | 'muted'; children: ReactNode }) => {
  const c = tone === 'new' ? { fg: 'rgb(138, 178, 229)', bg: 'rgba(138, 178, 229, 0.1)' } : tone === 'learn' ? { fg: 'rgb(242, 151, 90)', bg: 'rgba(244, 120, 37, 0.12)' } : { fg: MUTED, bg: 'rgba(36, 36, 36, 0.45)' };
  return (
    <span style={{ height: 22.5, padding: '0 9.6px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, lineHeight: '16.5px', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', color: c.fg, background: c.bg }}>
      {children}
    </span>
  );
};

// ── 主页标签栏（会话页没有标签栏） ─────────────────────
export const FcNav = ({ active, todayBadge }: { active: 'today' | 'library' | 'statistics'; todayBadge?: number }) => {
  const tabs: Array<{ id: 'today' | 'library' | 'statistics'; label: string; icon: ReactNode; x: number; w: number }> = [
    { id: 'today', label: S.fcTabs.today, icon: <Lightning size={14} />, x: 10, w: 95 },
    { id: 'library', label: S.fcTabs.library, icon: <Cards size={14} />, x: 107, w: 59 },
    { id: 'statistics', label: S.fcTabs.statistics, icon: <ChartBar size={14} />, x: 168, w: 72 },
  ];
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, right: 0, height: FC.navH, background: BG, borderBottom: `1px solid ${LINE}`, fontFamily: font.ui }}>
      {tabs.map((tb) => {
        const on = tb.id === active;
        return (
          <span key={tb.id} style={{ ...at(tb.x, 6), width: tb.w, height: 33, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, fontWeight: on ? 500 : 400, color: on ? FG : MUTED, boxShadow: on ? `inset 0 -2px 0 ${FG}` : undefined }}>
            {tb.icon}
            {tb.label}
            {tb.id === 'today' && todayBadge ? (
              <span style={{ width: 17, height: 17, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: 'rgb(81, 160, 246)', background: 'rgba(81, 160, 246, 0.2)' }}>{todayBadge}</span>
            ) : null}
          </span>
        );
      })}
    </div>
  );
};

// ── 复习会话（batch） ─────────────────────────────────
export type ReviewCard = { front: string; back: string };

/** 卡面 = 卡片模板（tpl 正面 15px/600、行高 1.75；背面 = 暗淡正面 13px + 虚线 + 答案），模板沙箱底色铺满舞台。 */
const TemplateFace = ({ card, back }: { card: ReviewCard; back: boolean }) => (
  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 38px 0 40px', background: 'rgb(23, 23, 23)', color: FG, fontFamily: font.ui }}>
    {back ? (
      <>
        <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.75, opacity: 0.6 }}>{card.front}</div>
        <div style={{ height: 0, margin: '10px 0', borderTop: '1px dashed currentColor', opacity: 0.3 }} />
        <div style={{ fontSize: 15, lineHeight: 1.75 }}>{card.back}</div>
      </>
    ) : (
      <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.75 }}>{card.front}</div>
    )}
  </div>
);

export type SessionState = {
  card: ReviewCard;
  /** 已翻到背面（翻面时内容立即切换，动画只播后半程）。 */
  back: boolean;
  /** 翻面动画进度 0→1（wb-fc-flip：rotateY −88° → 0，300ms）。 */
  flipK: number;
  /** 换卡入场 0→1（wb-fc-enter：上移 10px + 0.985 缩放淡入，260ms）。 */
  enter: number;
  /** 0 = 显示答案，1 = 四键评分（wb-fc-fade-up 200ms）。 */
  rateMode: number;
  intervals: [string, string, string, string];
  revealHover: number;
  revealPress: number;
  hoverRating: Rating | null;
  pressRating: Rating | null;
  pressK: number;
  progress: number;
  rated: number;
  newCount: number;
  learnCount: number;
  timer: string;
  nudge: { text: string; k: number } | null;
  cardHover: number;
  exitHover: number;
};

/** 会话页几何（内容区坐标，probe-fca-0 / fca-1 / fca-2）。 */
const SS = { x: 17.5, w: 923, progY: 17.5, bannerY: 36, headY: 88.8, stageY: 125.5, stageH: 437.5, revealY: 584, revealH: 38.5, rateY: 580.5, rateH: 42, nudgeY: 537.5 } as const;
const RATE_W = (SS.w - 8 * 3) / 4;
/** 评分键中心（内容区坐标）。 */
export const rateButtonCenter = (r: Rating) => ({ x: SS.x + (r - 1) * (RATE_W + 8) + RATE_W / 2, y: SS.rateY + SS.rateH / 2 });
export const revealButtonCenter = () => ({ x: SS.x + SS.w / 2, y: SS.revealY + SS.revealH / 2 });
export const exitButtonCenter = () => ({ x: SS.x + 33, y: SS.headY + 13.15 });

export const FcSession = ({ s }: { s: SessionState }) => {
  const flipE = ease.outExpo(s.flipK);
  const rot = s.back ? -88 * (1 - flipE) : 0;
  const faceOpacity = s.back ? 0.2 + 0.8 * Math.min(1, s.flipK / 0.6) : 1;
  const enterE = ease.outExpo(s.enter);
  const chips: ReactNode[] = [];
  if (s.newCount > 0) chips.push(<Chip key="n" tone="new">{S.fc.newCount(s.newCount)}</Chip>);
  if (s.learnCount > 0) chips.push(<Chip key="l" tone="learn">{S.fc.learnCount(s.learnCount)}</Chip>);
  chips.push(<Chip key="r" tone="muted">{S.fc.ratedCount(s.rated)}</Chip>);
  chips.push(
    <Chip key="t" tone="muted">
      <Timer size={11} />
      {s.timer}
    </Chip>,
  );
  return (
    <div style={{ position: 'absolute', inset: 0, background: BG, fontFamily: font.ui }}>
      {/* 顶部进度条（8px） */}
      <div style={{ ...at(SS.x, SS.progY), width: SS.w, height: 8, borderRadius: 999, overflow: 'hidden', background: 'rgba(36, 36, 36, 0.7)' }}>
        <div style={{ width: `${s.progress * 100}%`, height: '100%', borderRadius: 999, background: 'rgb(124, 166, 222)' }} />
      </div>

      {/* 批次集中复习提示 */}
      <div style={{ ...at(SS.x, SS.bannerY), width: SS.w, height: 42.3, boxSizing: 'border-box', borderRadius: 5, background: 'rgba(66, 123, 215, 0.1)', border: '1px solid rgba(66, 123, 215, 0.4)' }}>
        <Info size={14} color="rgb(66, 123, 215)" style={at(11.5, 9.8)} />
        <span style={{ ...at(32, 7), fontSize: 11, lineHeight: '16.5px', color: FG, whiteSpace: 'nowrap' }}>{S.fc.batchNotice}</span>
        <X size={13} color={MUTED} style={at(891.9, 13.6)} />
      </div>

      {/* 工具行：← 退出 … 新 / 复习 / 已评 / 计时 · 撤销 / 编辑 / 跳过 / 暂停 */}
      <span style={{ ...at(SS.x, SS.headY), width: 66, height: 26.3, borderRadius: 9, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 11, fontWeight: 500, color: s.exitHover > 0.5 ? FG : MUTED, background: s.exitHover > 0 ? `rgba(255, 255, 255, ${0.06 * s.exitHover})` : 'transparent' }}>
        <ArrowLeft size={14} />
        {S.fc.exit}
      </span>
      <div style={{ ...at(0, SS.headY + 1.8), width: 817, display: 'flex', justifyContent: 'flex-end', gap: 5.2 }}>{chips}</div>
      {[ArrowCounterClockwise, PencilSimple, SkipForward, Pause].map((I, i) => (
        <span key={i} style={{ ...at(825 + i * 29.75, SS.headY), width: 26.3, height: 26.3, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: MUTED, opacity: i === 0 && s.rated === 0 ? 0.4 : 1 }}>
          <I size={16} />
        </span>
      ))}

      {/* 卡面舞台（圆角 14，模板底铺满） */}
      <div style={{ ...at(SS.x, SS.stageY), width: SS.w, height: SS.stageH, borderRadius: 14, overflow: 'hidden', perspective: 1200, opacity: enterE, transform: `translateY(${(1 - enterE) * 10}px) scale(${0.985 + 0.015 * enterE})` }}>
        <div style={{ position: 'absolute', inset: 0, transform: rot ? `rotateY(${rot}deg)` : undefined, opacity: faceOpacity, backfaceVisibility: 'hidden' }}>
          <TemplateFace card={s.card} back={s.back} />
        </div>
        <span style={{ position: 'absolute', right: 12, bottom: 10, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'rgba(153, 153, 153, 0.55)', opacity: s.cardHover }}>
          <ArrowsClockwise size={13} />
          {S.fc.tapToFlip}
        </span>
      </div>

      {/* 撤销提示：悬浮于底部按钮上方（wb-fc-undo-nudge，fade-up 180ms） */}
      {s.nudge && s.nudge.k > 0 ? (
        <div
          style={{
            position: 'absolute',
            left: SS.x + SS.w / 2,
            top: SS.nudgeY,
            transform: `translateX(-50%) translateY(${(1 - Math.min(1, s.nudge.k)) * 6}px)`,
            opacity: Math.min(1, s.nudge.k),
            height: 26.3,
            padding: '0 4px 0 12px',
            borderRadius: 9,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            whiteSpace: 'nowrap',
            background: 'rgba(36, 36, 36, 0.92)',
            boxShadow: '0 1px 2px rgba(245, 245, 245, 0.06), 0 6px 18px rgba(245, 245, 245, 0.1)',
          }}
        >
          <span style={{ fontSize: 11, color: 'rgba(245, 245, 245, 0.8)' }}>{s.nudge.text}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '0 8px', fontSize: 11, fontWeight: 500, color: MUTED }}>
            <ArrowCounterClockwise size={13} />
            {S.fc.undo}
            <Kbd>Z</Kbd>
          </span>
        </div>
      ) : null}

      {/* 显示答案（整宽 ghost 键） → 四键评分 */}
      {s.rateMode < 1 ? (
        <span
          style={{
            ...at(SS.x, SS.revealY),
            width: SS.w,
            height: SS.revealH,
            borderRadius: 9,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
            fontSize: 13,
            fontWeight: 500,
            color: s.revealHover > 0.5 ? FG : MUTED,
            background: `rgba(255, 255, 255, ${0.05 * s.revealHover + 0.04 * s.revealPress})`,
            opacity: 1 - s.rateMode,
            transform: `scale(${1 - s.revealPress * 0.02})`,
          }}
        >
          <Eye size={16} />
          {S.fc.showAnswer}
          <Kbd color={s.revealHover > 0.5 ? FG : MUTED}>Space</Kbd>
        </span>
      ) : null}
      {s.rateMode > 0 ? (
        <div style={{ ...at(SS.x, SS.rateY), width: SS.w, height: SS.rateH, opacity: s.rateMode, transform: `translateY(${(1 - s.rateMode) * 6}px)` }}>
          {RATING_KEYS.map(({ r, label }, i) => {
            const tone = ratingTone(r);
            const hover = s.hoverRating === r ? 1 : 0;
            const press = s.pressRating === r ? s.pressK : 0;
            // wb-fc-rate-press：240ms 内 1 → 0.94 → 1
            const scale = press > 0 ? (press < 0.35 ? 1 - (0.06 * press) / 0.35 : 0.94 + (0.06 * (press - 0.35)) / 0.65) : 1;
            return (
              <span
                key={r}
                style={{
                  ...at(i * (RATE_W + 8), 0),
                  width: RATE_W,
                  height: SS.rateH,
                  boxSizing: 'border-box',
                  borderRadius: 9,
                  border: `1px solid ${tone.border}`,
                  color: tone.text,
                  background: `color-mix(in srgb, ${tone.fill} ${hover * 10 + (press > 0 ? 12 : 0)}%, transparent)`,
                  transform: `scale(${scale})`,
                }}
              >
                <span style={{ position: 'absolute', left: 0, right: 0, top: 6, textAlign: 'center', fontSize: 13, fontWeight: 500, lineHeight: '13px' }}>{label}</span>
                <span style={{ position: 'absolute', left: 0, right: 0, top: 26, textAlign: 'center', fontSize: 10, lineHeight: '10px', fontVariantNumeric: 'tabular-nums' }}>{s.intervals[i]}</span>
                <Kbd color={tone.text} style={{ position: 'absolute', right: 5.5, top: 5 }}>
                  {r}
                </Kbd>
              </span>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

// ── 今日页（退出会话后） ─────────────────────────────
export const TODAY_UP_NEXT_ROW = 36.5;
export const FcToday = ({ due, newCount, learning, waiting, progress, streak, upNext, dateLabel, k }: { due: number; newCount: number; learning: number; waiting: number; progress: number; streak: number; upNext: string[]; dateLabel: string; k: number }) => {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div style={{ position: 'absolute', left: 0, top: FC.navH, right: 0, bottom: 0, background: BG, fontFamily: font.ui, opacity: k, transform: `translateY(${(1 - k) * 4}px)` }}>
      <span style={{ ...at(18, 16), fontSize: 15, fontWeight: 600, lineHeight: '19.5px', color: FG }}>{S.fcToday.title}</span>
      <span style={{ ...at(18, 37.5), fontSize: 12, lineHeight: '16.2px', color: MUTED, whiteSpace: 'nowrap' }}>
        {dateLabel} · {S.fcToday.dueCount(due)}
      </span>
      <ArrowClockwise size={14} color={MUTED} style={at(919.9, 22.1)} />
      <span style={{ ...at(18, 65.7), width: 922, height: 1, background: LINE }} />
      {/* 今日进度环 */}
      <svg width={84} height={84} viewBox="0 0 84 84" style={at(44, 87)}>
        <circle cx={42} cy={42} r={r} fill="none" stroke="rgba(46, 46, 46, 0.9)" strokeWidth={6} />
        <circle cx={42} cy={42} r={r} fill="none" stroke="rgb(52, 211, 153)" strokeWidth={6} strokeLinecap="round" strokeDasharray={`${c * progress} ${c}`} transform="rotate(-90 42 42)" />
      </svg>
      <span style={{ ...at(44, 115), width: 84, textAlign: 'center', fontSize: 19, fontWeight: 650, lineHeight: '20.9px', color: FG }}>{Math.round(progress * 100)}%</span>
      <span style={{ ...at(44, 137), width: 84, textAlign: 'center', fontSize: 10, lineHeight: '12px', color: MUTED }}>{S.fcToday.progress}</span>
      {(
        [
          [S.fcToday.statDue, due, 171],
          [S.fcToday.statNew, newCount, 429.3],
          [S.fcToday.statLearning, learning, 686.7],
        ] as Array<[string, number, number]>
      ).map(([label, v, x], i) => (
        <span key={label}>
          {i > 0 ? <span style={{ ...at(x - 12, 82.7), width: 1, height: 46.3, background: 'rgb(46, 46, 46)' }} /> : null}
          <span style={{ ...at(x, 86.7), fontSize: 11, lineHeight: '14.3px', color: MUTED }}>{label}</span>
          <span style={{ ...at(x, 103), fontSize: 20, fontWeight: 650, lineHeight: '22px', color: FG, fontVariantNumeric: 'tabular-nums' }}>{v}</span>
        </span>
      ))}
      <span style={{ ...at(160, 139), height: 28, padding: '0 12px', borderRadius: 9, display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 14, fontWeight: 600, color: MUTED }}>
        <Play size={14} weight="fill" />
        {S.fcToday.start}
      </span>
      <span style={{ ...at(287, 140.5), height: 24.9, padding: '0 10px', boxSizing: 'border-box', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: MUTED, background: 'rgba(36, 36, 36, 0.4)', border: `1px solid ${LINE}` }}>
        <Fire size={13} weight="fill" color="hsl(24 90% 58%)" />
        {S.fcToday.streak(streak)}
      </span>
      <span style={{ ...at(160, 177), fontSize: 11, lineHeight: '15.4px', color: MUTED }}>{S.fcToday.learningWaiting(waiting)}</span>
      <span style={{ ...at(18, 220.4), width: 922, height: 1, background: LINE }} />
      <span style={{ ...at(18, 233.4), display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, lineHeight: '16.25px', color: FG }}>
        <Lightning size={14} />
        {S.fcToday.upNext}
      </span>
      <span style={{ position: 'absolute', right: 18, top: 236.5, fontSize: 11, lineHeight: '15.4px', color: MUTED }}>{upNext.length} 张</span>
      {upNext.map((q, i) => (
        <span key={q} style={{ ...at(32, 268.9 + i * TODAY_UP_NEXT_ROW), fontSize: 13, fontWeight: 500, lineHeight: '17.55px', color: FG, whiteSpace: 'nowrap' }}>
          {q}
        </span>
      ))}
    </div>
  );
};

// ── 统计页 ───────────────────────────────────────────
const WEEKS = 53;
/** 一年复习活跃度（确定性）：越近越密，最近 47 天不断档。 */
export const HEAT: number[][] = Array.from({ length: WEEKS }, (_, w) =>
  Array.from({ length: 7 }, (_, d) => {
    const day = w * 7 + d;
    const age = WEEKS * 7 - day;
    if (age < 3) return -1;
    const recent = age < 50;
    const base = 0.12 + 0.6 * (w / WEEKS) ** 1.6 + (recent ? 0.35 : 0);
    const r = rand(day * 3.7 + 11);
    if (!recent && r > base + 0.15) return 0;
    return Math.max(1, Math.min(4, Math.round(1 + r * 2.2 + base * 2)));
  }),
);
const ACTIVE_DAYS = HEAT.flat().filter((v) => v > 0).length;
const MONTHS = ['10月', '11月', '12月', '1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月'];
const HEAT_GREEN = 'rgb(64, 201, 137)';

const Section = ({ icon, title, sub, right, children, style }: { icon: ReactNode; title: string; sub?: string; right?: ReactNode; children: ReactNode; style?: CSSProperties }) => (
  <section style={{ borderTop: `1px solid ${LINE}`, ...style }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '13px 0 0', minHeight: 24 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, lineHeight: '16.25px', color: FG }}>
        {icon}
        {title}
      </span>
      {sub ? <span style={{ fontSize: 11, lineHeight: '15.4px', color: MUTED, whiteSpace: 'nowrap' }}>{sub}</span> : right}
    </div>
    <div style={{ padding: '12px 0 12px' }}>{children}</div>
  </section>
);

export type FcStatsData = { reviewsToday: number; due: number; newCount: number; learning: number; review: number; relearning: number; suspended: number; total: number; streak: number };

/** 统计页（StatisticsScreen）：数据到了直接渲染，只有挂载时 ui-rise-in 150ms。 */
export const FcStats = ({ t, start, d }: { t: number; start: number; d: FcStatsData }) => {
  const k = (dt: number, len = 0.3) => prog(t, start + dt, start + dt + len, ease.outCubic);
  const metrics: Array<[string, number]> = [
    [S.fcStats.reviewsToday, d.reviewsToday],
    [S.fcStats.due, d.due],
    [S.fcStats.newCount, d.newCount],
    [S.fcStats.learning, d.learning],
    [S.fcStats.review, d.review],
    [S.fcStats.relearning, d.relearning],
    [S.fcStats.suspended, d.suspended],
    [S.fcStats.total, d.total],
  ];
  const days = [47, 53, 53, 35, 51, 49, 50, 43, 40, 57, 52, 49, 43, d.reviewsToday];
  const ratings: Array<[Rating, number]> = [
    [1, 8],
    [2, 14],
    [3, 61],
    [4, 17],
  ];
  return (
    <div style={{ position: 'absolute', left: 0, top: FC.navH, right: 0, bottom: 0, overflow: 'hidden', background: BG, padding: '16px 18px', boxSizing: 'border-box', fontFamily: font.ui, opacity: k(0, 0.075), transform: `translateY(${(1 - k(0, 0.075)) * 4}px)` }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, lineHeight: '19.5px', color: FG }}>{S.fcStats.title}</div>
          <div style={{ marginTop: 2, fontSize: 12, lineHeight: '16.2px', color: MUTED }}>{S.fcStats.subtitle}</div>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 26.3, padding: '0 12px', fontSize: 12, fontWeight: 500, color: MUTED }}>
          <ArrowClockwise size={14} />
          {S.fcStats.refresh}
        </span>
      </div>
      <Section
        style={{ marginTop: 12 }}
        icon={<ChartBar size={14} />}
        title={S.fcStats.overview}
        right={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 24.9, padding: '0 10px', boxSizing: 'border-box', borderRadius: 999, border: `1px solid ${LINE}`, background: 'rgba(36, 36, 36, 0.4)', color: MUTED, fontSize: 11.5, fontWeight: 600 }}>
            <Fire size={13} weight="fill" color="hsl(24 90% 58%)" />
            {S.fcStats.streak(d.streak)}
          </span>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 1, background: 'rgba(46, 46, 46, 0.4)', borderTop: '1px solid rgba(46, 46, 46, 0.4)' }}>
          {metrics.map(([label, v]) => (
            <div key={label} style={{ height: 60.4, boxSizing: 'border-box', padding: '10px 12px', background: BG }}>
              <div style={{ fontSize: 11, lineHeight: '16.5px', color: MUTED }}>{label}</div>
              <div style={{ marginTop: 3, fontSize: 19, fontWeight: 650, lineHeight: '20.9px', color: FG, fontVariantNumeric: 'tabular-nums' }}>{v}</div>
            </div>
          ))}
        </div>
      </Section>
      <Section icon={<CalendarBlank size={14} />} title={S.fc.heatmap} sub={`${S.fcStats.heatSub} · ${S.fcStats.activeDays(ACTIVE_DAYS)} · ${S.fcStats.realNote}`}>
        <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ position: 'relative', height: 14 }}>
            {MONTHS.map((m, i) => (
              <span key={m} style={{ position: 'absolute', left: 13 + Math.round(i * 4.35) * 13, top: 0, fontSize: 10, lineHeight: '14px', color: MUTED, whiteSpace: 'nowrap' }}>
                {m}
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 3 }}>
            {HEAT.map((week, wi) => (
              <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {week.map((lv, di) => {
                  const level = Math.max(0, lv);
                  const alpha = [0, 0.3, 0.52, 0.74, 0.96][level];
                  return <span key={di} style={{ width: 10, height: 10, borderRadius: 2.5, background: lv < 0 ? 'transparent' : level === 0 ? 'rgba(36, 36, 36, 0.58)' : `color-mix(in srgb, ${HEAT_GREEN} ${alpha * 100}%, transparent)` }} />;
                })}
              </div>
            ))}
          </div>
        </div>
      </Section>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
        <Section icon={<ChartBar size={14} />} title={S.fcStats.daily} sub={S.fcStats.dailySub}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 70 }}>
            {days.map((v, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 3, height: '100%' }}>
                <span style={{ fontSize: 9.5, color: MUTED, fontVariantNumeric: 'tabular-nums' }}>{v}</span>
                <div style={{ width: '100%', maxWidth: 22, height: `${Math.max(2, (v / 57) * 72)}%`, borderRadius: '3px 3px 1px 1px', background: 'rgb(71, 128, 206)' }} />
              </div>
            ))}
          </div>
        </Section>
        <Section icon={<ChartPieSlice size={14} />} title={S.fcStats.ratings} sub={S.fcStats.ratingsSub}>
          <div style={{ display: 'flex', height: 8, borderRadius: 999, overflow: 'hidden', gap: 2, marginTop: 2 }}>
            {ratings.map(([r, p]) => (
              <span key={r} style={{ flexGrow: p, background: ratingTone(r).fill }} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 10, fontSize: 11, color: MUTED }}>
            {ratings.map(([r, p]) => (
              <span key={r} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 7, height: 7, borderRadius: 4, background: ratingTone(r).fill }} />
                {RATING_KEYS[r - 1].label}
                <span style={{ color: FG, fontWeight: 600 }}>{p}%</span>
              </span>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
};

/** 统计页「统计」标签中心（内容区坐标）。 */
export const statsTabCenter = () => ({ x: 168 + 36, y: 6 + 16.5 });
