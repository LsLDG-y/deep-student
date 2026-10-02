import {
  ArrowRight,
  Cards,
  CaretDown,
  ChartBar,
  ChartPolar,
  CircleNotch,
  ClipboardText,
  Copy,
  Download,
  Eye,
  FileText,
  GraduationCap,
  Image as ImageIcon,
  ListChecks,
  Notebook,
  Pen,
  PenNib,
  Robot,
  Sparkle,
  Trash,
  UploadSimple,
} from '@phosphor-icons/react';
import type { CSSProperties, ReactNode } from 'react';
import { clamp, ease } from '../lib/time';
import { S } from '../strings';
import { font, type Tokens } from '../theme';
import { at, Btn, HOVER_BG, MAIN_W, MAIN_X, mix, RESOURCE_NEW_PT, ResourceHome, ResourceSidebar } from './resource';

/**
 * 作文批改：ResourceAppWorkspace（左栏作文列表）+ EssayContentView（InputPanel 上 / ResultPanel 下）。
 * 片中走产品真实路径：选择一个项目 →「新建作文批改」→ 新作文 → 粘贴作文 →「开始批改」→ 流式批注（准备中 → 批注中 → 润色中）
 * → 完成后分数卡插在视口上方 → 往上滚看分数、再往下看雷达 →「润色提升」。
 * 几何取自真机 DOM 取证（video/out/cap/probe-x*.txt），默认窗口 880×620（apps/content/register.ts defaultFrame）。
 * 流式内容与 wb2.mjs 的 mock 是同一份后端 wire 格式（批注标签 → <section-polish> → <score> 在最末尾）。
 */
export const ESSAY_W = 880;
export const ESSAY_H = 620;

const MODE_NAME = '雅思大作文';
const MODEL_NAME = 'deepseek-v4';
const NEW_NAME = '新作文';
const EXISTING = ['雅思大作文：远程办公的利弊', '雅思大作文：城市该不该限车'];
/** 粘贴后的输入统计（真机 xc-4） */
const INPUT_STATS = { han: 0, en: 129, para: 4, punct: 18, chars: 758 };

const ESSAY_TEXT =
  'Some people believe that university education should be free for everyone, while others argue that students should pay for it. In my opinion, the government have to cover most of the cost, but not all of it.\n\nOn the one hand, free education gives every talented students the same chance. Many families cannot afford high tuition fees, and a lot of capable young people give up their studies for this reason.\n\nOn the other hand, completely free universities put heavy pressure on public budgets. If students pay a small part of the fee, they may also value their learning more, which make the system fairer for taxpayers.\n\nIn conclusion, a shared model, where the state pays the majority and students contribute a modest amount, is the most balanced solution.';
const RESULT =
  'Some people believe that university education should be free for everyone, while others argue that students <good>should pay</good> for it. In my opinion, <replace old="the government have to" new="the government should" reason="主语 the government 是单数，且表达观点用 should 更自然；have to 语气过强"/> cover most of the cost, but not all of it.\n\nOn the one hand, free education gives <err type="agreement" explanation="every 后接单数名词：every talented student；也可改成 all talented students">every talented students</err> the same chance. Many families cannot afford high tuition fees, and <replace old="a lot of" new="a considerable number of" reason="a lot of 偏口语，学术写作用 a considerable number of 更正式"/> capable young people give up their studies for this reason.\n\nOn the other hand, <note text="completely free 语气绝对，改成 entirely tuition-free 更准确">completely free</note> universities put heavy pressure on public budgets. If students pay a small part of the fee, they may also <good>value their learning more</good>, which <err type="agreement" explanation="which 指代前面整句话，作单数主语，谓语用 makes">make</err> the system fairer for taxpayers.\n\nIn conclusion, a shared model, where the state pays the majority and students contribute a modest amount, is the most balanced solution.\n\n<section-polish>\n<polish-item>\n<original>Many families cannot afford high tuition fees, and a lot of capable young people give up their studies for this reason.</original>\n<polished>Many families cannot afford high tuition fees, which forces a considerable number of capable young people to abandon their studies.</polished>\n</polish-item>\n<polish-item>\n<original>If students pay a small part of the fee, they may also value their learning more</original>\n<polished>Requiring students to contribute a modest share of the fee may also lead them to value their education more highly</polished>\n</polish-item>\n<polish-item>\n<original>In conclusion, a shared model, where the state pays the majority and students contribute a modest amount, is the most balanced solution.</original>\n<polished>In conclusion, a cost-sharing model, in which the state covers the majority and students contribute a modest amount, offers the most balanced solution.</polished>\n</polish-item>\n</section-polish>\n\n<score total="6.5" max="9">\n<dim name="Task Response" score="6.5" max="9">立场明确（政府承担大部分、学生分担小部分），两方面都有展开，但第二段论据停留在一般性陈述，缺少具体例子支撑。</dim>\n<dim name="Coherence & Cohesion" score="7" max="9">四段结构清晰，On the one hand / On the other hand / In conclusion 衔接自然；段内句间推进还可以更紧。</dim>\n<dim name="Lexical Resource" score="6" max="9">基本词汇使用准确，但 a lot of、completely free 等表达偏口语，学术搭配偏少。</dim>\n<dim name="Grammatical Range & Accuracy" score="6.5" max="9">有定语从句和条件句，句式有变化；主谓一致错误出现 3 处（the government have、every talented students、which make）。</dim>\n</score>';

const POLISH_AT = RESULT.indexOf('<section-polish>');
const POLISH_END = RESULT.indexOf('</section-polish>');
const SCORE_AT = RESULT.indexOf('<score');

// ── 解析 wire 格式 ─────────────────────────────────────
type Seg =
  | { kind: 'text'; text: string; start: number }
  | { kind: 'good' | 'err' | 'note'; text: string; start: number; inner: number; end: number }
  | { kind: 'replace'; old: string; neu: string; start: number; end: number };

