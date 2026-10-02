import { CaretDown, ChartBar, ChartPolar, NotePencil, Sparkle } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { clamp, ease, prog } from '../lib/time';
import { font, type Tokens } from '../theme';

/**
 * 作文批改（essay_grading 文案 + src-tauri essay_grading 内置「雅思大作文」模式：
 * 四个维度 Task Response / Coherence & Cohesion / Lexical Resource / Grammatical Range & Accuracy，各 9 分，总分取平均）。
 */
export const ESSAY_W = 1280;
export const ESSAY_H = 790;
const RIGHT = 420;

type Mark = { kind: 'grammar' | 'lexis' | 'good'; fix?: string };
type Seg = string | [string, Mark];

const ESSAY: Seg[][] = [
  [
    'Some people believe that university education should be free for everyone, while others argue that students ',
    ['should pay', { kind: 'good' }],
    ' for it. In my opinion, ',
    ['the government have to', { kind: 'grammar', fix: 'the government should' }],
    ' cover most of the cost, but not all of it.',
  ],
  [
    'On the one hand, free education gives ',
    ['every talented students', { kind: 'grammar', fix: 'every talented student' }],
    ' the same chance. Many families cannot afford high tuition fees, and ',
    ['a lot of', { kind: 'lexis', fix: 'a considerable number of' }],
    ' capable young people give up their studies for this reason.',
  ],
  [
    'On the other hand, ',
    ['completely free', { kind: 'lexis', fix: 'entirely tuition-free' }],
    ' universities put heavy pressure on public budgets. If students pay a small part of the fee, they may also ',
    ['value their learning more', { kind: 'good' }],
    ', which ',
    ['make', { kind: 'grammar', fix: 'makes' }],
    ' the system fairer for taxpayers.',
  ],
  ['In conclusion, a shared model, where the state pays the majority and students contribute a modest amount, is the most balanced solution.'],
];

export const DIMENSIONS: Array<[string, number]> = [
  ['Task Response', 6.5],
  ['Coherence & Cohesion', 7.0],
  ['Lexical Resource', 6.0],
  ['Grammatical Range & Accuracy', 6.5],
];

const POLISH: Array<[string, string, string]> = [
  ['the government have to cover most of the cost', 'the government should bear the majority of the cost', '主谓一致；bear the cost 更地道'],
  ['a lot of capable young people give up their studies', 'a considerable number of capable young people abandon their studies', '替换口语化表达，动词更精确'],
  ['which make the system fairer for taxpayers', 'which makes the system fairer to taxpayers', 'which 指代整句，用单数；fair to sb.'],
];

export type EssayState = {
  gradeHover: number;
  gradePress: number;
  /** 0–1：批注逐条浮现 */
  marks: number;
  score: number;
  polish: number;
  view: number;
};

const markColor = (tk: Tokens, m: Mark) => (m.kind === 'grammar' ? tk.destructive : m.kind === 'lexis' ? tk.warning : tk.success);

