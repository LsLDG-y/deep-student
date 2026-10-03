import type { CSSProperties } from 'react';
import { brand, font } from '../theme';
import { clamp, ease, prog } from '../lib/time';

/**
 * 字幕层。排版直接落在画面上：不用毛玻璃胶囊、不用模糊渐显；
 * 可读性靠一片与底色同色、边缘完全化开的柔光底（scrim），而不是一个框。
 */
type Kind = 'title' | 'chapter' | 'feature' | 'subtitle';
type Tone = 'light' | 'dark';

export type Super = {
  s: number;
  e: number;
  text: string;
  kind: Kind;
  tone?: Tone;
  pos?: CSSProperties;
  align?: 'left' | 'center';
  /** 居中标题默认带顶部柔光底；落在壁纸 / 空白处的幕标题不需要 */
  scrim?: boolean;
};

export const SUPERS: Super[] = [
  { s: 0.45, e: 2.15, text: '一份资料，\n能走多深？', kind: 'title', pos: { left: 150, top: 380 } },
  { s: 2.5, e: 3.4, text: '01 读懂', kind: 'chapter' },
  { s: 3.55, e: 5.4, text: '划一下，就是上下文', kind: 'feature' },
  { s: 5.5, e: 6.4, text: '02 看清', kind: 'chapter' },
  { s: 7.18, e: 7.98, text: '提问即向量，从全部资料里找出处', kind: 'feature' },
  { s: 9.1, e: 10.9, text: '每条引用，都回得到原文', kind: 'feature' },
  { s: 11.0, e: 11.9, text: '03 整理', kind: 'chapter' },
  { s: 12.3, e: 13.95, text: '一句话长出导图，结构随手切', kind: 'feature' },
  { s: 14.08, e: 14.95, text: '一键挖空，导图就是背诵卡', kind: 'feature' },
  { s: 15.0, e: 15.9, text: '04 练习', kind: 'chapter' },
  { s: 15.56, e: 16.34, text: '卡片自动生成', kind: 'feature' },
  { s: 17.02, e: 18.32, text: 'FSRS 帮你排好每一次复习', kind: 'feature', tone: 'dark' },
  { s: 19.0, e: 19.9, text: '05 记住', kind: 'chapter', tone: 'dark', scrim: false },
  { s: 20.0, e: 22.3, text: '越薄弱的，越早再见', kind: 'feature', tone: 'dark' },
  // 第二幕：第二天，白天的学习桌面
  { s: 24.05, e: 25.75, text: '不止一份资料。', kind: 'title', pos: { left: 0, right: 0, top: 380 }, align: 'center', scrim: false },
  { s: 25.6, e: 27.3, text: '今天要复习的、要做的，一屏看清', kind: 'feature' },
  { s: 27.5, e: 28.9, text: '开一个番茄钟，进入专注', kind: 'feature' },
  // 章节标签压在题目集 / 作文窗口左上角：不铺柔光底，免得把窗口角和红绿灯洗白
  { s: 30.0, e: 30.9, text: '06 检验', kind: 'chapter', scrim: false },
  { s: 30.95, e: 33.05, text: '试卷拖进来，题目集就有了', kind: 'feature' },
  // 答错时后端自动建复习计划、下次复习日 = 今天（题目进复习，不是「知识点」）
  { s: 34.5, e: 35.95, text: '答错的题，自动排进今日复习', kind: 'feature' },
  { s: 36.05, e: 37.85, text: 'AI 讲清楚错在哪', kind: 'feature' },
  { s: 38.0, e: 38.9, text: '07 写作与精读', kind: 'chapter', scrim: false },
  { s: 39.15, e: 41.1, text: '作文按考试标准逐项打分', kind: 'feature' },
  { s: 41.3, e: 42.65, text: '逐句润色，改在哪一看就懂', kind: 'feature' },
  { s: 43.75, e: 45.4, text: '整篇翻译，逐段对照精读', kind: 'feature' },
  { s: 46.0, e: 46.9, text: '08 调研', kind: 'chapter' },
  { s: 47.0, e: 49.5, text: '一句话，交给它去查、去读、去写', kind: 'feature' },
  { s: 50.1, e: 52.2, text: '论文搜到、下好、读进资料库', kind: 'feature' },
  { s: 52.35, e: 53.85, text: '导入即索引，下次提问就能引用', kind: 'feature' },
  // 第三幕：越用越懂你
  { s: 54.15, e: 55.55, text: '越用，越懂你。', kind: 'title', pos: { left: 0, right: 0, top: 380 }, align: 'center', scrim: false },
  { s: 55.6, e: 56.45, text: '09 懂你', kind: 'chapter' },
  { s: 56.5, e: 57.9, text: '记住你的薄弱点和习惯', kind: 'feature' },
  // 与同一时刻画面里技能窗的「全部 55 · 内置 55」对得上
  { s: 58.0, e: 59.2, text: '50+ 技能，按需加载', kind: 'feature' },
  { s: 59.3, e: 60.3, text: '接入 MCP，连上外部工具', kind: 'feature' },
  { s: 60.4, e: 61.5, text: '同一个问题，几个模型一起答', kind: 'feature' },
  // 收尾
  { s: 62.3, e: 69.55, text: '从一页纸，到一整座知识库。', kind: 'title', pos: { left: 0, right: 0, top: 112 }, align: 'center' },
  { s: 65.6, e: 69.55, text: '内置 50+ 技能，支持 MCP，预置 12 家模型供应商；本地优先，开源。', kind: 'subtitle' },
];

