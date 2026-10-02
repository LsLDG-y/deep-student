import { ArrowRight, Brain, Cards, CheckCircle, ClockCountdown, FilePdf, Target, UploadSimple, XCircle } from '@phosphor-icons/react';
import { clamp, ease, prog } from '../lib/time';
import { font, type Tokens } from '../theme';

/**
 * 题目集工作台（exam_sheet / practice 文案）：拖入试卷 → OCR 识别框 → 识别结果逐题流入 →
 * 限时练习 → 选错 → AI 解析 → 知识点掌握率。窗口内容坐标系，宽 EXAM_W。
 */
export const EXAM_W = 1240;
export const EXAM_H = 780;
const SIDE = 232;
const BODY_H = EXAM_H - 38;

export const PAPER_NAME = '高数期中模拟卷.pdf';

const QUESTIONS: Array<[string, string]> = [
  ['单选', '函数 f(x) = x³ − 3x 的极大值点为'],
  ['单选', '当 x → 0 时，与 x 等价的无穷小是'],
  ['单选', '设 y = ln(1 + x²)，则 dy 等于'],
  ['单选', '曲线 y = eˣ 在点 (0, 1) 处的切线方程'],
  ['单选', '下列反常积分收敛的是'],
  ['单选', '设 f(x) 在 x₀ 处可导，则极限'],
  ['单选', '罗尔定理条件下，下列结论一定成立的是'],
  ['单选', '函数 y = x·e⁻ˣ 的单调递增区间'],
  ['填空', '∫₀¹ x·eˣ dx = ____'],
  ['填空', 'lim (1 + 2/x)ˣ = ____（x → ∞）'],
  ['解答', '证明：当 x > 0 时，ln(1 + x) < x'],
];

export type ExamState = {
  /** 0–1：试卷落入后 OCR 识别进度 */
  ocr: number;
  /** 已流入结果列表的题数 */
  listed: number;
  parsed: number;
  startHover: number;
  startPress: number;
  /** 0–1：切到练习视图 */
  practice: number;
  /** 选了 A（错）的进度，与揭示正确答案的进度 */
  pick: number;
  reveal: number;
  /** AI 解析流式输出的字数比例 */
  explain: number;
  /** 掌握率面板 */
  mastery: number;
  toast: number;
  timer: string;
  dropHover: number;
};

const Sidebar = ({ tk }: { tk: Tokens }) => (
  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: SIDE, borderRight: `1px solid ${tk.border}`, background: tk.nav, padding: '18px 12px', boxSizing: 'border-box' }}>
    <div style={{ padding: '0 8px 10px', fontSize: 12, fontWeight: 600, color: tk.mutedFg, letterSpacing: '0.04em' }}>历史题目集</div>
    {[
      ['线代期中 2025', '24 题'],
      ['离子方程式专题', '13 题'],
      ['2026 高考模拟 · 化学', '18 题'],
      ['英语完形填空 ×5', '50 题'],
    ].map(([n, c], i) => (
      <div key={n} style={{ height: 40, padding: '0 8px', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, color: tk.foreground, background: i === -1 ? tk.selected : 'transparent' }}>
        <span style={{ whiteSpace: 'nowrap' }}>{n}</span>
        <span style={{ fontSize: 12, color: tk.mutedFg }}>{c}</span>
      </div>
    ))}
  </div>
);