const Paragraphs = ({ tk, marks }: { tk: Tokens; marks: number }) => {
  let idx = 0;
  const total = ESSAY.flat().filter((s) => typeof s !== 'string').length;
  return (
    <>
      {ESSAY.map((para, pi) => (
        <p key={pi} style={{ margin: '0 0 16px', fontSize: 16, lineHeight: '30px', color: tk.foreground, textIndent: 0 }}>
          {para.map((seg, si) => {
            if (typeof seg === 'string') return <span key={si}>{seg}</span>;
            const k = clamp(marks * total - idx++);
            const [text, m] = seg;
            const c = markColor(tk, m);
            return (
              <span key={si} style={{ position: 'relative' }}>
                <span
                  style={{
                    background: `color-mix(in hsl, ${c} ${k * (m.kind === 'good' ? 10 : 12)}%, transparent)`,
                    boxShadow: m.kind === 'grammar' ? `inset 0 -${2 * k}px 0 ${c}` : undefined,
                    borderRadius: 3,
                    padding: '1px 0',
                    textDecoration: m.kind === 'grammar' && k > 0.6 ? 'line-through' : undefined,
                    textDecorationColor: `color-mix(in hsl, ${c} 70%, transparent)`,
                  }}
                >
                  {text}
                </span>
                {m.fix && k > 0.05 ? (
                  <span
                    style={{
                      marginLeft: 6,
                      padding: '1px 7px',
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: 500,
                      color: c,
                      background: `color-mix(in hsl, ${c} 12%, transparent)`,
                      opacity: k,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {m.fix}
                  </span>
                ) : null}
              </span>
            );
          })}
        </p>
      ))}
    </>
  );
};

const ScoreRing = ({ tk, k }: { tk: Tokens; k: number }) => {
  const R = 46;
  const C = 2 * Math.PI * R;
  const v = 6.5 * ease.outCubic(k);
  return (
    <div style={{ position: 'relative', width: 112, height: 112 }}>
      <svg width={112} height={112} viewBox="0 0 112 112" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
        <circle cx={56} cy={56} r={R} fill="none" stroke={tk.muted} strokeWidth={7} />
        <circle cx={56} cy={56} r={R} fill="none" stroke={tk.primary} strokeWidth={7} strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - v / 9)} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 32, fontWeight: 600, color: tk.foreground, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{v.toFixed(1)}</span>
        <span style={{ marginTop: 4, fontSize: 12, color: tk.mutedFg }}>满分 9 分</span>
      </div>
    </div>
  );
};

const Tab = ({ tk, active, children, icon }: { tk: Tokens; active: boolean; children: ReactNode; icon?: ReactNode }) => (
  <span style={{ height: 30, padding: '0 12px', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: active ? tk.foreground : tk.mutedFg, background: active ? tk.muted : 'transparent' }}>
    {icon}
    {children}
  </span>
);