/** 逐字从一道看不见的基线下升起（遮罩揭示），收尾时整行轻轻下沉淡出。 */
const MaskIn = ({ text, t, s, e, stagger, dur = 0.42 }: { text: string; t: number; s: number; e: number; stagger: number; dur?: number }) => {
  const out = prog(t, e - 0.26, e, ease.inCubic);
  let n = 0;
  return (
    <>
      {text.split('\n').map((line, li) => (
        <span key={li} style={{ display: 'block', overflow: 'hidden', paddingBottom: '0.1em', marginBottom: '-0.1em' }}>
          {[...line].map((ch, i) => {
            const at = s + n++ * stagger;
            const k = prog(t, at, at + dur, ease.outExpo);
            return (
              <span
                key={i}
                style={{
                  display: 'inline-block',
                  whiteSpace: 'pre',
                  transform: `translateY(${(1 - k) * 112 + out * 16}%)`,
                  opacity: clamp(k * 3) * (1 - out),
                }}
              >
                {ch}
              </span>
            );
          })}
        </span>
      ))}
    </>
  );
};

const Scrim = ({
  at,
  w,
  h,
  color,
  edge,
  opacity,
  solid = 0.3,
}: {
  at: 'tl' | 'bl' | 'top';
  w: number;
  h: number;
  color: string;
  edge: string;
  opacity: number;
  /** 从角上算起，完全不透的那一段占半径的比例 */
  solid?: number;
}) => {
  if (opacity <= 0.001) return null;
  const style: CSSProperties =
    at === 'top'
      ? { left: 0, right: 0, top: 0, height: h, background: `linear-gradient(180deg, ${color} 0%, ${edge} 52%, transparent 100%)` }
      : {
          left: 0,
          [at === 'tl' ? 'top' : 'bottom']: 0,
          width: w,
          height: h,
          background: `radial-gradient(ellipse 100% 100% at 0% ${at === 'tl' ? '0%' : '100%'}, ${color} 0%, ${color} ${solid * 100}%, ${edge} ${(solid + 0.32) * 100}%, transparent 100%)`,
        };
  return <div style={{ position: 'absolute', opacity, ...style }} />;
};

