import {
  ArrowClockwise,
  ArrowCounterClockwise,
  CalendarBlank,
  CaretLeft,
  ChartBar,
  ChartPieSlice,
  Eye,
  Fire,
  Lightning,
  Pause,
  PencilSimple,
  SkipForward,
  Timer,
} from '@phosphor-icons/react';
import type { CSSProperties, ReactNode } from 'react';
import { clamp, ease, prog, rand } from '../lib/time';
import { S } from '../strings';
import { font, type Tokens } from '../theme';

/**
 * 工作台闪卡应用（wb-fc-* / wb-fcx-*）的转写，来源：
 * src/features/flashcards/review/{RatingBar,ReviewCardSurface,SessionSummary}.tsx、
 * screens/{ReviewSessionScreen,StatisticsScreen}.tsx、components/ReviewHeatmap.tsx、
 * flashcards.css、flashcards-dashboard.css。
 */
export const FC = { navH: 38, pad: 20, rateH: 48, revealH: 44 } as const;

export type Rating = 1 | 2 | 3 | 4;
const RATING_KEYS: Array<{ r: Rating; label: string }> = [
  { r: 1, label: S.fc.again },
  { r: 2, label: S.fc.hard },
  { r: 3, label: S.fc.good },
  { r: 4, label: S.fc.easy },
];

/** 评分四色（RatingBar tone：destructive / amber / emerald / sky，暗色取 400 档文字）。 */
export const ratingTone = (tk: Tokens, r: Rating) => {
  const d = tk.dark;
  switch (r) {
    case 1:
      return { text: tk.destructive, border: `color-mix(in hsl, ${tk.destructive} 40%, transparent)`, fill: tk.destructive };
    case 2:
      return { text: d ? '#fbbf24' : '#b45309', border: 'rgba(245, 158, 11, 0.4)', fill: '#f59e0b' };
    case 3:
      return { text: d ? '#34d399' : '#047857', border: 'rgba(16, 185, 129, 0.4)', fill: '#10b981' };
    default:
      return { text: d ? '#38bdf8' : '#0369a1', border: 'rgba(14, 165, 233, 0.4)', fill: '#0ea5e9' };
  }
};

const Keycap = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '0 4px',
      border: '1px solid color-mix(in srgb, currentColor 28%, transparent)',
      borderRadius: 4,
      fontSize: 9,
      fontWeight: 500,
      lineHeight: 1.5,
      ...style,
    }}
  >
    {children}
  </span>
);

const Chip = ({ tk, tone = 'muted', children, pop = 0 }: { tk: Tokens; tone?: 'muted' | 'new' | 'learn' | 'streak'; children: ReactNode; pop?: number }) => {
  const c =
    tone === 'new'
      ? { fg: tk.primary, bg: `color-mix(in hsl, ${tk.primary} 10%, transparent)` }
      : tone === 'learn'
        ? { fg: tk.dark ? 'hsl(24 85% 65%)' : 'hsl(24 70% 42%)', bg: 'hsl(24 90% 55% / 0.12)' }
        : tone === 'streak'
          ? { fg: tk.dark ? 'hsl(45 90% 62%)' : 'hsl(41 85% 36%)', bg: 'hsl(45 95% 55% / 0.16)' }
          : { fg: tk.mutedFg, bg: `color-mix(in hsl, ${tk.muted} 45%, transparent)` };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: 11,
        lineHeight: 1.5,
        whiteSpace: 'nowrap',
        fontVariantNumeric: 'tabular-nums',
        color: c.fg,
        background: c.bg,
        transform: `scale(${1 + Math.sin(pop * Math.PI) * 0.14})`,
      }}
    >
      {children}
    </span>
  );
};