/** buildParagraphs：文本按换行切段（space-y-3），批注留在所在段内。 */
const PARAS: Seg[][] = (() => {
  const body = RESULT.slice(0, POLISH_AT);
  const paras: Seg[][] = [[]];
  const pushText = (s: string, from: number) => {
    let i = 0;
    for (const m of s.matchAll(/\n+/g)) {
      if (m.index! > i) paras[paras.length - 1].push({ kind: 'text', text: s.slice(i, m.index), start: from + i });
      paras.push([]);
      i = m.index! + m[0].length;
    }
    if (i < s.length) paras[paras.length - 1].push({ kind: 'text', text: s.slice(i), start: from + i });
  };
  const re = /<good>([\s\S]*?)<\/good>|<replace old="([^"]*)" new="([^"]*)"[^>]*\/>|<(err|note)\b[^>]*>([\s\S]*?)<\/\4>/g;
  let last = 0;
  for (const m of body.matchAll(re)) {
    const start = m.index!;
    const end = start + m[0].length;
    pushText(body.slice(last, start), last);
    const para = paras[paras.length - 1];
    if (m[1] !== undefined) para.push({ kind: 'good', text: m[1], start, inner: start + '<good>'.length, end });
    else if (m[2] !== undefined) para.push({ kind: 'replace', old: m[2], neu: m[3], start, end });
    else para.push({ kind: m[4] as 'err' | 'note', text: m[5], start, inner: end - `</${m[4]}>`.length - m[5].length, end });
    last = end;
  }
  pushText(body.slice(last), last);
  return paras.filter((p) => p.length > 0);
})();
const MARKS = PARAS.flat().filter((s) => s.kind !== 'text') as Array<Exclude<Seg, { kind: 'text' }>>;
const FIRST_MARK = MARKS[0].start;

const DIMS = [...RESULT.matchAll(/<dim name="([^"]+)" score="([^"]+)" max="([^"]+)">([^<]*)<\/dim>/g)].map((m) => ({
  name: m[1],
  score: Number(m[2]),
  max: Number(m[3]),
  comment: m[4],
  start: m.index! + m[0].indexOf('>') + 1,
}));
const TOTAL = 6.5;
const MAX = 9;

// ── 状态 ──────────────────────────────────────────────
export type EssayStage = 'home' | 'draft' | 'grading' | 'done';
export type EssayTarget = 'new' | 'grade' | 'polish';

export type EssayState = {
  stage: EssayStage;
  /** 视图切换淡入 0–1 */
  enter: number;
  pasted: boolean;
  hover: EssayTarget | null;
  press: number;
  /** 输入锁定提示条展开 0–1（grid-rows 200ms） */
  lock: number;
  /** 已流出的原始字符数（含批注标签，= 后端 progress 的 char_count） */
  stream: number;
  /** 每脚本秒流出的原始字符数（批注入场淡入按时间换算） */
  rate: number;
  /** 批改完成后经过的脚本秒（分数卡挂载动画）；未完成为负 */
  sinceDone: number;
  /** 完成后结果区的滚动位置（px） */
  scroll: number;
  tab: 'overview' | 'polish';
  /** 分段切换后内容淡入 0–1（animate-chat-fade-in 200ms） */
  tabEnter: number;
  /** 指针停在结果区（悬停才显示的浮动字数统计）0–1 */
  resultHover: number;
  /** 结果区滚动条（CustomScrollArea 闲置隐藏，滚动 / 跟随流式时出现）0–1 */
  thumb: number;
  /** 真实时间秒：转圈 1s/圈，animate-pulse 2s 一个来回 */
  clock: number;
};

const AMBER = 'rgb(180, 83, 9)';
const EMERALD = 'rgb(4, 120, 87)';
const EMERALD_600 = 'rgb(5, 150, 105)';
const LINE = 'rgba(224,224,224,0.3)';
const LINE_SOFT = 'rgba(224,224,224,0.2)';

const pulseOf = (clock: number) => 0.75 + 0.25 * Math.cos(Math.PI * clock);

const Spin = ({ size, color, clock, style }: { size: number; color: string; clock: number; style?: CSSProperties }) => (
  <CircleNotch size={size} color={color} style={{ ...style, transform: `rotate(${(clock * 360) % 360}deg)` }} />
);

// ── 输入区 ────────────────────────────────────────────
const TopRows = ({ tk, locked }: { tk: Tokens; locked: number }) => (
  <>
    <Btn style={{ ...at(287, 45), width: 130.5, height: 28, borderRadius: 5, padding: '0 0 0 13.3px', gap: 7, fontSize: 12, fontWeight: 500, color: tk.mutedFg, opacity: 1 - 0.5 * locked }}>
      <GraduationCap size={14} />
      {MODE_NAME}
      <CaretDown size={16} />
    </Btn>
    <Btn style={{ ...at(737.2, 45.9), width: 88, height: 26.3, borderRadius: 9, padding: '0 0 0 11.5px', gap: 7, fontSize: 11, fontWeight: 500, color: mix(tk.mutedFg, 60), opacity: 1 - 0.5 * locked }}>
      <ImageIcon size={14} />
      {S.essay.importImages}
    </Btn>
    <span style={{ ...at(828.7, 51.3), fontSize: 11, lineHeight: '15.4px', color: mix(tk.mutedFg, 60) }}>{S.essay.round(1)}</span>
    <span style={{ ...at(MAIN_X, 79), width: MAIN_W, height: 1, background: LINE }} />
    <span style={{ ...at(287, 87), width: 16, height: 16, borderRadius: 3.5, background: 'rgba(240,240,240,0.6)' }} />
    <FileText size={12} color={mix(tk.mutedFg, 70)} style={{ ...at(289, 89) }} />
    <span style={{ ...at(310, 87.3), fontSize: 11, fontWeight: 500, lineHeight: '15.4px', color: mix(tk.mutedFg, 70) }}>{S.essay.topic}</span>
    <CaretDown size={14} color={mix(tk.mutedFg, 70)} style={{ ...at(850, 88) }} />
    <span style={{ ...at(MAIN_X, 110), width: MAIN_W, height: 1, background: LINE }} />
  </>
);

/** textarea 的 resize 角标 */
const Grip = ({ tk, bottom }: { tk: Tokens; bottom: number }) => (
  <svg width={8} height={8} viewBox="0 0 8 8" style={{ ...at(870, bottom - 9) }}>
    <path d="M7 1L1 7M7 4.5L4.5 7" stroke={mix(tk.mutedFg, 55)} strokeWidth={1} strokeLinecap="round" />
  </svg>
);