const SuperView = ({ sp, t }: { sp: Super; t: number }) => {
  const dark = sp.tone === 'dark';
  const ink = dark ? 'hsl(0 0% 97%)' : brand.ink;
  const ground = dark ? 'hsl(220 12% 7% / 0.86)' : 'hsl(0 0% 97% / 0.94)';
  const groundEdge = dark ? 'hsl(220 12% 7% / 0.5)' : 'hsl(0 0% 97% / 0.62)';
  if (sp.kind === 'title') {
    const centered = sp.align === 'center';
    const k = prog(t, sp.s - 0.1, sp.s + 0.4, ease.brand) * (1 - prog(t, sp.e - 0.26, sp.e, ease.inCubic));
    return (
      <>
        {centered && sp.scrim !== false ? <Scrim at="top" w={0} h={400} color={ground} edge={groundEdge} opacity={k} /> : null}
        <div
          style={{
            position: 'absolute',
            ...sp.pos,
            textAlign: sp.align ?? 'left',
            fontFamily: font.serif,
            fontSize: 72,
            lineHeight: 1.35,
            fontWeight: 500,
            letterSpacing: '0.04em',
            color: ink,
          }}
        >
          <MaskIn text={sp.text} t={t} s={sp.s} e={sp.e} stagger={0.035} dur={0.5} />
        </div>
      </>
    );
  }
  if (sp.kind === 'subtitle') {
    const k = prog(t, sp.s, sp.s + 0.5, ease.brand);
    const out = prog(t, sp.e - 0.26, sp.e, ease.inCubic);
    return (
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 224,
          textAlign: 'center',
          fontFamily: font.ui,
          fontSize: 27,
          fontWeight: 400,
          letterSpacing: '0.06em',
          color: brand.ink2,
          opacity: k * (1 - out),
          transform: `translateY(${(1 - k) * 10}px)`,
        }}
      >
        {sp.text}
      </div>
    );
  }
  if (sp.kind === 'chapter') {
    const k = prog(t, sp.s, sp.s + 0.36, ease.outExpo);
    const out = prog(t, sp.e - 0.25, sp.e, ease.inCubic);
    const [num, ...rest] = sp.text.split(' ');
    const rule = prog(t, sp.s + 0.04, sp.s + 0.4, ease.outExpo);
    return (
      <>
        {sp.scrim === false ? null : <Scrim at="tl" w={760} h={260} color={dark ? ground : 'hsl(0 0% 97% / 0.98)'} edge={groundEdge} solid={0.52} opacity={prog(t, sp.s - 0.05, sp.s + 0.25) * (1 - out)} />}
        <div
          style={{
            position: 'absolute',
            left: 96,
            top: 70,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            fontFamily: font.ui,
            color: ink,
            opacity: 1 - out,
          }}
        >
          <span style={{ fontFamily: font.mono, fontSize: 19, fontWeight: 500, letterSpacing: '0.04em', color: dark ? 'hsl(0 0% 70%)' : brand.ink3, opacity: k, fontVariantNumeric: 'tabular-nums' }}>
            {num}
          </span>
          <span style={{ width: 36 * rule, height: 1.5, background: dark ? 'hsl(0 0% 100% / 0.5)' : 'hsl(220 12% 16% / 0.4)' }} />
          <span style={{ display: 'block', overflow: 'hidden', fontSize: 30, fontWeight: 600, letterSpacing: '0.14em', paddingBottom: '0.1em', marginBottom: '-0.1em' }}>
            <span style={{ display: 'inline-block', transform: `translateY(${(1 - k) * 112}%)` }}>{rest.join(' ')}</span>
          </span>
        </div>
      </>
    );
  }
  const k = prog(t, sp.s - 0.05, sp.s + 0.3, ease.brand);
  const out = prog(t, sp.e - 0.3, sp.e, ease.inCubic);
  return (
    <>
      <Scrim at="bl" w={Math.max(1000, sp.text.length * 50 + 560)} h={330} color={ground} edge={groundEdge} opacity={k * (1 - out)} />
      <div
        style={{
          position: 'absolute',
          left: 96,
          bottom: 92,
          fontFamily: font.ui,
          fontSize: 44,
          fontWeight: 600,
          letterSpacing: '0.04em',
          color: ink,
        }}
      >
        <MaskIn text={sp.text} t={t} s={sp.s + 0.03} e={sp.e} stagger={0.022} />
      </div>
    </>
  );
};

export const Supers = ({ t }: { t: number }) => (
  <>
    {SUPERS.filter((sp) => t >= sp.s - 0.12 && t <= sp.e + 0.05).map((sp) => (
      <SuperView key={sp.text} sp={sp} t={t} />
    ))}
  </>
);