/** 4 页试卷缩略图，题目区域上逐个浮现识别框。 */
const PagePreview = ({ tk, ocr }: { tk: Tokens; ocr: number }) => {
  const pages = 4;
  return (
    <div style={{ display: 'flex', gap: 14 }}>
      {Array.from({ length: pages }, (_, p) => {
        const pk = clamp(ocr * pages - p);
        return (
          <div key={p} style={{ position: 'relative', width: 128, height: 176, borderRadius: 4, background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 6px 16px -8px rgba(0,0,0,0.25)', border: `1px solid ${tk.border}`, overflow: 'hidden' }}>
            {Array.from({ length: 5 }, (_, q) => (
              <div key={q} style={{ position: 'absolute', left: 10, right: 10, top: 14 + q * 32 }}>
                <div style={{ height: 4, width: '72%', borderRadius: 2, background: '#e3e5e9' }} />
                <div style={{ marginTop: 5, height: 4, width: '92%', borderRadius: 2, background: '#eceef1' }} />
                <div style={{ marginTop: 5, height: 4, width: '55%', borderRadius: 2, background: '#eceef1' }} />
                <div
                  style={{
                    position: 'absolute',
                    left: -4,
                    top: -4,
                    right: -4,
                    height: 25,
                    borderRadius: 3,
                    border: `1.5px solid ${tk.primary}`,
                    background: `color-mix(in hsl, ${tk.primary} 6%, transparent)`,
                    opacity: clamp(pk * 5 - q * 0.9),
                  }}
                />
              </div>
            ))}
            <span style={{ position: 'absolute', right: 6, bottom: 4, fontSize: 9, color: tk.mutedFg }}>{p + 1}</span>
          </div>
        );
      })}
    </div>
  );
};

const QuestionRow = ({ tk, i, q, k }: { tk: Tokens; i: number; q: [string, string]; k: number }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 34, padding: '0 10px', opacity: k, transform: `translateY(${(1 - k) * 6}px)`, fontSize: 13 }}>
    <span style={{ width: 22, color: tk.mutedFg, fontVariantNumeric: 'tabular-nums' }}>{i + 1}</span>
    <span style={{ padding: '1px 7px', borderRadius: 999, fontSize: 11, background: q[0] === '单选' ? tk.muted : `color-mix(in hsl, ${tk.primary} 10%, transparent)`, color: q[0] === '单选' ? tk.mutedFg : tk.primary }}>{q[0]}</span>
    <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: tk.foreground }}>{q[1]}</span>
  </div>
);