const PHASES = ['preparing', 'annotating', 'scoring', 'polishing', 'model_essay'] as const;
type Phase = 'preparing' | 'annotating' | 'polishing';
/** 产品按内容推断阶段（ResultPanel.inferGradingPhase）：<section-polish 一出现就判成润色，<score> 在它之后，所以评分阶段也显示「润色中」。 */
const phaseOf = (stream: number): Phase => (stream <= 0 ? 'preparing' : stream > POLISH_AT ? 'polishing' : 'annotating');

const LockBanner = ({ tk, k, phase, clock }: { tk: Tokens; k: number; phase: Phase; clock: number }) => {
  const cur = PHASES.indexOf(phase);
  return (
    <div style={{ ...at(MAIN_X, 111), width: 605, height: 26.9 * k, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: 605, height: 26.9, boxSizing: 'border-box', background: mix(tk.primary, 5), borderBottom: `1px solid ${LINE}` }}>
        <Spin size={12} color={tk.primary} clock={clock} style={{ position: 'absolute', left: 14, top: 6.9 }} />
        <span style={{ position: 'absolute', left: 33, top: 5.3, fontSize: 11, lineHeight: '15.4px', color: tk.mutedFg }}>{S.essay.lock}</span>
        <span style={{ position: 'absolute', left: 521.3, top: 5.3, fontSize: 11, lineHeight: '15.4px', color: mix(tk.primary, 80) }}>{S.essay.phase[phase]}</span>
        {PHASES.map((p, i) => (
          <span
            key={p}
            style={{
              position: 'absolute',
              left: 559.5 + 7 * i,
              top: 11.2,
              width: 3.5,
              height: 3.5,
              borderRadius: '50%',
              background: i < cur ? mix(tk.primary, 50) : i === cur ? tk.primary : mix(tk.mutedFg, 25),
              transform: i === cur ? 'scale(1.25)' : undefined,
            }}
          />
        ))}
      </div>
    </div>
  );
};

const InputArea = ({ tk, s, k }: { tk: Tokens; s: EssayState; k: number }) => {
  if (!s.pasted) {
    const dim = mix(tk.mutedFg, 45);
    return (
      <>
        <span style={{ ...at(445.5, 117.5), width: 260, textAlign: 'center', fontSize: 11, lineHeight: '17.9px', color: mix(tk.mutedFg, 50) }}>{S.essay.emptyDesc}</span>
        <ClipboardText size={12} color={dim} style={{ ...at(474.3, 164.3) }} />
        <span style={{ ...at(489.8, 163.7), fontSize: 11, lineHeight: '13.2px', color: dim }}>{S.essay.pasteHint}</span>
        <span style={{ ...at(573.8, 163.7), fontSize: 11, lineHeight: '13.2px', color: dim }}>·</span>
        <UploadSimple size={12} color={dim} style={{ ...at(584.2, 164.3) }} />
        <span style={{ ...at(599.7, 163.7), fontSize: 11, lineHeight: '13.2px', color: dim }}>{S.essay.dropHint}</span>
        <Btn style={{ ...at(462, 187.4), width: 110, height: 26.3, borderRadius: 9, border: `1px solid ${LINE}`, padding: '0 0 0 10.5px', gap: 7, fontSize: 11, fontWeight: 500, color: mix(tk.mutedFg, 70) }}>
          <ImageIcon size={14} />
          {S.essay.ocr}
        </Btn>
        <Btn style={{ ...at(579, 187.4), width: 110, height: 26.3, borderRadius: 9, border: `1px solid ${mix(tk.primary, 25)}`, padding: '0 0 0 10.5px', gap: 7, fontSize: 11, fontWeight: 500, color: mix(tk.primary, 80) }}>
          <Sparkle size={14} />
          {S.essay.sample}
        </Btn>
        <Grip tk={tk} bottom={198.6} />
      </>
    );
  }
  const top = 111 + 26.9 * k;
  const h = 82 - 16 * k;
  const statY = 196.8 + 8.1 * k;
  const st = S.essay.stat;
  const n = INPUT_STATS;
  return (
    <>
      <div style={{ ...at(MAIN_X, top), width: 605, height: h, overflow: 'hidden' }}>
        {/* 粘贴后光标停在末尾，textarea 滚到能看见最后一行（xc-4：末行只露出上半截） */}
        <div style={{ position: 'absolute', left: 18, width: 567, bottom: h - 91.1, fontSize: 12, lineHeight: '21.6px', color: tk.foreground, whiteSpace: 'pre-wrap' }}>{ESSAY_TEXT}</div>
      </div>
      <Grip tk={tk} bottom={top + h} />
      <span style={{ ...at(MAIN_X, statY), width: 836 + 28 * k - MAIN_X, textAlign: 'right', fontSize: 11, lineHeight: '13px', color: mix(tk.mutedFg, 50), whiteSpace: 'nowrap' }}>
        {`${st.han}: ${n.han} · ${st.en}: ${n.en} · ${st.para}: ${n.para} · ${st.punct}: ${n.punct} · ${n.chars} / 50,000 ${st.chars}`}
      </span>
      {k < 0.5 ? <Trash size={14} color={mix(tk.mutedFg, 50)} style={{ ...at(846.5, 196.5), opacity: 1 - 2 * k }} /> : null}
    </>
  );
};

const ModelRow = ({ tk, s, k }: { tk: Tokens; s: EssayState; k: number }) => {
  const top = 221 + 5.3 * k;
  const grading = s.stage === 'grading';
  const hover = s.hover === 'grade';
  return (
    <>
      <span style={{ ...at(MAIN_X, top), width: 605, height: 1, background: LINE }} />
      <Btn style={{ ...at(287, 233.4 + 2.6 * k), width: 134.9, height: 26.3, borderRadius: 9, padding: '0 0 0 11.5px', gap: 7, fontSize: 11, fontWeight: 500, color: tk.mutedFg, opacity: 1 - 0.5 * k }}>
        <Robot size={14} />
        {MODEL_NAME}
        <CaretDown size={14} />
      </Btn>
      {grading ? (
        <Btn style={{ ...at(796, 236), width: 68, height: 26.3, borderRadius: 9, justifyContent: 'center', gap: 6, fontSize: 12, fontWeight: 500, color: tk.mutedFg }}>
          <Spin size={14} color={tk.mutedFg} clock={s.clock} />
          {S.essay.cancel}
        </Btn>
      ) : (
        <Btn
          style={{
            ...at(786, 230.8),
            width: 78,
            height: 31.5,
            borderRadius: 9,
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 500,
            color: s.pasted ? tk.foreground : tk.mutedFg,
            opacity: s.pasted ? 1 : 0.5,
            background: hover ? HOVER_BG : 'transparent',
            transform: `scale(${1 - 0.03 * (hover ? s.press : 0)})`,
          }}
        >
          {S.essay.grade}
        </Btn>
      )}
      <span style={{ ...at(MAIN_X, 271), width: MAIN_W, height: 1, background: tk.border }} />
    </>
  );
};