export const FcNav = ({ tk, active }: { tk: Tokens; active: 'today' | 'library' | 'statistics' | 'settings' }) => (
  <div
    style={{
      height: FC.navH,
      boxSizing: 'border-box',
      display: 'flex',
      alignItems: 'flex-end',
      gap: 2,
      padding: '6px 10px 0',
      borderBottom: `1px solid ${tk.dark ? 'hsl(0 0% 18% / 0.7)' : 'hsl(0 0% 88% / 0.5)'}`,
      background: `color-mix(in hsl, ${tk.card} 92%, ${tk.muted} 8%)`,
      fontFamily: font.ui,
    }}
  >
    {(
      [
        ['today', S.fcTabs.today],
        ['library', S.fcTabs.library],
        ['statistics', S.fcTabs.statistics],
        ['settings', S.fcTabs.settings],
      ] as const
    ).map(([id, label]) => (
      <span
        key={id}
        style={{
          padding: '7px 12px',
          borderBottom: `2px solid ${id === active ? tk.foreground : 'transparent'}`,
          borderRadius: '6px 6px 0 0',
          fontSize: 13,
          lineHeight: 1.25,
          fontWeight: id === active ? 500 : 400,
          color: id === active ? tk.foreground : tk.mutedFg,
        }}
      >
        {label}
      </span>
    ))}
  </div>
);

export type ReviewCard = { front: string; back: string };

/** 卡面：Anki Basic 模板（背面 = 正面 + 分隔线 + 答案）。 */
const CardFace = ({ tk, card, back }: { tk: Tokens; card: ReviewCard; back: boolean }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '0 56px', textAlign: 'center', fontFamily: font.ui }}>
    <div style={{ fontSize: back ? 21 : 30, lineHeight: 1.45, fontWeight: 500, color: back ? tk.mutedFg : tk.foreground }}>{card.front}</div>
    {back ? (
      <>
        <div style={{ width: '62%', height: 1, margin: '28px 0', background: `color-mix(in hsl, ${tk.foreground} 16%, transparent)` }} />
        <div style={{ fontSize: 30, lineHeight: 1.45, fontWeight: 500, color: tk.foreground }}>{card.back}</div>
      </>
    ) : null}
  </div>
);

export type FlyDir = 'left' | 'right' | 'up' | 'down';
const flyTransform = (dir: FlyDir, k: number) => {
  const e = ease.inCubic(k);
  switch (dir) {
    case 'left':
      return `translate(${-130 * e}%, ${6 * e}%) rotate(${-12 * e}deg)`;
    case 'right':
      return `translate(${130 * e}%, ${6 * e}%) rotate(${12 * e}deg)`;
    case 'up':
      return `translate(0, ${-130 * e}%)`;
    default:
      return `translate(0, ${130 * e}%)`;
  }
};

export type SessionState = {
  card: ReviewCard;
  /** 0 = 正面，1 = 背面；中途 0.5 处换面（两段式翻转）。 */
  flip: number;
  enter: number;
  /** 上一张卡飞出（评分后）。 */
  leaving?: { card: ReviewCard; k: number; dir: FlyDir; rating: Rating };
  /** 0 = 显示答案按钮，1 = 四键评分栏。 */
  rateMode: number;
  intervals: [string, string, string, string];
  revealHover: number;
  revealPress: number;
  hoverRating: Rating | null;
  pressRating: Rating | null;
  pressK: number;
  progress: number;
  rated: number;
  remaining: number;
  streak: number;
  streakPop: number;
  newCount: number;
  learnCount: number;
  timer: string;
  /** 「稍后重现」学习步提示（0..1）。 */
  learnChip: number;
  nudge: { text: string; k: number } | null;
  cardHover: number;
};