const Recognize = ({ tk, s }: { tk: Tokens; s: ExamState }) => {
  const dropped = s.ocr > 0;
  return (
    <div style={{ position: 'absolute', left: SIDE, top: 0, right: 0, bottom: 0, padding: 28, boxSizing: 'border-box', opacity: 1 - s.practice }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{ fontSize: 18, fontWeight: 600, color: tk.foreground }}>{dropped ? PAPER_NAME.replace('.pdf', '') : '新建题目集'}</span>
        <span style={{ fontSize: 13, color: tk.mutedFg }}>{dropped ? (s.parsed > 0 ? '识别完成，已保存至历史' : `正在 OCR 识别 ${Math.min(4, 1 + Math.floor(s.ocr * 4))}/4...`) : '上传题目集图片并预览分割结果'}</span>
      </div>
      {!dropped ? (
        <div
          style={{
            marginTop: 22,
            height: 420,
            borderRadius: 14,
            border: `1.5px dashed ${s.dropHover > 0 ? tk.primary : tk.border}`,
            background: s.dropHover > 0 ? `color-mix(in hsl, ${tk.primary} ${s.dropHover * 5}%, ${tk.background})` : tk.card,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            color: tk.mutedFg,
          }}
        >
          <UploadSimple size={30} color={s.dropHover > 0 ? tk.primary : tk.mutedFg} />
          <span style={{ fontSize: 15, color: tk.foreground }}>点击或将题目图片拖到此处</span>
          <span style={{ fontSize: 13 }}>支持 PDF、图片与 Word · 自动分割题目、选项与配图</span>
        </div>
      ) : (
        <div style={{ marginTop: 22, display: 'flex', gap: 24 }}>
          <div style={{ flex: 'none' }}>
            <PagePreview tk={tk} ocr={s.ocr} />
            <div style={{ marginTop: 14, height: 4, width: 4 * 128 + 3 * 14, borderRadius: 999, background: tk.muted, overflow: 'hidden' }}>
              <div style={{ width: `${s.ocr * 100}%`, height: '100%', background: tk.primary }} />
            </div>
            <div style={{ marginTop: 16, display: 'flex', gap: 8, opacity: s.parsed }}>
              {['选择 10', '填空 5', '解答 3'].map((c) => (
                <span key={c} style={{ padding: '4px 10px', borderRadius: 999, border: `1px solid ${tk.border}`, fontSize: 12, color: tk.foreground }}>{c}</span>
              ))}
              <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: 12, color: tk.mutedFg, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <ClockCountdown size={13} />
                限时练习 · 45 分钟
              </span>
            </div>
            <span
              style={{
                marginTop: 18,
                height: 40,
                padding: '0 18px',
                borderRadius: 9,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 14,
                fontWeight: 600,
                color: tk.primaryFg,
                background: tk.primary,
                opacity: s.parsed,
                transform: `scale(${(1 - s.startPress * 0.04) * (1 + s.startHover * 0.02)})`,
                boxShadow: `0 6px 16px -10px ${tk.primary}`,
              }}
            >
              开始练习
              <ArrowRight size={14} weight="bold" />
            </span>
          </div>
          <div style={{ flex: 1, minWidth: 0, borderRadius: 12, border: `1px solid ${tk.border}`, background: tk.card, padding: '12px 6px', boxSizing: 'border-box', height: 470, overflow: 'hidden' }}>
            <div style={{ padding: '0 10px 8px', display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ fontWeight: 600, color: tk.foreground }}>识别结果</span>
              <span style={{ color: tk.mutedFg, fontVariantNumeric: 'tabular-nums' }}>题目数 {Math.min(18, Math.round(s.listed))}</span>
            </div>
            {QUESTIONS.map((q, i) => (
              <QuestionRow key={i} tk={tk} i={i} q={q} k={clamp(s.listed - i)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const OPTIONS: Array<[string, string]> = [
  ['A', '存在 ξ ∈ [a, b]，使 f′(ξ) = 0'],
  ['B', '存在 ξ ∈ (a, b)，使 f(ξ) = 0'],
  ['C', '存在 ξ ∈ (a, b)，使 f′(ξ) = 0'],
  ['D', '对任意 x ∈ (a, b)，都有 f′(x) = 0'],
];
const EXPLAIN =
  '罗尔定理只保证 ξ 落在开区间 (a, b) 内，端点不在结论里；A 把区间写成了闭区间 [a, b]。这和你之前两道错题是同一个坑：中值定理里的 ξ 一律取开区间。';

const Option = ({ tk, k, text, state }: { tk: Tokens; k: string; text: string; state: { wrong: number; right: number; hover: number } }) => {
  const border = state.wrong > 0 ? `color-mix(in hsl, ${tk.destructive} ${state.wrong * 60}%, ${tk.border})` : state.right > 0 ? `color-mix(in hsl, ${tk.success} ${state.right * 60}%, ${tk.border})` : tk.border;
  const bg = state.wrong > 0 ? `color-mix(in hsl, ${tk.destructive} ${state.wrong * 7}%, ${tk.background})` : state.right > 0 ? `color-mix(in hsl, ${tk.success} ${state.right * 8}%, ${tk.background})` : state.hover > 0 ? tk.muted : tk.background;
  return (
    <div style={{ height: 50, borderRadius: 10, border: `1px solid ${border}`, background: bg, display: 'flex', alignItems: 'center', gap: 14, padding: '0 16px', fontSize: 16, color: tk.foreground }}>
      <span style={{ width: 26, height: 26, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, background: tk.muted, color: tk.mutedFg }}>{k}</span>
      <span style={{ flex: 1, fontFamily: font.serif }}>{text}</span>
      {state.wrong > 0.5 ? <XCircle size={20} weight="fill" color={tk.destructive} /> : null}
      {state.right > 0.5 ? <CheckCircle size={20} weight="fill" color={tk.success} /> : null}
    </div>
  );
};

const MASTERY: Array<[string, number, number]> = [
  ['ξ 的取值范围', 34, 26],
  ['罗尔定理', 76, 71],
  ['拉格朗日中值定理', 81, 81],
  ['泰勒公式', 58, 58],
  ['洛必达法则', 61, 61],
];

const Practice = ({ tk, s }: { tk: Tokens; s: ExamState }) => {
  const shown = Math.round(EXPLAIN.length * s.explain);
  const panelW = 300;
  return (
    <div style={{ position: 'absolute', left: SIDE, top: 0, right: 0, bottom: 0, opacity: s.practice, transform: `translateX(${(1 - s.practice) * 24}px)` }}>
      <div style={{ height: 52, borderBottom: `1px solid ${tk.border}`, display: 'flex', alignItems: 'center', gap: 14, padding: '0 24px', fontSize: 14 }}>
        <span style={{ fontWeight: 600, color: tk.foreground }}>限时练习</span>
        <span style={{ color: tk.mutedFg }}>{PAPER_NAME.replace('.pdf', '')}</span>
        <span style={{ flex: 1 }} />
        <span style={{ color: tk.mutedFg }}>进度</span>
        <span style={{ fontVariantNumeric: 'tabular-nums', color: tk.foreground }}>7 / 18</span>
        <span style={{ width: 120, height: 4, borderRadius: 999, background: tk.muted, overflow: 'hidden' }}>
          <span style={{ display: 'block', width: `${(7 / 18) * 100}%`, height: '100%', background: tk.primary }} />
        </span>
        <span style={{ marginLeft: 8, color: tk.mutedFg }}>剩余时间</span>
        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: tk.foreground }}>{s.timer}</span>
        <span style={{ marginLeft: 6, height: 30, padding: '0 14px', borderRadius: 8, border: `1px solid ${tk.border}`, display: 'inline-flex', alignItems: 'center', color: tk.foreground }}>交卷</span>
      </div>
      <div style={{ position: 'absolute', left: 28, top: 52 + 24, right: 28 + panelW * s.mastery + 20 * s.mastery }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: tk.mutedFg }}>
          <span style={{ fontWeight: 600, color: tk.foreground }}>第 7 题</span>
          <span style={{ padding: '1px 8px', borderRadius: 999, background: tk.muted }}>单选</span>
          <span style={{ padding: '1px 8px', borderRadius: 999, background: tk.muted }}>罗尔定理</span>
        </div>
        <div style={{ marginTop: 14, fontFamily: font.serif, fontSize: 19, lineHeight: 1.75, color: tk.foreground }}>
          设 f(x) 在 [a, b] 上连续，在 (a, b) 内可导，且 f(a) = f(b)。下列结论一定成立的是（　　）
        </div>
        <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {OPTIONS.map(([k, text]) => (
            <Option key={k} tk={tk} k={k} text={text} state={{ wrong: k === 'A' ? s.pick : 0, right: k === 'C' ? s.reveal : 0, hover: 0 }} />
          ))}
        </div>
        {s.explain > 0 ? (
          <div style={{ marginTop: 18, borderRadius: 12, border: `1px solid ${tk.border}`, background: tk.card, padding: '14px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: tk.foreground }}>
              <Brain size={15} color={tk.primary} />
              {s.explain < 1 ? 'AI 解析中...' : 'AI 解析'}
            </div>
            <div style={{ marginTop: 8, fontSize: 15, lineHeight: 1.75, color: tk.foreground, minHeight: 78 }}>
              {EXPLAIN.slice(0, shown)}
              {s.explain < 1 ? <span style={{ display: 'inline-block', width: 2, height: 16, marginLeft: 1, verticalAlign: 'text-bottom', background: tk.primary }} /> : null}
            </div>
          </div>
        ) : null}
      </div>
      {s.mastery > 0 ? (
        <div style={{ position: 'absolute', right: 28, top: 52 + 24, width: panelW, borderRadius: 12, border: `1px solid ${tk.border}`, background: tk.card, padding: '16px 18px', boxSizing: 'border-box', opacity: s.mastery, transform: `translateX(${(1 - s.mastery) * 20}px)` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600, color: tk.foreground }}>
            <Target size={15} />
            知识点掌握率
          </div>
          {MASTERY.map(([name, from, to], i) => {
            const k = prog(s.mastery, 0.35 + i * 0.05, 0.85, ease.inOutCubic);
            const v = from + (to - from) * k;
            const weak = v < 40;
            return (
              <div key={name} style={{ marginTop: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: tk.foreground }}>
                  <span>{name}</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', color: weak ? tk.destructive : tk.mutedFg }}>{Math.round(v)}%</span>
                </div>
                <div style={{ marginTop: 6, height: 5, borderRadius: 999, background: tk.muted, overflow: 'hidden' }}>
                  <div style={{ width: `${v}%`, height: '100%', borderRadius: 999, background: weak ? tk.destructive : v < 65 ? tk.warning : tk.success }} />
                </div>
              </div>
            );
          })}
          <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${tk.border}`, fontSize: 12, lineHeight: 1.6, color: tk.mutedFg }}>掌握率回流复习调度：越薄弱，越早出现在今日复习里。</div>
        </div>
      ) : null}
      {s.toast > 0 ? (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            bottom: 26,
            transform: `translate(-50%, ${(1 - ease.outCubic(clamp(s.toast * 3))) * 10}px)`,
            opacity: Math.min(1, s.toast * 4, (1 - s.toast) * 6),
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 16px',
            borderRadius: 10,
            background: tk.foreground,
            color: tk.background,
            fontSize: 14,
            boxShadow: '0 12px 30px -12px rgba(0,0,0,0.45)',
            whiteSpace: 'nowrap',
          }}
        >
          <Cards size={16} />
          已加入今日复习：ξ 的取值范围
        </div>
      ) : null}
    </div>
  );
};

export const ExamView = ({ tk, s }: { tk: Tokens; s: ExamState }) => (
  <div style={{ position: 'absolute', inset: 0, fontFamily: font.ui, background: tk.background }}>
    <Sidebar tk={tk} />
    {s.practice < 1 ? <Recognize tk={tk} s={s} /> : null}
    {s.practice > 0 ? <Practice tk={tk} s={s} /> : null}
  </div>
);

/** 拖拽中的文件卡片（桌面坐标系，由场景摆放）。 */
export const FileChip = ({ tk, lift = 0 }: { tk: Tokens; lift?: number }) => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 10,
      padding: '10px 14px 10px 10px',
      borderRadius: 10,
      background: tk.background,
      border: `1px solid ${tk.border}`,
      boxShadow: `0 ${4 + lift * 14}px ${12 + lift * 24}px -8px rgba(0,0,0,${0.18 + lift * 0.14})`,
      fontFamily: font.ui,
      transform: `rotate(${lift * -3}deg) scale(${1 + lift * 0.04})`,
    }}
  >
    <span style={{ width: 34, height: 40, borderRadius: 4, background: `color-mix(in hsl, ${tk.destructive} 10%, #fff)`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: tk.destructive }}>
      <FilePdf size={22} weight="fill" />
    </span>
    <span>
      <span style={{ display: 'block', fontSize: 14, fontWeight: 500, color: tk.foreground, whiteSpace: 'nowrap' }}>{PAPER_NAME}</span>
      <span style={{ display: 'block', fontSize: 12, color: tk.mutedFg }}>4 页 · 2.1 MB</span>
    </span>
  </div>
);

/** 「开始练习」按钮中心、选项 A 中心（窗口内容坐标）。 */
export const examStartCenter = () => ({ x: SIDE + 28 + 66, y: 28 + 26 + 22 + 176 + 14 + 4 + 16 + 26 + 18 + 20 });
export const examOptionCenter = (i: number) => ({ x: SIDE + 28 + 200, y: 52 + 24 + 22 + 14 + 66 + 18 + i * 60 + 25 });
export const EXAM_DROP = { x: SIDE + 28 + 380, y: 28 + 26 + 22 + 210 };
export { BODY_H as EXAM_BODY_H };