// ── 结果区：顶栏 / 分段 Tab / 筛选芯片 ─────────────────
const ResultHeader = ({ tk, s }: { tk: Tokens; s: EssayState }) => {
  const grading = s.stage === 'grading';
  const phase = phaseOf(s.stream);
  const chars = Math.floor(s.stream);
  const icon = (x: number, I: typeof Copy) => <I key={x} size={14} color={mix(tk.mutedFg, 50)} style={{ ...at(x + 5.3, 285) }} />;
  return (
    <>
      <Pen size={14} color={mix(tk.foreground, 70)} style={{ ...at(287, 285) }} />
      <span style={{ ...at(308, 283.6), fontSize: 12, lineHeight: '16.8px', color: mix(tk.foreground, 70) }}>{S.essay.result}</span>
      <span style={{ ...at(366.5, 284.3), fontSize: 11, lineHeight: '15.4px', color: mix(tk.mutedFg, 60) }}>{S.essay.round(1)}</span>
      {grading ? (
        <>
          <Spin size={12} color={mix(tk.primary, 70)} clock={s.clock} style={{ ...at(412.4, 286) }} />
          <span style={{ ...at(429.6, 284.3), fontSize: 11, lineHeight: '15.4px', color: mix(tk.primary, 70) }}>{S.essay.phase[phase]}</span>
          {chars > 0 ? <span style={{ ...at(467.8, 284.3), fontSize: 11, lineHeight: '15.4px', color: mix(tk.mutedFg, 50), whiteSpace: 'nowrap' }}>· {S.essay.generated(chars)}</span> : null}
        </>
      ) : null}
      {grading && chars > 0 ? [icon(812.5, Copy), icon(840.5, Download)] : null}
      {s.stage === 'done' ? [icon(784.5, Copy), icon(812.5, Notebook), icon(840.5, Download)] : null}
      <span style={{ ...at(MAIN_X, 313), width: MAIN_W, height: 1, background: LINE }} />
    </>
  );
};

type Counts = { all: number; errors: number; suggestions: number; highlights: number };
const countsAt = (pos: number): Counts => {
  const done = MARKS.filter((m) => pos >= m.end);
  const errors = done.filter((m) => m.kind === 'err').length;
  const suggestions = done.filter((m) => m.kind === 'replace' || m.kind === 'note').length;
  const highlights = done.filter((m) => m.kind === 'good').length;
  return { all: errors + suggestions + highlights, errors, suggestions, highlights };
};

const TABS_TOP = 313;
const CHIPS_TOP = 346.9;
const VIEW_TOP_CHIPS = 380.75;

const TabsRow = ({ tk, s }: { tk: Tokens; s: EssayState }) => {
  const polishShown = s.stage === 'done' || s.stream > POLISH_AT;
  const polishGenerating = s.stage === 'grading' && s.stream > POLISH_AT && s.stream < POLISH_END;
  const tabs: Array<{ id: string; x: number; w: number; label: string; Icon: typeof FileText }> = [
    { id: 'overview', x: 287, w: 84.3, label: S.essay.tab.overview, Icon: FileText },
    { id: 'details', x: 374.8, w: 84.3, label: S.essay.tab.details, Icon: ListChecks },
    ...(polishShown ? [{ id: 'polish', x: 462.5, w: polishGenerating ? 99.5 : 84.3, label: S.essay.tab.polish, Icon: Sparkle }] : []),
  ];
  return (
    <>
      {tabs.map(({ id, x, w, label, Icon }) => {
        const active = s.tab === id;
        const hovered = !active && id === 'polish' && s.hover === 'polish';
        return (
          <Btn
            key={id}
            style={{
              ...at(x, 316.5),
              width: w,
              height: 25.9,
              borderRadius: 5,
              padding: '0 0 0 10.5px',
              gap: 5.25,
              fontSize: 11,
              fontWeight: active ? 500 : 400,
              color: active ? tk.primary : hovered ? tk.foreground : mix(tk.mutedFg, 60),
              background: active ? mix(tk.primary, 10) : hovered ? HOVER_BG : 'transparent',
              transform: `scale(${1 - 0.03 * (hovered ? s.press : 0)})`,
            }}
          >
            <Icon size={14} />
            {label}
            {id === 'polish' && polishGenerating ? <Spin size={10} color={mix(tk.mutedFg, 50)} clock={s.clock} style={{ marginLeft: 1 }} /> : null}
          </Btn>
        );
      })}
      <span style={{ ...at(MAIN_X, CHIPS_TOP - 1), width: MAIN_W, height: 1, background: LINE_SOFT }} />
    </>
  );
};

