import { ArrowRight, Cards, CheckSquare, CircleNotch, Notebook, Target, WarningDiamond } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { clamp, ease, prog } from '../lib/time';
import { font, type Tokens } from '../theme';

/**
 * 「今日」窗口：上半是 TodayCommandCenter 的行动卡 + WeakConceptsStrip 的薄弱知识点
 * （src/components/dashboard/），下半左边是待办「今日」视图，右边是番茄钟面板。
 * 文案来自 data.json today_center、todo.json views、workbench.json pomodoro。
 */
export const TODAY_W = 1040;
export const TODAY_H = 700;
const PAD = 28;

const ActionCard = ({ tk, icon, label, count, highlight = false, spin = 0, hover = 0 }: { tk: Tokens; icon: ReactNode; label: string; count: number; highlight?: boolean; spin?: number; hover?: number }) => (
  <div
    style={{
      flex: 1,
      minWidth: 0,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      boxSizing: 'border-box',
      padding: '12px 14px',
      borderRadius: 8,
      border: `1px solid ${highlight ? `color-mix(in hsl, ${tk.primary} 35%, transparent)` : tk.border}`,
      background: highlight ? `color-mix(in hsl, ${tk.primary} ${6 + hover * 4}%, ${tk.card})` : hover > 0 ? `color-mix(in hsl, ${tk.muted} ${hover * 50}%, ${tk.card})` : tk.card,
    }}
  >
    <span
      style={{
        width: 36,
        height: 36,
        flexShrink: 0,
        borderRadius: 6,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: highlight ? `color-mix(in hsl, ${tk.primary} 12%, transparent)` : tk.muted,
        color: highlight ? tk.primary : tk.mutedFg,
      }}
    >
      <span style={{ display: 'inline-flex', transform: `rotate(${spin * 360}deg)` }}>{icon}</span>
    </span>
    <span style={{ flex: 1, minWidth: 0 }}>
      <span style={{ display: 'block', fontSize: 13, color: tk.mutedFg, whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ display: 'block', fontSize: 20, fontWeight: 600, lineHeight: 1.2, color: tk.foreground, fontVariantNumeric: 'tabular-nums' }}>{count}</span>
    </span>
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 12, color: tk.mutedFg, opacity: hover }}>
      前往
      <ArrowRight size={12} />
    </span>
  </div>
);

export type TodayTodo = { title: string; time: string; tag: string; done: number };

const TodoRow = ({ tk, item, enter }: { tk: Tokens; item: TodayTodo; enter: number }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      height: 48,
      padding: '0 12px',
      borderRadius: 8,
      opacity: enter,
      transform: `translateY(${(1 - enter) * 8}px)`,
    }}
  >
    <span
      style={{
        width: 18,
        height: 18,
        flexShrink: 0,
        boxSizing: 'border-box',
        borderRadius: '50%',
        border: `1.5px solid ${item.done > 0 ? tk.primary : `color-mix(in hsl, ${tk.mutedFg} 60%, transparent)`}`,
        background: `color-mix(in hsl, ${tk.primary} ${item.done * 100}%, transparent)`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        transform: `scale(${1 + Math.sin(item.done * Math.PI) * 0.18})`,
      }}
    >
      {item.done > 0.3 ? (
        <svg width={10} height={10} viewBox="0 0 10 10">
          <path d="M2 5.2 L4.2 7.3 L8 3" fill="none" stroke="#fff" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={10} strokeDashoffset={10 * (1 - clamp((item.done - 0.3) / 0.7))} />
        </svg>
      ) : null}
    </span>
    <span style={{ flex: 1, minWidth: 0, position: 'relative', fontSize: 15, color: item.done > 0.6 ? tk.mutedFg : tk.foreground, whiteSpace: 'nowrap' }}>
      {item.title}
      <span style={{ position: 'absolute', left: 0, top: '52%', height: 1.2, width: `${clamp((item.done - 0.4) / 0.6) * 100}%`, background: tk.mutedFg }} />
    </span>
    <span style={{ fontSize: 12, color: tk.mutedFg, padding: '2px 8px', borderRadius: 999, background: tk.muted, whiteSpace: 'nowrap' }}>{item.tag}</span>
    <span style={{ width: 44, textAlign: 'right', fontSize: 13, color: tk.mutedFg, fontVariantNumeric: 'tabular-nums' }}>{item.time}</span>
  </div>
);