export const FcSession = ({ tk, s, w, h }: { tk: Tokens; s: SessionState; w: number; h: number }) => {
  const innerW = w - FC.pad * 2;
  const rateTop = h - FC.pad - FC.rateH;
  const stageTop = FC.pad + 3 + 12 + 30 + 12;
  const stageH = rateTop - 12 - stageTop;
  const flipA = s.flip < 0.5 ? ease.inCubic(s.flip / 0.5) : 0;
  const flipB = s.flip >= 0.5 ? 1 - ease.outCubic((s.flip - 0.5) / 0.5) : 0;
  const rot = s.flip < 0.5 ? flipA * 88 : -88 * flipB;
  const showBack = s.flip >= 0.5;
  const enterE = ease.wbOut(s.enter);
  const cardBg = tk.dark ? 'hsl(0 0% 15%)' : '#fff';
  const stageStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    borderRadius: 14,
    overflow: 'hidden',
    background: showBack ? `color-mix(in hsl, ${cardBg} 96%, ${tk.primary} 4%)` : cardBg,
    border: `1px solid ${tk.dark ? 'hsl(0 0% 100% / 0.06)' : tk.border}`,
    boxShadow: tk.dark ? '0 18px 40px -22px rgba(0,0,0,0.7)' : '0 18px 40px -26px hsl(220 25% 12% / 0.35)',
  };
  return (
    <div style={{ position: 'absolute', inset: 0, fontFamily: font.ui }}>
      {/* 顶部细进度条 */}
      <div style={{ position: 'absolute', left: FC.pad, top: FC.pad, width: innerW, height: 3, borderRadius: 999, overflow: 'hidden', background: `color-mix(in hsl, ${tk.muted} 70%, transparent)` }}>
        <div style={{ width: `${s.progress * 100}%`, height: '100%', borderRadius: 999, background: tk.primary }} />
      </div>

      {/* 顶栏：退出 + 计数 · 卡片操作 */}
      <div style={{ position: 'absolute', left: FC.pad, top: FC.pad + 15, width: innerW, height: 30, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 30, padding: '0 10px 0 6px', borderRadius: 9, fontSize: 12, fontWeight: 500, color: tk.mutedFg }}>
          <CaretLeft size={14} />
          {S.fc.exit}
        </span>
        {s.streak > 1 ? (
          <Chip tk={tk} tone="streak" pop={s.streakPop}>
            <Lightning size={11} weight="fill" />
            {S.fc.streak(s.streak)}
          </Chip>
        ) : null}
        {s.learnChip > 0.01 ? (
          <span style={{ opacity: s.learnChip, transform: `translateX(${(1 - s.learnChip) * -6}px)`, display: 'inline-flex' }}>
            <Chip tk={tk} tone="learn">
              <ArrowClockwise size={11} weight="bold" />
              {S.fc.learningStep} · {s.intervals[0]}
            </Chip>
          </span>
        ) : null}
        <Chip tk={tk} tone="new">{S.fc.newCount(s.newCount)}</Chip>
        <Chip tk={tk} tone="learn">{S.fc.learnCount(s.learnCount)}</Chip>
        <Chip tk={tk}>{S.fc.ratedRemaining(s.rated, s.remaining)}</Chip>
        <Chip tk={tk}>
          <Timer size={11} />
          {s.timer}
        </Chip>
        <span style={{ flex: 1 }} />
        {[ArrowCounterClockwise, PencilSimple, SkipForward, Pause].map((I, i) => (
          <span key={i} style={{ width: 30, height: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: tk.mutedFg, opacity: i === 0 && s.rated === 0 ? 0.4 : 1 }}>
            <I size={15} />
          </span>
        ))}
      </div>

      {/* 卡面舞台 */}
      <div style={{ position: 'absolute', left: FC.pad, top: stageTop, width: innerW, height: stageH, perspective: 1200 }}>
        {s.leaving && s.leaving.k < 1 ? (
          <div style={{ ...stageStyle, transform: flyTransform(s.leaving.dir, s.leaving.k), opacity: 1 - ease.inCubic(s.leaving.k) * 0.6 }}>
            <CardFace tk={tk} card={s.leaving.card} back />
            <div style={{ position: 'absolute', inset: 0, borderRadius: 14, boxShadow: `inset 0 0 0 2px ${ratingTone(tk, s.leaving.rating).border}` }} />
          </div>
        ) : null}
        <div
          style={{
            ...stageStyle,
            opacity: enterE,
            transform: `translateY(${(1 - enterE) * 10}px) scale(${0.985 + 0.015 * enterE}) rotateY(${rot}deg)`,
          }}
        >
          <CardFace tk={tk} card={s.card} back={showBack} />
          <span
            style={{
              position: 'absolute',
              right: 12,
              bottom: 10,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 10,
              color: `color-mix(in hsl, ${tk.mutedFg} 55%, transparent)`,
              opacity: s.cardHover,
            }}
          >
            <ArrowClockwise size={13} />
            {S.fc.tapToFlip}
          </span>
        </div>
      </div>

      {/* 撤销提示（悬浮于评分栏上方） */}
      {s.nudge && s.nudge.k > 0 ? (
        <div
          style={{
            position: 'absolute',
            left: w / 2,
            top: rateTop - 8,
            transform: `translate(-50%, -100%) translateY(${(1 - ease.wbOut(clamp(s.nudge.k * 3))) * 6}px)`,
            opacity: Math.min(1, s.nudge.k * 4, (1 - s.nudge.k) * 5),
            padding: '5px 12px',
            borderRadius: 8,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            whiteSpace: 'nowrap',
            color: `color-mix(in hsl, ${tk.foreground} 80%, transparent)`,
            background: tk.dark ? 'hsl(0 0% 14%)' : 'hsl(0 0% 100%)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.12), 0 6px 18px rgba(0,0,0,0.24)',
          }}
        >
          {s.nudge.text}
          <span style={{ color: tk.mutedFg, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {S.fc.undo}
            <Keycap>Z</Keycap>
          </span>
        </div>
      ) : null}

      {/* 评分栏：显示答案 → 四键 */}
      <div style={{ position: 'absolute', left: FC.pad, top: rateTop, width: innerW, height: FC.rateH }}>
        {s.rateMode < 1 ? (
          <span
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 9,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              fontSize: 13,
              fontWeight: 500,
              color: s.revealHover > 0.5 ? tk.foreground : tk.mutedFg,
              background: `color-mix(in hsl, ${tk.foreground} ${s.revealHover * 7 + s.revealPress * 6}%, transparent)`,
              opacity: 1 - s.rateMode,
              transform: `scale(${1 - s.revealPress * 0.02})`,
            }}
          >
            <Eye size={16} />
            {S.fc.showAnswer}
            <Keycap style={{ opacity: 0.75 }}>Space</Keycap>
          </span>
        ) : null}
        {s.rateMode > 0 ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: 8,
              opacity: s.rateMode,
              transform: `translateY(${(1 - s.rateMode) * 6}px)`,
            }}
          >
            {RATING_KEYS.map(({ r, label }, i) => {
              const tone = ratingTone(tk, r);
              const hover = s.hoverRating === r ? 1 : 0;
              const press = s.pressRating === r ? s.pressK : 0;
              const pressScale = press > 0 ? 1 - 0.06 * Math.sin(Math.min(1, press) * Math.PI) : 1;
              return (
                <span
                  key={r}
                  style={{
                    position: 'relative',
                    height: FC.rateH,
                    borderRadius: 9,
                    border: `1px solid ${tone.border}`,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 2,
                    fontSize: 12,
                    color: tone.text,
                    background: `color-mix(in srgb, ${tone.fill} ${hover * 10 + (press > 0 ? 14 : 0)}%, transparent)`,
                    transform: `scale(${pressScale})`,
                  }}
                >
                  <Keycap style={{ position: 'absolute', top: 4, right: 5, opacity: 0.45 }}>{r}</Keycap>
                  <span style={{ fontWeight: 500 }}>{label}</span>
                  <span style={{ fontSize: 10, opacity: 0.72, fontVariantNumeric: 'tabular-nums' }}>{s.intervals[i]}</span>
                </span>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
};

/** 评分栏按钮中心（相对闪卡窗口内容区左上角）。 */
export const rateButtonCenter = (w: number, h: number, r: Rating) => {
  const innerW = w - FC.pad * 2;
  const bw = (innerW - 24) / 4;
  return { x: FC.pad + (r - 1) * (bw + 8) + bw / 2, y: h - FC.pad - FC.rateH / 2 };
};
export const revealButtonCenter = (w: number, h: number) => ({ x: w / 2, y: h - FC.pad - FC.rateH / 2 });

// ── 统计页 ───────────────────────────────────────────
const WEEKS = 53;
/** 一年复习活跃度（确定性）：越近越密，最近 46 天不断档。 */
export const HEAT: number[][] = Array.from({ length: WEEKS }, (_, w) =>
  Array.from({ length: 7 }, (_, d) => {
    const day = w * 7 + d;
    const age = WEEKS * 7 - day;
    if (age < 3) return -1;
    const recent = age < 49;
    const base = 0.12 + 0.6 * (w / WEEKS) ** 1.6 + (recent ? 0.35 : 0);
    const r = rand(day * 3.7 + 11);
    if (!recent && r > base + 0.15) return 0;
    return Math.max(1, Math.min(4, Math.round(1 + r * 2.2 + base * 2)));
  }),
);
const MONTHS = ['11月', '12月', '1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月'];

const Panel = ({ tk, icon, title, sub, right, children, style }: { tk: Tokens; icon: ReactNode; title: string; sub?: string; right?: ReactNode; children: ReactNode; style?: CSSProperties }) => (
  <section style={{ borderTop: `1px solid ${tk.dark ? 'hsl(0 0% 18% / 0.7)' : 'hsl(0 0% 88% / 0.5)'}`, ...style }}>
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, padding: '12px 0 0' }}>
      <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: tk.foreground }}>
          {icon}
          {title}
        </span>
        {sub ? <span style={{ fontSize: 11, color: tk.mutedFg }}>{sub}</span> : null}
      </span>
      {right}
    </div>
    <div style={{ padding: '12px 0 14px' }}>{children}</div>
  </section>
);