const ChipsRow = ({ tk, counts }: { tk: Tokens; counts: Counts }) => {
  const chips: Array<[keyof Counts, number, number]> = [
    ['all', 287, 50.2],
    ['errors', 340.7, 50],
    ['suggestions', 394.2, 50],
    ['highlights', 447.7, 50],
  ];
  return (
    <>
      {chips.map(([id, x, w]) => {
        const active = id === 'all';
        return (
          <Btn
            key={id}
            style={{
              ...at(x, 352.1),
              width: w,
              height: 22.4,
              borderRadius: 999,
              padding: '0 0 0 8.75px',
              fontSize: 11,
              fontWeight: active ? 500 : 400,
              color: active ? tk.primary : mix(tk.mutedFg, 60),
              background: active ? mix(tk.primary, 10) : 'transparent',
              opacity: !active && counts[id] === 0 ? 0.4 : 1,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {S.essay.filter[id]}
            <span style={{ marginLeft: 3.5, color: active ? mix(tk.primary, 70) : mix(tk.mutedFg, 40) }}>{counts[id]}</span>
          </Btn>
        );
      })}
      <span style={{ ...at(805.5, 355.6), fontSize: 11, lineHeight: '15.4px', color: mix(tk.mutedFg, 60) }}>{S.essay.expand}</span>
      <CaretDown size={12} color={mix(tk.mutedFg, 60)} style={{ ...at(853, 357.3) }} />
      <span style={{ ...at(MAIN_X, VIEW_TOP_CHIPS - 1), width: MAIN_W, height: 1, background: LINE_SOFT }} />
    </>
  );
};

// ── 批注正文 ──────────────────────────────────────────
const markStyle = (kind: 'good' | 'err' | 'note'): CSSProperties =>
  kind === 'good'
    ? { color: EMERALD, background: 'rgba(209,250,229,0.5)', borderLeft: '2px solid rgba(52,211,153,0.8)', borderRadius: '0 3px 3px 0', padding: '0 1.75px 0 3.5px' }
    : kind === 'err'
      ? { color: 'rgba(220,38,38,0.9)', textDecoration: 'underline wavy', textDecorationColor: 'rgba(248,113,113,0.6)', textUnderlineOffset: 4 }
      : { color: AMBER, borderBottom: '1px dashed rgba(251,191,36,0.7)' };

/**
 * StreamingAnnotatedText：15px / 1.8 行高 / foreground 85%，段间 space-y-3。
 * 流式中普通文字逐字出现；批注标签没闭合前，已到的内文是 pending（muted 60% + animate-pulse），闭合后换成批注样式并淡入 200ms；
 * <score> 在最末尾，流到它时各维度评语也以 pending 样式逐段出现；光标跟在最后一段末尾。
 */
const EssayBody = ({ tk, s, streaming }: { tk: Tokens; s: EssayState; streaming: boolean }) => {
  const pos = streaming ? s.stream : Infinity;
  const pulse = pulseOf(s.clock);
  const pendingStyle: CSSProperties = { color: mix(tk.mutedFg, 60), opacity: pulse };
  const fade = (end: number) => (streaming ? ease.wbOut(clamp((pos - end) / (s.rate * 0.1))) : 1);
  const paras: ReactNode[][] = [];
  for (const para of PARAS) {
    if (para[0].start >= pos) break;
    paras.push(
      para.map((seg, i) => {
        if (seg.kind === 'text') {
          const n = Math.min(seg.text.length, Math.floor(pos - seg.start));
          return n > 0 ? <span key={i}>{seg.text.slice(0, n)}</span> : null;
        }
        if (pos < seg.end) {
          if (seg.kind === 'replace' || pos <= seg.inner) return null;
          return (
            <span key={i} style={pendingStyle}>
              {seg.text.slice(0, Math.floor(pos - seg.inner))}
            </span>
          );
        }
        const k = fade(seg.end);
        if (seg.kind === 'replace') {
          return (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 3.5, padding: '0 1.75px', opacity: k }}>
              <span style={{ color: mix(tk.mutedFg, 70), textDecoration: 'line-through' }}>{seg.old}</span>
              <span style={{ color: mix(tk.mutedFg, 50), fontSize: 11 }}>→</span>
              <span style={{ color: AMBER, fontWeight: 500 }}>{seg.neu}</span>
            </span>
          );
        }
        return (
          <span key={i} style={{ ...markStyle(seg.kind), opacity: k }}>
            {seg.text}
          </span>
        );
      }),
    );
  }
  if (streaming && pos > SCORE_AT) {
    for (const d of DIMS) {
      if (pos <= d.start) break;
      paras.push([
        <span key="p" style={pendingStyle}>
          {d.comment.slice(0, Math.floor(pos - d.start))}
        </span>,
      ]);
    }
  }
  if (streaming && paras.length > 0) {
    paras[paras.length - 1].push(
      <span key="cursor" style={{ display: 'inline-block', width: 1.75, height: 16.5, marginLeft: 1.75, verticalAlign: 'middle', background: mix(tk.foreground, 40), opacity: pulse }} />,
    );
  }
  return (
    <div style={{ fontSize: 15, lineHeight: '27px', color: mix(tk.foreground, 85) }}>
      {paras.map((items, i) => (
        <div key={i} style={{ whiteSpace: 'pre-wrap', marginTop: i ? 10.5 : 0 }}>
          {items}
        </div>
      ))}
    </div>
  );
};

// ── 分数卡（ScoreCard：圆环 / 分数滚动 / 进度条 / 雷达，挂载即播 700ms / 500ms 入场）────
/** 内容区坐标：取证 xg（滚动到顶，视口顶 380.75）里的窗口 y 直接换算。 */
const sc = (x: number, y: number): CSSProperties => ({ position: 'absolute', left: x - MAIN_X, top: y - VIEW_TOP_CHIPS });
const gradeColor = (tk: Tokens, ratio: number) => (ratio >= 0.9 ? tk.success : ratio >= 0.75 ? tk.primary : ratio >= 0.6 ? tk.warning : tk.destructive);
const cssEaseOut = (x: number) => 1 - Math.pow(1 - clamp(x), 2.2);
const RADAR_LABELS: Record<string, string[]> = {
  'Task Response': ['Task', 'Response'],
  'Coherence & Cohesion': ['Coherence &', 'Cohesion'],
  'Lexical Resource': ['Lexical', 'Resource'],
  'Grammatical Range & Accuracy': ['Grammatical', 'Range &', 'Accuracy'],
};