/** 番茄钟面板：圆环 + 剩余时间 + 「开始专注」。 */
const Pomodoro = ({ tk, t, start, press, hover }: { tk: Tokens; t: number; start: number; press: number; hover: number }) => {
  const running = t >= start;
  const elapsed = running ? (t - start) * 2 : 0;
  const total = 25 * 60;
  const left = Math.max(0, total - elapsed);
  const mm = Math.floor(left / 60);
  const ss = Math.floor(left % 60);
  const R = 84;
  const C = 2 * Math.PI * R;
  const kick = prog(t, start, start + 0.35, ease.outExpo);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ position: 'relative', width: 200, height: 200 }}>
        <svg width={200} height={200} viewBox="0 0 200 200" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
          <circle cx={100} cy={100} r={R} fill="none" stroke={tk.muted} strokeWidth={6} />
          <circle cx={100} cy={100} r={R} fill="none" stroke={tk.primary} strokeWidth={6} strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - (running ? Math.max(0.004, kick * 0.012 + elapsed / total) : 0))} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 13, color: running ? tk.primary : tk.mutedFg, fontWeight: 500 }}>{running ? '专注中' : '番茄钟'}</span>
          <span style={{ marginTop: 2, fontSize: 44, fontWeight: 600, letterSpacing: '0.01em', color: tk.foreground, fontVariantNumeric: 'tabular-nums' }}>
            {String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}
          </span>
        </div>
      </div>
      <span
        style={{
          marginTop: 18,
          height: 38,
          padding: '0 20px',
          borderRadius: 9,
          display: 'inline-flex',
          alignItems: 'center',
          fontSize: 14,
          fontWeight: 500,
          color: running ? tk.mutedFg : tk.foreground,
          background: running ? 'transparent' : `color-mix(in hsl, ${tk.foreground} ${4 + hover * 4 + press * 8}%, transparent)`,
          border: `1px solid ${running ? tk.border : 'transparent'}`,
          transform: `scale(${1 - press * 0.04})`,
        }}
      >
        {running ? '暂停' : '开始专注'}
      </span>
      <span style={{ marginTop: 14, fontSize: 12, color: tk.mutedFg }}>今日 0 个番茄 · 专注 0 分钟</span>
    </div>
  );
};

export const TODOS: Array<Omit<TodayTodo, 'done'>> = [
  { title: '复习到期卡片', time: '07:30', tag: '闪卡' },
  { title: '完成高数期中模拟卷', time: '09:00', tag: '高等数学' },
  { title: '雅思大作文二稿', time: '14:00', tag: '英语' },
  { title: '调研：大模型怎样辅助数学证明', time: '20:00', tag: '调研' },
];

const DONE: Array<Omit<TodayTodo, 'done'>> = [
  { title: '复习这批新卡 12 张', time: '昨天', tag: '闪卡' },
  { title: '读懂拉格朗日中值定理', time: '昨天', tag: '高等数学' },
];

