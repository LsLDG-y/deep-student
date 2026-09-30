import type { CSSProperties } from 'react';
import { brand, font } from '../theme';
import { clamp, ease, prog } from '../lib/time';

type Kind = 'title' | 'chapter' | 'feature' | 'ticker';
type Tone = 'light' | 'dark';

export type Super = {
  s: number;
  e: number;
  text: string;
  kind: Kind;
  tone?: Tone;
  pos?: CSSProperties;
  align?: 'left' | 'center';
};

export const SUPERS: Super[] = [
  { s: 0.45, e: 2.15, text: '一份资料，\n能走多深？', kind: 'title', pos: { left: 150, top: 380 } },
  { s: 2.5, e: 3.4, text: '01 读懂', kind: 'chapter' },
  { s: 3.55, e: 5.4, text: '划一下，就是上下文', kind: 'feature' },
  { s: 5.5, e: 6.4, text: '02 看清', kind: 'chapter' },
  { s: 8.1, e: 9.9, text: '每条引用，都回得到原文', kind: 'feature' },
  { s: 10.0, e: 10.9, text: '03 整理', kind: 'chapter' },
  { s: 11.2, e: 13.6, text: '一句话长出导图，结构随手切', kind: 'feature' },
  { s: 14.0, e: 14.9, text: '04 练习', kind: 'chapter', tone: 'dark' },
  { s: 15.6, e: 17.9, text: '卡片自动生成，FSRS 帮你排复习', kind: 'feature', tone: 'dark' },
  { s: 18.0, e: 18.9, text: '05 记住', kind: 'chapter', tone: 'dark' },
  { s: 19.2, e: 21.2, text: '越薄弱的，越早再见', kind: 'feature', tone: 'dark' },
  { s: 22.15, e: 24.0, text: '从一页纸，到一整座知识库。', kind: 'title', pos: { left: 0, right: 0, top: 150 }, align: 'center' },
  { s: 24.1, e: 26.0, text: '40+ 技能 · MCP · 12 家模型 · 本地优先 · 开源', kind: 'ticker' },
];

const CharsIn = ({
  text,
  t,
  s,
  e,
  stagger,
  blur,
  rise,
}: {
  text: string;
  t: number;
  s: number;
  e: number;
  stagger: number;
  blur: number;
  rise: number;
}) => {
  const chars = [...text];
  const out = prog(t, e - 0.28, e, ease.inCubic);
  return (
    <>
      {chars.map((ch, i) => {
        if (ch === '\n') return <br key={i} />;
        const k = prog(t, s + i * stagger, s + i * stagger + 0.42, ease.brand);
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              whiteSpace: 'pre',
              opacity: k * (1 - out),
              filter: `blur(${(1 - k) * blur + out * blur * 0.6}px)`,
              transform: `translateY(${(1 - k) * rise - out * rise * 0.5}px)`,
            }}
          >
            {ch}
          </span>
        );
      })}
    </>
  );
};