const Radar = ({ tk, k }: { tk: Tokens; k: number }) => {
  const cx = 150;
  const cy = 110;
  const r = 70;
  const ang = (i: number) => ((-90 + (360 / DIMS.length) * i) * Math.PI) / 180;
  const pt = (i: number, rr: number) => [cx + rr * Math.cos(ang(i)), cy + rr * Math.sin(ang(i))] as const;
  const poly = (rr: (i: number) => number) => DIMS.map((_, i) => pt(i, rr(i)).join(',')).join(' ');
  const vals = DIMS.map((d) => d.score / d.max);
  return (
    <svg width={300} height={220} viewBox="0 0 300 220" style={{ ...sc(426, 540.3), overflow: 'visible' }}>
      {[0.25, 0.5, 0.75, 1].map((lv) => (
        <polygon key={lv} points={poly(() => r * lv)} fill="none" stroke={lv === 1 ? 'rgba(224,224,224,0.6)' : LINE} strokeWidth={1} />
      ))}
      {DIMS.map((_, i) => {
        const [x, y] = pt(i, r);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={LINE} strokeWidth={1} />;
      })}
      <g style={{ transformOrigin: `${cx}px ${cy}px`, transform: `scale(${0.6 + 0.4 * k})`, opacity: k }}>
        <polygon points={poly((i) => r * vals[i])} fill={mix(tk.primary, 15)} stroke={tk.primary} strokeWidth={1.5} strokeLinejoin="round" />
        {vals.map((v, i) => {
          const [x, y] = pt(i, r * v);
          return <circle key={i} cx={x} cy={y} r={2.5} fill={tk.primary} />;
        })}
      </g>
      {DIMS.map((d, i) => {
        const [x, y] = pt(i, 82);
        const cos = Math.cos(ang(i));
        const lines = RADAR_LABELS[d.name] ?? [d.name];
        return (
          <text key={d.name} x={x} y={y} textAnchor={Math.abs(cos) < 0.3 ? 'middle' : cos > 0 ? 'start' : 'end'} dominantBaseline="middle" fill={tk.mutedFg} style={{ fontSize: 10, fontFamily: font.sys }}>
            {lines.map((line, li) => (
              <tspan key={li} x={x} dy={li === 0 ? `${-((lines.length - 1) * 1.15) / 2}em` : '1.15em'}>
                {line}
              </tspan>
            ))}
          </text>
        );
      })}
    </svg>
  );
};

const ScoreCard = ({ tk, since }: { tk: Tokens; since: number }) => {
  const ratio = TOTAL / MAX;
  const color = gradeColor(tk, ratio);
  const k = cssEaseOut(since / 0.35);
  const count = (TOTAL * (1 - Math.pow(1 - clamp(since / 0.35), 3))).toFixed(1);
  const R = 24.5;
  const C = 2 * Math.PI * R;
  return (
    <>
      <svg width={56} height={56} viewBox="0 0 56 56" style={{ ...sc(290.5, 398.3), transform: 'rotate(-90deg)' }}>
        <circle cx={28} cy={28} r={R} fill="none" stroke={mix(tk.muted, 20)} strokeWidth={3.5} />
        <circle cx={28} cy={28} r={R} fill="none" stroke={color} strokeWidth={3.5} strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - ratio * k)} />
      </svg>
      <span style={{ ...sc(290.5, 413.7), width: 56, textAlign: 'center', fontSize: 18, fontWeight: 600, lineHeight: '25.2px', color, fontVariantNumeric: 'tabular-nums' }}>{count}</span>
      <span style={{ ...sc(360.5, 400.2), fontSize: 12, lineHeight: '16.8px', color: tk.mutedFg }}>{S.essay.total}</span>
      <span style={{ ...sc(360.5, 418.8), fontSize: 24, fontWeight: 600, lineHeight: '33.6px', color, fontVariantNumeric: 'tabular-nums' }}>{count}</span>
      <span style={{ ...sc(399, 428.8), fontSize: 14, lineHeight: '19.6px', color: mix(tk.mutedFg, 60) }}>/{MAX}</span>
      <Btn style={{ ...sc(816.5, 398.3), width: 45, height: 27.3, borderRadius: 5, justifyContent: 'center', fontSize: 12, fontWeight: 500, color, background: mix(color, 10) }}>{S.essay.pass}</Btn>
      <span style={{ ...sc(290.5, 471.8), width: 571, height: 3.5, borderRadius: 999, background: 'rgba(240,240,240,0.3)', overflow: 'hidden' }}>
        <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 571 * ratio * k, borderRadius: 999, background: color }} />
      </span>
      <span style={{ ...sc(290.5, 501.8), fontSize: 11, fontWeight: 500, lineHeight: '15.4px', color: mix(tk.mutedFg, 70) }}>{S.essay.dims}</span>
      <span style={{ ...sc(798.3, 492.8), width: 63.3, height: 33.5, boxSizing: 'border-box', borderRadius: 5, border: '1px solid rgba(224,224,224,0.4)' }} />
      <ChartBar size={13} color={mix(tk.mutedFg, 50)} style={{ ...sc(808.5, 503) }} />
      <span style={{ ...sc(830.8, 495.5), width: 28, height: 28, borderRadius: 9, background: mix(tk.primary, 10) }} />
      <ChartPolar size={13} color={tk.primary} style={{ ...sc(838.3, 503) }} />
      <Radar tk={tk} k={cssEaseOut(since / 0.25)} />
      <div style={{ ...sc(290.5, 770.35), width: 571, fontSize: 11, lineHeight: '17.9px' }}>
        {DIMS.map((d, i) => (
          <div key={d.name} style={{ marginTop: i ? 5.25 : 0 }}>
            <span style={{ color: mix(tk.foreground, 80) }}>{d.name}</span>
            <span style={{ marginLeft: 5.25, fontVariantNumeric: 'tabular-nums' }}>
              <span style={{ fontWeight: 500, color: gradeColor(tk, d.score / d.max) }}>{d.score}</span>
              <span style={{ color: mix(tk.mutedFg, 50) }}>/{d.max}</span>
            </span>
            <span style={{ marginLeft: 7, color: mix(tk.mutedFg, 60) }}>{d.comment}</span>
          </div>
        ))}
      </div>
    </>
  );
};

// ── 润色提升（PolishSectionView：词级 diff，删除红色删除线、新增绿色下划线）──────
type Op = [0 | 1, string];
const POLISH_CARD: { original: Op[]; polished: Op[] } = {
  original: [
    [0, 'Many families cannot afford high tuition fees, '],
    [1, 'and'],
    [0, ' a '],
    [1, 'lot'],
    [0, ' of capable young people '],
    [1, 'give'],
    [0, ' '],
    [1, 'up'],
    [0, ' their studies'],
    [1, ' for this reason'],
    [0, '.'],
  ],
  polished: [
    [0, 'Many families cannot afford high tuition fees, '],
    [1, 'which'],
    [0, ' '],
    [1, 'forces'],
    [0, ' a '],
    [1, 'considerable'],
    [0, ' '],
    [1, 'number'],
    [0, ' of capable young people '],
    [1, 'to'],
    [0, ' '],
    [1, 'abandon'],
    [0, ' their studies.'],
  ],
};
const DEL: CSSProperties = { color: 'rgba(239,68,68,0.9)', textDecoration: 'line-through', textDecorationColor: 'rgba(248,113,113,0.6)', background: 'rgba(239,68,68,0.05)', borderRadius: 1.75 };
const INS: CSSProperties = { color: EMERALD_600, textDecoration: 'underline', textDecorationColor: 'rgba(52,211,153,0.6)', textUnderlineOffset: 1.75, background: 'rgba(16,185,129,0.05)', borderRadius: 1.75 };