export const TodayView = ({
  tk,
  t,
  open,
  focusAt,
  focusHover,
  focusPress,
  todoDone,
}: {
  tk: Tokens;
  t: number;
  open: number;
  focusAt: number;
  focusHover: number;
  focusPress: number;
  todoDone: number[];
}) => {
  const step = (i: number) => clamp((open - 0.25 - i * 0.06) / 0.35);
  const weak: Array<[string, number]> = [
    ['ξ 的取值范围', 34],
    ['泰勒余项', 58],
    ['洛必达的使用条件', 61],
  ];
  return (
    <div style={{ position: 'absolute', inset: 0, padding: PAD, boxSizing: 'border-box', fontFamily: font.ui, background: tk.background }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: tk.foreground }}>今日</span>
        <span style={{ fontSize: 12, color: tk.mutedFg }}>10 月 3 日 周六</span>
      </div>
      <div style={{ display: 'flex', gap: 12, opacity: step(0), transform: `translateY(${(1 - step(0)) * 10}px)` }}>
        <ActionCard tk={tk} icon={<Cards size={18} />} label="到期卡片" count={12} highlight />
        <ActionCard tk={tk} icon={<WarningDiamond size={18} />} label="错题复习" count={3} highlight />
        <ActionCard tk={tk} icon={<Notebook size={18} />} label="待复习笔记" count={2} />
        <ActionCard tk={tk} icon={<CheckSquare size={18} />} label="今日待办" count={4 - todoDone.filter((d) => d > 0.6).length} />
        <ActionCard tk={tk} icon={<CircleNotch size={18} />} label="运行中任务" count={1} spin={t * 0.9} />
      </div>
      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6, opacity: step(1) }}>
        <span style={{ marginRight: 4, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: tk.mutedFg }}>
          <Target size={13} />
          薄弱知识点
        </span>
        {weak.map(([c, s]) => (
          <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, border: `1px solid ${tk.border}`, background: tk.card, fontSize: 12, color: tk.foreground }}>
            {c}
            <span style={{ color: s < 40 ? tk.destructive : tk.warning, fontVariantNumeric: 'tabular-nums' }}>{s}%</span>
          </span>
        ))}
      </div>
      <div style={{ position: 'absolute', left: PAD, right: PAD, top: 196, bottom: PAD, display: 'flex', gap: 20 }}>
        <div style={{ flex: 1.55, borderRadius: 12, border: `1px solid ${tk.border}`, background: tk.card, padding: '14px 8px', boxSizing: 'border-box', opacity: step(2) }}>
          <div style={{ padding: '0 12px 8px', display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: tk.foreground }}>今日</span>
            <span style={{ fontSize: 12, color: tk.mutedFg }}>待办 · {TODOS.length} 项</span>
          </div>
          {TODOS.map((td, i) => (
            <TodoRow key={td.title} tk={tk} item={{ ...td, done: todoDone[i] ?? 0 }} enter={step(2 + i * 0.5)} />
          ))}
          <div style={{ margin: '10px 12px 0', height: 40, borderRadius: 8, border: `1px dashed ${tk.border}`, display: 'flex', alignItems: 'center', padding: '0 12px', fontSize: 14, color: tk.mutedFg }}>
            添加待办，回车保存 · 支持「明天 9 点」这样的自然语言
          </div>
          <div style={{ padding: '18px 12px 4px', fontSize: 12, color: tk.mutedFg, opacity: step(4.5) }}>已完成 · 2</div>
          {DONE.map((td, i) => (
            <TodoRow key={td.title} tk={tk} item={{ ...td, done: 1 }} enter={step(4.5 + i * 0.4)} />
          ))}
        </div>
        <div style={{ flex: 1, borderRadius: 12, border: `1px solid ${tk.border}`, background: tk.card, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: step(3) }}>
          <Pomodoro tk={tk} t={t} start={focusAt} press={focusPress} hover={focusHover} />
        </div>
      </div>
    </div>
  );
};

/** 「开始专注」按钮中心（窗口内容坐标）。 */
export const focusButtonCenter = () => {
  const colW = (TODAY_W - PAD * 2 - 20) / 2.55;
  const x = TODAY_W - PAD - colW / 2;
  const areaH = TODAY_H - 38 - 196 - PAD;
  const block = 200 + 18 + 38 + 14 + 17;
  const y = 196 + (areaH - block) / 2 + 200 + 18 + 19;
  return { x, y };
};