const SuperView = ({ sp, t }: { sp: Super; t: number }) => {
  const dark = sp.tone === 'dark';
  const ink = dark ? 'hsl(0 0% 96%)' : brand.ink;
  if (sp.kind === 'title') {
    const tracking = 0.12 - 0.1 * prog(t, sp.s, sp.s + 0.9, ease.brand);
    return (
      <div
        style={{
          position: 'absolute',
          ...sp.pos,
          textAlign: sp.align ?? 'left',
          fontFamily: font.serif,
          fontSize: 72,
          lineHeight: 1.35,
          fontWeight: 500,
          color: ink,
          letterSpacing: `${tracking}em`,
          textShadow: dark ? undefined : '0 0 30px rgba(247,247,247,0.9)',
        }}
      >
        <CharsIn text={sp.text} t={t} s={sp.s} e={sp.e} stagger={0.04} blur={10} rise={6} />
      </div>
    );
  }
  if (sp.kind === 'chapter') {
    const k = prog(t, sp.s, sp.s + 0.3, ease.brand);
    const out = prog(t, sp.e - 0.25, sp.e, ease.inCubic);
    const [num, ...rest] = sp.text.split(' ');
    return (
      <div
        style={{
          position: 'absolute',
          left: 96,
          top: 76,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '10px 18px 10px 14px',
          borderRadius: 14,
          background: dark ? 'hsl(0 0% 12% / 0.55)' : 'hsl(0 0% 100% / 0.6)',
          backdropFilter: 'blur(18px) saturate(1.25)',
          boxShadow: dark ? 'inset 0 1px 0 hsl(0 0% 100% / 0.08)' : 'inset 0 1px 0 hsl(0 0% 100% / 0.6), 0 14px 34px -24px hsl(220 15% 10% / 0.42)',
          border: dark ? '1px solid hsl(0 0% 100% / 0.1)' : '1px solid hsl(220 12% 16% / 0.1)',
          fontFamily: font.ui,
          fontSize: 26,
          fontWeight: 600,
          letterSpacing: '0.12em',
          color: ink,
          opacity: k * (1 - out),
          transform: `translateX(${(1 - k) * -12}px)`,
        }}
      >
        <span style={{ width: 10, height: 10, background: dark ? brand.nightBlue : brand.accent }} />
        <span style={{ fontVariantNumeric: 'tabular-nums', color: dark ? brand.nightBlue : brand.accent }}>{num}</span>
        <span>{rest.join(' ')}</span>
      </div>
    );
  }
  if (sp.kind === 'feature') {
    const k = prog(t, sp.s, sp.s + 0.35, ease.brand);
    const out = prog(t, sp.e - 0.3, sp.e, ease.inCubic);
    return (
      <div
        style={{
          position: 'absolute',
          left: 96,
          bottom: 86,
          padding: '16px 28px',
          borderRadius: 22,
          background: dark ? 'hsl(0 0% 10% / 0.55)' : 'hsl(0 0% 100% / 0.62)',
          backdropFilter: 'blur(22px) saturate(1.3)',
          border: dark ? '1px solid hsl(0 0% 100% / 0.1)' : '1px solid hsl(220 12% 16% / 0.08)',
          boxShadow: dark ? '0 24px 60px -30px #000' : '0 24px 60px -30px hsl(220 15% 10% / 0.35), inset 0 1px 0 hsl(0 0% 100% / 0.7)',
          fontFamily: font.ui,
          fontSize: 40,
          fontWeight: 500,
          letterSpacing: '0.02em',
          color: ink,
          opacity: clamp(k * 1.4) * (1 - out),
          transform: `translateY(${(1 - k) * 14}px)`,
        }}
      >
        <CharsIn text={sp.text} t={t} s={sp.s + 0.05} e={sp.e} stagger={0.025} blur={6} rise={4} />
      </div>
    );
  }
  const k = prog(t, sp.s, sp.s + 0.5, ease.brand);
  const out = prog(t, sp.e - 0.3, sp.e, ease.inCubic);
  const items = sp.text.split(' · ');
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 236,
        display: 'flex',
        justifyContent: 'center',
        gap: 18,
        fontFamily: font.ui,
        fontSize: 26,
        fontWeight: 500,
        color: brand.ink,
        opacity: 1 - out,
      }}
    >
      {items.map((it, i) => {
        const ki = prog(t, sp.s + i * 0.125, sp.s + i * 0.125 + 0.3, ease.brand);
        return (
          <span key={it} style={{ display: 'inline-flex', alignItems: 'center', gap: 18, opacity: ki * k, transform: `translateY(${(1 - ki) * 10}px)` }}>
            {i > 0 ? <span style={{ width: 5, height: 5, borderRadius: '50%', background: brand.accent }} /> : null}
            {it}
          </span>
        );
      })}
    </div>
  );
};

export const Supers = ({ t }: { t: number }) => (
  <>
    {SUPERS.filter((sp) => t >= sp.s - 0.05 && t <= sp.e + 0.05).map((sp) => (
      <SuperView key={sp.text} sp={sp} t={t} />
    ))}
  </>
);