const PolishPane = ({ tk }: { tk: Tokens }) => (
  <>
    <Sparkle size={14} color={mix(tk.mutedFg, 60)} style={{ ...at(294, 370.5) }} />
    <span style={{ ...at(315, 369.8), fontSize: 11, lineHeight: '15.4px', color: mix(tk.mutedFg, 60) }}>{S.essay.polishDesc}</span>
    <Btn style={{ ...at(750, 364.4), width: 108, height: 26.3, borderRadius: 9, padding: '0 0 0 11.5px', gap: 7, fontSize: 11, fontWeight: 500, color: tk.primary }}>
      <Eye size={12} />
      {S.essay.hideDiff}
    </Btn>
    <div style={{ ...at(290.5, 404.6), width: 571, height: 171.6, boxSizing: 'border-box', borderRadius: 10.5, border: '1px solid rgba(224,224,224,0.4)', background: 'rgba(252,252,252,0.5)', overflow: 'hidden' }}>
      <span style={{ position: 'absolute', left: 14, top: 10.5, fontSize: 11, lineHeight: '15.4px', color: mix(tk.mutedFg, 50) }}>{S.essay.original}</span>
      <div style={{ position: 'absolute', left: 14, top: 29.15, width: 541, fontSize: 12, lineHeight: '19.5px', color: mix(tk.foreground, 70), whiteSpace: 'pre-wrap' }}>
        {POLISH_CARD.original.map(([d, text], i) => (
          <span key={i} style={d ? DEL : undefined}>
            {text}
          </span>
        ))}
      </div>
      <div style={{ position: 'absolute', left: 0, top: 80, width: 569, height: 89.8, borderTop: `1px solid ${LINE_SOFT}`, background: 'rgba(236,253,245,0.3)' }}>
        <ArrowRight size={12} color={EMERALD_600} style={{ position: 'absolute', left: 14, top: 17.6 }} />
        <span style={{ position: 'absolute', left: 31.3, top: 16, fontSize: 11, lineHeight: '15.4px', color: EMERALD_600 }}>{S.essay.polished}</span>
        <Btn style={{ position: 'absolute', left: 491, top: 10.5, width: 64, height: 26.3, padding: '0 0 0 11.5px', gap: 7, fontSize: 11, fontWeight: 500, color: mix(tk.mutedFg, 50) }}>
          <Copy size={12} />
          {S.essay.copy}
        </Btn>
        <div style={{ position: 'absolute', left: 14, top: 40.05, width: 541, fontSize: 12, fontWeight: 500, lineHeight: '19.5px', color: mix(tk.foreground, 85), whiteSpace: 'pre-wrap' }}>
          {POLISH_CARD.polished.map(([d, text], i) => (
            <span key={i} style={d ? INS : undefined}>
              {text}
            </span>
          ))}
        </div>
      </div>
    </div>
  </>
);

// ── 结果区组装 ────────────────────────────────────────
/** 正文全文高度与完成态内容总高（取证 xg：正文 932.2–1314.7，内容含上下内边距到 1384.7）。 */
const BODY_H = 382.5;
const DONE_CONTENT_H = 1384.7 - VIEW_TOP_CHIPS;
const THUMB_MIN = 40;

const Thumb = ({ tk, y, h, k }: { tk: Tokens; y: number; h: number; k: number }) =>
  k > 0 ? <span style={{ ...at(872, y), width: 4, height: h, borderRadius: 999, background: mix(tk.foreground, 26), opacity: k }} /> : null;

/** 流式中按已到的正文 / 评语估算内容高度，滚动条贴底（stick-to-bottom）。 */
const streamThumb = (s: EssayState, viewTop: number, viewH: number) => {
  const tail = DIMS.reduce((h, d) => h + (s.stream > d.start ? 64.5 * clamp((s.stream - d.start) / d.comment.length) : 0), 0);
  const contentH = 87.5 + BODY_H * Math.min(1, s.stream / POLISH_AT) + tail;
  if (contentH <= viewH) return null;
  const h = clamp((viewH * (viewH - 4)) / contentH, THUMB_MIN, viewH - 4);
  return { y: viewTop + viewH - 2 - h, h };
};