export const FcStats = ({ tk, t, start, w }: { tk: Tokens; t: number; start: number; w: number }) => {
  const k = (d: number, len = 0.3) => prog(t, start + d, start + d + len, ease.outCubic);
  const green = tk.dark ? '152 56% 52%' : '152 62% 36%';
  const blue = tk.dark ? '211 90% 64%' : '211 88% 48%';
  const metrics: Array<[string, number]> = [
    [S.fcStats.reviewsToday, 12],
    [S.fcStats.due, 9],
    [S.fcStats.learning, 1],
    [S.fcStats.total, 386],
  ];
  const sweep = prog(t, start + 0.12, start + 0.62, ease.inOutCubic);
  const days = [18, 24, 9, 31, 27, 35, 22, 40, 33, 28, 45, 38, 41, 52];
  return (
    <div style={{ position: 'absolute', inset: 0, padding: '14px 18px', fontFamily: font.ui, opacity: k(0, 0.16), transform: `translateY(${(1 - k(0, 0.16)) * 6}px)` }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: tk.foreground }}>{S.fcStats.title}</div>
          <div style={{ marginTop: 2, fontSize: 12, color: tk.mutedFg }}>{S.fcStats.subtitle}</div>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 12px', fontSize: 12, fontWeight: 500, color: tk.mutedFg }}>
          <ArrowClockwise size={15} />
          {S.fcStats.refresh}
        </span>
      </div>
      <Panel
        tk={tk}
        style={{ marginTop: 12 }}
        icon={<ChartBar size={14} weight="duotone" />}
        title={S.fcStats.overview}
        right={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999, border: `1px solid ${tk.dark ? 'hsl(0 0% 18% / 0.7)' : 'hsl(0 0% 88% / 0.5)'}`, background: `color-mix(in hsl, ${tk.muted} 40%, transparent)`, color: tk.mutedFg, fontSize: 11.5, fontWeight: 600 }}>
            <Fire size={13} weight="fill" color="hsl(24 90% 58%)" />
            {S.fcStats.streak(46)}
          </span>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 1, background: tk.dark ? 'hsl(0 0% 18% / 0.4)' : 'hsl(0 0% 88% / 0.4)', borderTop: `1px solid ${tk.dark ? 'hsl(0 0% 18% / 0.4)' : 'hsl(0 0% 88% / 0.4)'}` }}>
          {metrics.map(([label, v], i) => (
            <div key={label} style={{ padding: '10px 12px', background: tk.card }}>
              <div style={{ fontSize: 11, color: tk.mutedFg }}>{label}</div>
              <div style={{ marginTop: 3, fontSize: 19, fontWeight: 650, lineHeight: 1.1, color: tk.foreground, fontVariantNumeric: 'tabular-nums' }}>{Math.round(v * k(0.05 + i * 0.03, 0.5))}</div>
            </div>
          ))}
        </div>
      </Panel>
      <Panel tk={tk} icon={<CalendarBlank size={14} weight="duotone" />} title={S.fc.heatmap} sub={`${S.fcStats.heatSub} · ${S.fcStats.activeDays(213)}`}>
        <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${WEEKS}, 13px)`, height: 14 }}>
            {MONTHS.map((m, i) => (
              <span key={m} style={{ gridColumnStart: 2 + Math.round(i * 4.35), gridRow: 1, fontSize: 10, lineHeight: '14px', color: tk.mutedFg, whiteSpace: 'nowrap' }}>
                {m}
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 3 }}>
            {HEAT.map((week, wi) => (
              <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {week.map((lv, di) => {
                  const on = prog(sweep * (WEEKS + 6), wi, wi + 6);
                  const level = lv < 0 ? 0 : Math.round(lv * on);
                  const alpha = [0, 0.3, 0.52, 0.74, 0.96][level];
                  return (
                    <span
                      key={di}
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 2.5,
                        background: lv < 0 ? 'transparent' : level === 0 ? `color-mix(in hsl, ${tk.muted} 58%, transparent)` : `hsl(${green} / ${alpha})`,
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3, fontSize: 10, color: tk.mutedFg }}>
            <span style={{ marginRight: 2 }}>{S.fc.less}</span>
            {[0, 0.3, 0.52, 0.74, 0.96].map((a) => (
              <span key={a} style={{ width: 10, height: 10, borderRadius: 2.5, background: a === 0 ? `color-mix(in hsl, ${tk.muted} 58%, transparent)` : `hsl(${green} / ${a})` }} />
            ))}
            <span style={{ marginLeft: 2 }}>{S.fc.more}</span>
          </div>
        </div>
      </Panel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
        <Panel tk={tk} icon={<ChartBar size={14} weight="duotone" />} title={S.fcStats.daily} sub={S.fcStats.dailySub}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 96 }}>
            {days.map((d, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 3, height: '100%' }}>
                <span style={{ fontSize: 9.5, color: tk.mutedFg, fontVariantNumeric: 'tabular-nums' }}>{d}</span>
                <div style={{ width: '100%', maxWidth: 22, height: `${(d / 52) * 70}%`, borderRadius: '3px 3px 1px 1px', transformOrigin: 'bottom', transform: `scaleY(${k(0.2 + i * 0.02, 0.3)})`, background: `hsl(${blue} / ${i === days.length - 1 ? 1 : 0.75})` }} />
              </div>
            ))}
          </div>
        </Panel>
        <Panel tk={tk} icon={<ChartPieSlice size={14} weight="duotone" />} title={S.fcStats.ratings}>
          <div style={{ display: 'flex', height: 10, borderRadius: 999, overflow: 'hidden', gap: 2, marginTop: 6 }}>
            {(
              [
                [1, 8],
                [2, 14],
                [3, 61],
                [4, 17],
              ] as Array<[Rating, number]>
            ).map(([r, p]) => (
              <span key={r} style={{ flexGrow: p * k(0.25, 0.4) + 0.001, background: ratingTone(tk, r).fill, opacity: 0.85 }} />
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 14px', marginTop: 12, fontSize: 11, color: tk.mutedFg }}>
            {(
              [
                [1, 8],
                [2, 14],
                [3, 61],
                [4, 17],
              ] as Array<[Rating, number]>
            ).map(([r, p]) => (
              <span key={r} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 7, height: 7, borderRadius: 4, background: ratingTone(tk, r).fill }} />
                {RATING_KEYS[r - 1].label}
                <span style={{ color: tk.foreground, fontWeight: 600 }}>{p}%</span>
              </span>
            ))}
          </div>
        </Panel>
      </div>
      <div style={{ width: w }} />
    </div>
  );
};
