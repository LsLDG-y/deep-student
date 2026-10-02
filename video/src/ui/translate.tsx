import { ArrowsLeftRight, CaretDown, Translate } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { clamp, prog } from '../lib/time';
import { font, type Tokens } from '../theme';

/**
 * 翻译工作台（translation 文案）：领域预设 7 选 1、同步滚动、逐段双语对照。
 */
export const TRANS_W = 1240;
export const TRANS_H = 760;

const DOMAINS = ['通用', '学术论文', '技术文档', '文学作品', '法律文书', '医学文献', '日常对话'];

const SOURCE = [
  'The testing effect refers to the finding that retrieving information from memory produces better long-term retention than restudying the same material for an equal amount of time.',
  'Crucially, the benefit grows when retrieval is effortful and spaced out over days rather than massed into a single session, which is why low-stakes quizzes outperform rereading.',
  'Feedback after each attempt matters as well: learners who see the correct answer immediately correct their misconceptions instead of rehearsing their errors.',
  'Taken together, these results suggest that study tools should schedule retrieval, not exposure — a principle that modern spaced-repetition algorithms such as FSRS make explicit.',
];
const TARGET = [
  '测试效应指的是：与花同样时间重读材料相比，从记忆中主动提取信息能带来更好的长期保持。',
  '关键在于，当提取需要付出努力、并且分散在数天之内而非集中在一次学习中时，收益会进一步增大——这也是低风险小测优于反复重读的原因。',
  '每次作答后的反馈同样重要：立即看到正确答案的学习者会纠正误解，而不是一再强化自己的错误。',
  '综合来看，这些结果表明，学习工具应当安排「提取」，而不是安排「接触」——FSRS 等现代间隔重复算法正是把这一原则写进了调度之中。',
];

export type TransState = { run: number; press: number; scroll: number };

const Column = ({ tk, title, children }: { tk: Tokens; title: string; children: ReactNode }) => (
  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
    <div style={{ height: 40, display: 'flex', alignItems: 'center', padding: '0 22px', fontSize: 13, fontWeight: 600, color: tk.mutedFg, borderBottom: `1px solid ${tk.border}` }}>{title}</div>
    <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>{children}</div>
  </div>
);

export const TranslateView = ({ tk, s }: { tk: Tokens; s: TransState }) => {
  const scrollY = -s.scroll * 120;
  const active = Math.min(3, Math.floor(s.run * 4));
  return (
    <div style={{ position: 'absolute', inset: 0, fontFamily: font.ui, background: tk.background, display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 54, borderBottom: `1px solid ${tk.border}`, display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px', flexShrink: 0 }}>
        <span style={{ height: 32, padding: '0 12px', borderRadius: 8, border: `1px solid ${tk.border}`, display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: tk.foreground }}>
          英语 <CaretDown size={12} color={tk.mutedFg} />
        </span>
        <ArrowsLeftRight size={15} color={tk.mutedFg} />
        <span style={{ height: 32, padding: '0 12px', borderRadius: 8, border: `1px solid ${tk.border}`, display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: tk.foreground }}>
          简体中文 <CaretDown size={12} color={tk.mutedFg} />
        </span>
        <span style={{ width: 1, height: 20, background: tk.border, margin: '0 6px' }} />
        <span style={{ fontSize: 13, color: tk.mutedFg }}>翻译领域</span>
        <span style={{ display: 'inline-flex', gap: 2, padding: 3, borderRadius: 9, background: tk.muted }}>
          {DOMAINS.map((d) => (
            <span key={d} style={{ height: 26, padding: '0 10px', borderRadius: 7, display: 'inline-flex', alignItems: 'center', fontSize: 12, fontWeight: d === '学术论文' ? 600 : 400, color: d === '学术论文' ? tk.foreground : tk.mutedFg, background: d === '学术论文' ? tk.background : 'transparent', boxShadow: d === '学术论文' ? '0 1px 2px rgba(0,0,0,0.08)' : undefined }}>
              {d}
            </span>
          ))}
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: tk.mutedFg }}>
          同步滚动
          <span style={{ width: 30, height: 18, borderRadius: 999, background: tk.primary, position: 'relative' }}>
            <span style={{ position: 'absolute', right: 2, top: 2, width: 14, height: 14, borderRadius: '50%', background: '#fff' }} />
          </span>
        </span>
        <span style={{ height: 32, padding: '0 16px', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: tk.primaryFg, background: tk.primary, transform: `scale(${1 - s.press * 0.05})` }}>
          <Translate size={14} />
          翻译
        </span>
      </div>
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <Column tk={tk} title="待翻译文本">
          <div style={{ position: 'absolute', left: 0, right: 0, top: 0, padding: '18px 22px', transform: `translateY(${scrollY}px)` }}>
            {SOURCE.map((p, i) => (
              <p key={i} style={{ margin: '0 0 6px', padding: '10px 12px', borderRadius: 8, fontFamily: '"Charter", "Iowan Old Style", Georgia, serif', fontSize: 16, lineHeight: '28px', color: tk.foreground, background: s.run > 0 && i === active ? `color-mix(in hsl, ${tk.primary} 6%, transparent)` : 'transparent' }}>
                {p}
              </p>
            ))}
          </div>
        </Column>
        <div style={{ width: 1, background: tk.border }} />
        <Column tk={tk} title="翻译结果">
          <div style={{ position: 'absolute', left: 0, right: 0, top: 0, padding: '18px 22px', transform: `translateY(${scrollY}px)` }}>
            {TARGET.map((p, i) => {
              const k = clamp(s.run * 4 - i);
              const shown = [...p].slice(0, Math.round([...p].length * k)).join('');
              return (
                <p key={i} style={{ margin: '0 0 6px', padding: '10px 12px', borderRadius: 8, minHeight: 56, fontSize: 16, lineHeight: '28px', color: tk.foreground, background: s.run > 0 && i === active ? `color-mix(in hsl, ${tk.primary} 6%, transparent)` : 'transparent', opacity: k > 0 ? 1 : 0 }}>
                  {shown}
                  {k > 0 && k < 1 ? <span style={{ display: 'inline-block', width: 2, height: 16, marginLeft: 1, verticalAlign: 'text-bottom', background: tk.primary }} /> : null}
                </p>
              );
            })}
          </div>
        </Column>
      </div>
      <div style={{ height: 34, borderTop: `1px solid ${tk.border}`, display: 'flex', alignItems: 'center', gap: 16, padding: '0 20px', fontSize: 12, color: tk.mutedFg, flexShrink: 0 }}>
        <span>逐段对照 · {Math.min(4, Math.ceil(s.run * 4))}/4 段</span>
        <span>术语表：retrieval → 提取 · spaced repetition → 间隔重复</span>
      </div>
    </div>
  );
};

export const transButtonCenter = () => ({ x: TRANS_W - 20 - 40, y: 27 });
export const transRunAt = (t: number, run0: number, dur: number) => prog(t, run0, run0 + dur);