const ResultArea = ({ tk, s }: { tk: Tokens; s: EssayState }) => {
  const grading = s.stage === 'grading';
  const done = s.stage === 'done';
  const barTop = done ? 577.8 : 557.1;
  const hasContent = done || s.stream > 0;
  const overview = s.tab === 'overview';
  const counts = countsAt(done ? Infinity : s.stream);
  const chips = overview && (done || s.stream > FIRST_MARK);
  const viewTop = !hasContent ? TABS_TOP : chips ? VIEW_TOP_CHIPS : CHIPS_TOP;
  const viewH = barTop - viewTop;
  return (
    <>
      <ResultHeader tk={tk} s={s} />
      {hasContent ? <TabsRow tk={tk} s={s} /> : null}
      {chips ? <ChipsRow tk={tk} counts={counts} /> : null}
      {grading && !hasContent ? (
        <Btn style={{ ...at(MAIN_X, (TABS_TOP + barTop) / 2 - 9), width: MAIN_W, justifyContent: 'center', gap: 7, fontSize: 12, color: mix(tk.mutedFg, 40) }}>
          <Spin size={14} color={mix(tk.mutedFg, 40)} clock={s.clock} />
          {S.essay.waiting}
        </Btn>
      ) : null}
      {grading && hasContent ? (
        <div style={{ ...at(MAIN_X, viewTop), width: MAIN_W, height: viewH, overflow: 'hidden' }}>
          {/* stick-to-bottom：内容底（含 pb-20）贴住视口底；内容不足一屏时从顶部排 */}
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, minHeight: viewH, boxSizing: 'border-box', padding: '17.5px 17.5px 70px' }}>
            <EssayBody tk={tk} s={s} streaming />
          </div>
        </div>
      ) : null}
      {grading && hasContent
        ? (() => {
            const th = streamThumb(s, viewTop, viewH);
            return th ? <Thumb tk={tk} y={th.y} h={th.h} k={s.thumb} /> : null;
          })()
        : null}
      {done && overview ? (
        <div style={{ ...at(MAIN_X, viewTop), width: MAIN_W, height: viewH, overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: 0, top: -s.scroll, width: MAIN_W }}>
            <ScoreCard tk={tk} since={s.sinceDone} />
            <div style={{ position: 'absolute', left: 17.5, top: 932.2 - VIEW_TOP_CHIPS, width: 571 }}>
              <EssayBody tk={tk} s={s} streaming={false} />
            </div>
          </div>
        </div>
      ) : null}
      {done && overview ? <Thumb tk={tk} y={viewTop + 2 + ((viewH - 4 - THUMB_MIN) * s.scroll) / (DONE_CONTENT_H - viewH)} h={THUMB_MIN} k={s.thumb} /> : null}
      {done && !overview ? (
        <div style={{ position: 'absolute', inset: 0, opacity: ease.wbOut(s.tabEnter) }}>
          <PolishPane tk={tk} />
        </div>
      ) : null}
      {done ? (
        <span style={{ ...at(800.8, 551.9), fontSize: 11, lineHeight: '15.4px', color: mix(tk.mutedFg, 50), opacity: s.resultHover, fontVariantNumeric: 'tabular-nums' }}>
          {RESULT.length} {S.essay.stat.chars}
        </span>
      ) : null}
      {hasContent || grading ? (
        <>
          <span style={{ ...at(MAIN_X, barTop), width: MAIN_W, height: 1, background: LINE }} />
          {[
            [649, 121, Notebook, S.essay.mistakes],
            [777, 88, Cards, S.essay.cards],
          ].map(([x, w, I, label]) => {
            const Icon = I as typeof Notebook;
            return (
              <Btn key={x as number} style={{ ...at(x as number, barTop + 8), width: w as number, height: 26.3, borderRadius: 9, padding: '0 0 0 11.5px', gap: 7, fontSize: 11, fontWeight: 500, color: tk.mutedFg, opacity: grading ? 0.5 : 1 }}>
                <Icon size={14} />
                {label as string}
              </Btn>
            );
          })}
          {grading ? <span style={{ ...at(287, 596.6), width: 578, textAlign: 'right', fontSize: 11, lineHeight: '15.4px', color: tk.mutedFg }}>{S.essay.afterGrading}</span> : null}
        </>
      ) : (
        <>
          <span style={{ ...at(556.8, 410), width: 38.5, height: 38.5, boxSizing: 'border-box', borderRadius: '50%', background: 'rgba(240,240,240,0.2)', border: '1px solid rgba(224,224,224,0.4)' }} />
          <Pen size={18} color={mix(tk.mutedFg, 50)} style={{ ...at(567, 420.2) }} />
          <span style={{ ...at(MAIN_X, 459), width: MAIN_W, textAlign: 'center', fontSize: 12, lineHeight: '16.8px', color: mix(tk.mutedFg, 80) }}>{S.essay.waitTitle}</span>
          <span style={{ ...at(446, 486.3), width: 260, textAlign: 'center', fontSize: 11, lineHeight: '17.9px', color: mix(tk.mutedFg, 50) }}>{S.essay.waitDesc}</span>
        </>
      )}
    </>
  );
};

const DraftPane = ({ tk, s }: { tk: Tokens; s: EssayState }) => {
  const k = ease.outCubic(s.lock);
  return (
    <>
      <TopRows tk={tk} locked={s.stage === 'grading' ? k : 0} />
      <InputArea tk={tk} s={s} k={s.pasted ? k : 0} />
      <LockBanner tk={tk} k={k} phase={phaseOf(s.stream)} clock={s.clock} />
      <ModelRow tk={tk} s={s} k={k} />
      <ResultArea tk={tk} s={s} />
    </>
  );
};

export const EssayView = ({ tk, s }: { tk: Tokens; s: EssayState }) => {
  const home = s.stage === 'home';
  return (
    <div style={{ position: 'absolute', inset: 0, fontFamily: font.sys, background: tk.background, overflow: 'hidden' }}>
      <ResourceSidebar tk={tk} winH={ESSAY_H} icon={PenNib} title={S.essay.title} items={home ? EXISTING : [NEW_NAME, ...EXISTING]} fresh={!home} settings={S.essay.settings} />
      <div style={{ position: 'absolute', inset: 0, opacity: ease.wbOut(s.enter) }}>
        {home ? <ResourceHome tk={tk} icon={PenNib} label={S.essay.newEssay} btn={{ x: 520.5, w: 111 }} hover={s.hover === 'new'} press={s.press} /> : <DraftPane tk={tk} s={s} />}
      </div>
    </div>
  );
};

/** 片中点到的位置（窗口坐标，含 1px 边框与 38px 标题栏）。 */
export const ESSAY_PT = {
  newEssay: RESOURCE_NEW_PT,
  /** 点进输入框（空态说明文字右侧的空白处），随后 ⌘V */
  input: { x: 768, y: 150 },
  grade: { x: 825, y: 246.6 },
  /** 结果区里滚动：流式时停在正文下方的留白（pb-20），滚到顶时落在「分项评分」与雷达之间，不挡字 */
  wheel: { x: 770, y: 538 },
  polish: { x: 504.7, y: 329.5 },
} as const;
/** 流式进度里的关键位置（原始字符数）：各条批注闭合处、润色段开始、评分段开始、全文长度。 */
export const ESSAY_STREAM = { marks: MARKS.map((m) => m.end), polish: POLISH_AT, score: SCORE_AT, total: RESULT.length } as const;
/** 完成后结果区的滚动位置：分数卡插在上方、视口停在正文开头（xf）→ 滚到顶 → 往下露出雷达。 */
export const ESSAY_SCROLL = { done: 563, top: 0, radar: 165 } as const;