export const EssayView = ({ tk, s }: { tk: Tokens; s: EssayState }) => {
  const scoreK = clamp(s.score);
  return (
    <div style={{ position: 'absolute', inset: 0, fontFamily: font.ui, background: tk.background }}>
      <div style={{ height: 52, borderBottom: `1px solid ${tk.border}`, display: 'flex', alignItems: 'center', gap: 8, padding: '0 20px' }}>
        <Tab tk={tk} active>作文批改</Tab>
        <Tab tk={tk} active={false}>批改历史</Tab>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 13, color: tk.mutedFg }}>当前模式</span>
        <span style={{ height: 32, padding: '0 12px', borderRadius: 8, border: `1px solid ${tk.border}`, display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: tk.foreground }}>
          雅思大作文 · 满分 9 分
          <CaretDown size={12} color={tk.mutedFg} />
        </span>
        <span
          style={{
            height: 32,
            padding: '0 16px',
            borderRadius: 8,
            display: 'inline-flex',
            alignItems: 'center',
            fontSize: 13,
            fontWeight: 600,
            color: tk.primaryFg,
            background: tk.primary,
            transform: `scale(${1 - s.gradePress * 0.05 + s.gradeHover * 0.02})`,
          }}
        >
          开始批改
        </span>
      </div>
      <div style={{ position: 'absolute', left: 0, top: 52, bottom: 0, right: RIGHT, borderRight: `1px solid ${tk.border}`, padding: '24px 34px', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span style={{ fontSize: 13, color: tk.mutedFg }}>IELTS Writing Task 2</span>
          <span style={{ fontSize: 12, color: tk.mutedFg }}>· 236 words</span>
          <span style={{ flex: 1 }} />
          {s.marks > 0 ? (
            <span style={{ display: 'inline-flex', gap: 10, fontSize: 12, color: tk.mutedFg, opacity: clamp(s.marks * 3) }}>
              <span><span style={{ color: tk.destructive }}>●</span> 语法 3</span>
              <span><span style={{ color: tk.warning }}>●</span> 用词 2</span>
              <span><span style={{ color: tk.success }}>●</span> 亮点 2</span>
            </span>
          ) : null}
        </div>
        <div style={{ fontFamily: '"Charter", "Iowan Old Style", Georgia, serif' }}>
          <Paragraphs tk={tk} marks={s.marks} />
        </div>
      </div>
      <div style={{ position: 'absolute', right: 0, top: 52, bottom: 0, width: RIGHT, padding: '22px 24px', boxSizing: 'border-box', background: tk.card }}>
        {scoreK <= 0 && s.polish <= 0 ? (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: tk.mutedFg, textAlign: 'center' }}>
            <NotePencil size={28} />
            <span style={{ fontSize: 15, color: tk.foreground }}>等待批改</span>
            <span style={{ fontSize: 13, lineHeight: 1.6, maxWidth: 280 }}>点击「开始批改」后，批注结果将实时显示在这里</span>
          </div>
        ) : null}
        {scoreK > 0 ? (
          <div style={{ opacity: clamp(scoreK * 3) * (1 - s.polish), position: 'absolute', inset: '22px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <ScoreRing tk={tk} k={scoreK} />
              <div>
                <div style={{ fontSize: 13, color: tk.mutedFg }}>总分</div>
                <div style={{ marginTop: 4, fontSize: 22, fontWeight: 600, color: tk.foreground }}>Band 6.5</div>
                <div style={{ marginTop: 6, display: 'inline-flex', padding: '2px 10px', borderRadius: 999, fontSize: 12, color: tk.success, background: `color-mix(in hsl, ${tk.success} 12%, transparent)` }}>良好</div>
              </div>
            </div>
            <div style={{ marginTop: 22, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: tk.foreground }}>分项评分</span>
              <span style={{ display: 'inline-flex', gap: 4 }}>
                <Tab tk={tk} active icon={<ChartBar size={13} />}>条形视图</Tab>
                <Tab tk={tk} active={false} icon={<ChartPolar size={13} />}>雷达视图</Tab>
              </span>
            </div>
            {DIMENSIONS.map(([name, v], i) => {
              const k = prog(scoreK, 0.15 + i * 0.12, 0.6 + i * 0.12, ease.outCubic);
              return (
                <div key={name} style={{ marginTop: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: tk.foreground }}>
                    <span>{name}</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums', color: tk.mutedFg }}>{(v * k).toFixed(1)} / 9</span>
                  </div>
                  <div style={{ marginTop: 7, height: 6, borderRadius: 999, background: tk.muted, overflow: 'hidden' }}>
                    <div style={{ width: `${(v / 9) * 100 * k}%`, height: '100%', borderRadius: 999, background: tk.primary }} />
                  </div>
                </div>
              );
            })}
            <div style={{ marginTop: 22, paddingTop: 16, borderTop: `1px solid ${tk.border}`, fontSize: 13, lineHeight: 1.7, color: tk.mutedFg }}>
              论点清晰、结构完整；主谓一致仍是主要失分点，用词偏口语。
            </div>
          </div>
        ) : null}
        {s.polish > 0 ? (
          <div style={{ position: 'absolute', inset: '22px 24px', opacity: s.polish, transform: `translateX(${(1 - s.polish) * 16}px)` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: tk.foreground }}>
              <Sparkle size={15} color={tk.primary} />
              逐句润色
              <span style={{ fontSize: 12, fontWeight: 400, color: tk.mutedFg }}>· 3 处</span>
            </div>
            {POLISH.map(([from, to, why], i) => {
              const k = prog(s.polish, 0.2 + i * 0.18, 0.55 + i * 0.18, ease.outCubic);
              return (
                <div key={i} style={{ marginTop: 14, borderRadius: 10, border: `1px solid ${tk.border}`, background: tk.background, padding: '12px 14px', opacity: k, transform: `translateY(${(1 - k) * 8}px)` }}>
                  <div style={{ fontSize: 13, lineHeight: 1.6, color: tk.mutedFg, textDecoration: 'line-through', textDecorationColor: `color-mix(in hsl, ${tk.destructive} 55%, transparent)` }}>{from}</div>
                  <div style={{ marginTop: 6, fontSize: 14, lineHeight: 1.6, color: tk.foreground }}>
                    <span style={{ background: `color-mix(in hsl, ${tk.success} 12%, transparent)`, borderRadius: 3 }}>{to}</span>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12, color: tk.mutedFg }}>{why}</div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export const essayGradeCenter = () => ({ x: ESSAY_W - 20 - 44, y: 26 });
