import { ArrowsClockwise, CaretLeft, CaretRight, Cards, CircleNotch, FloppyDisk, Pause, Pencil, Stack } from '@phosphor-icons/react';
import type { CSSProperties, ReactNode } from 'react';
import { DUR } from '../lib/motion';
import { ease, prog } from '../lib/time';
import { ANKI_CARDS, PR } from '../scenes/practice/beats';
import { S } from '../strings';
import { font, type Tokens } from '../theme';
import { Shimmer } from './chat';

/**
 * 对话里的 Anki 卡片块（折叠态 = AnkiCardStackPreview → Card3DPreview 紧凑版）。
 * 叠放几何来自 Card3DPreview.getCardTransform：横移 70%、translateZ −80、rotateY −5°、scale −0.08 / 张。
 */
export const ANKI_BLOCK = { w: 656, cardW: 300, cardH: 176, cardTop: 52, navTop: 244, footTop: 304, actTop: 340, h: 380 } as const;

/** 操作行（ghost 油漆，40px 高，12px 字），固定宽度便于瞳点落位。 */
const ACTIONS = [
  { id: 'edit', x: 0, w: 74 },
  { id: 'saved', x: 82, w: 122 },
  { id: 'review', x: 212, w: 100 },
  { id: 'deck', x: 320, w: 140 },
] as const;
export const ankiActionCenter = (id: (typeof ACTIONS)[number]['id']) => {
  const a = ACTIONS.find((x) => x.id === id)!;
  return { x: a.x + a.w / 2, y: ANKI_BLOCK.actTop + 20 };
};

const Ghost = ({
  tk,
  w,
  x,
  hover = 0,
  press = 0,
  children,
  muted = true,
}: {
  tk: Tokens;
  w: number;
  x: number;
  hover?: number;
  press?: number;
  children: ReactNode;
  muted?: boolean;
}) => (
  <span
    style={{
      position: 'absolute',
      left: x,
      top: 0,
      width: w,
      height: 40,
      borderRadius: 9,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      fontSize: 12,
      fontWeight: 500,
      whiteSpace: 'nowrap',
      color: hover > 0.5 || press > 0 ? tk.foreground : muted ? tk.mutedFg : tk.foreground,
      background: press > 0 ? `color-mix(in hsl, ${tk.foreground} ${6 + press * 8}%, transparent)` : hover > 0 ? `color-mix(in hsl, ${tk.foreground} ${hover * 6}%, transparent)` : 'transparent',
      transform: `scale(${1 - press * 0.04})`,
    }}
  >
    {children}
  </span>
);

const RoundBtn = ({ tk, size, children, style }: { tk: Tokens; size: number; children: ReactNode; style?: CSSProperties }) => (
  <span
    style={{
      width: size,
      height: size,
      borderRadius: '50%',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: tk.foreground,
      ...style,
    }}
  >
    {children}
  </span>
);

export const AnkiCardFace = ({ tk, text, style }: { tk: Tokens; text: string; style?: CSSProperties }) => (
  <div
    style={{
      position: 'relative',
      width: ANKI_BLOCK.cardW,
      height: ANKI_BLOCK.cardH,
      boxSizing: 'border-box',
      borderRadius: 16,
      background: tk.dark ? 'hsl(0 0% 14%)' : '#fff',
      border: `1px solid ${tk.border}`,
      boxShadow: '0 1px 2px hsl(220 20% 10% / 0.05), 0 14px 30px -18px hsl(220 25% 12% / 0.32)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '22px 26px',
      textAlign: 'center',
      fontFamily: font.ui,
      ...style,
    }}
  >
    <span style={{ position: 'absolute', left: 16, top: 12, fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', color: tk.mutedFg }}>正面</span>
    <span style={{ fontSize: 17, lineHeight: '27px', fontWeight: 500, color: tk.foreground }}>{text}</span>
  </div>
);

export const AnkiStackBlock = ({ tk, t, reviewHover = 0, reviewPress = 0 }: { tk: Tokens; t: number; reviewHover?: number; reviewPress?: number }) => {
  const appear = prog(t, PR.block, PR.block + 0.16, ease.brand);
  if (appear <= 0) return null;
  const n = ANKI_CARDS.length;
  const arrive = (i: number) => PR.cards0 + i * PR.cardGap;
  const count = ANKI_CARDS.filter((_, i) => t >= arrive(i)).length;
  const doneK = prog(t, PR.done, PR.done + 0.18, ease.brand);
  const cur = prog(t, PR.advance, PR.advance + 0.34, ease.inOutCubic);
  const shown = Math.max(1, count);
  const active = Math.round(cur);
  const { cardW, cardH } = ANKI_BLOCK;
  const trackW = ANKI_BLOCK.w - 48;

  return (
    <div
      style={{
        position: 'relative',
        width: ANKI_BLOCK.w,
        height: ANKI_BLOCK.h,
        fontFamily: font.ui,
        opacity: appear,
        transform: `translateY(${(1 - appear) * 6}px)`,
      }}
    >
      {/* 生成中状态行 → 完成后淡出 */}
      <div style={{ position: 'absolute', left: 4, top: 8, height: 24, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, opacity: 1 - doneK }}>
        <CircleNotch size={14} color={tk.mutedFg} style={{ transform: `rotate(${t * 720}deg)` }} />
        <Shimmer text={`${S.anki.generating}`} t={t} tk={tk} />
        <span style={{ color: tk.mutedFg, fontVariantNumeric: 'tabular-nums' }}>
          {count} / {n}
        </span>
      </div>

      {/* 右上控件：自动播放 / 翻面 / 计数 */}
      <div style={{ position: 'absolute', right: 12, top: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
        {[Pause, ArrowsClockwise].map((I, i) => (
          <RoundBtn key={i} tk={tk} size={40} style={{ background: `color-mix(in hsl, ${tk.muted} 60%, transparent)`, border: `1px solid color-mix(in hsl, ${tk.border} 30%, transparent)` }}>
            <I size={16} weight={i === 0 ? 'fill' : 'regular'} />
          </RoundBtn>
        ))}
        <span
          style={{
            padding: '4px 10px',
            borderRadius: 12,
            fontSize: 12,
            fontWeight: 500,
            color: tk.mutedFg,
            background: `color-mix(in hsl, ${tk.muted} 60%, transparent)`,
            border: `1px solid color-mix(in hsl, ${tk.border} 30%, transparent)`,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {active + 1} / {shown}
        </span>
      </div>

      {/* 3D 叠放 */}
      <div style={{ position: 'absolute', left: 24, top: ANKI_BLOCK.cardTop, width: trackW, height: cardH, perspective: 1200 }}>
        <div style={{ position: 'absolute', inset: 0, transformStyle: 'preserve-3d' }}>
          {ANKI_CARDS.map((c, i) => {
            const k = prog(t, arrive(i), arrive(i) + DUR.cardEnter, ease.wbOut);
            const diff = i - cur;
            const abs = Math.abs(diff);
            if (k <= 0 || abs > 4.5) return null;
            const fade = Math.min(1, 4.5 - abs);
            return (
              <div
                key={c.front}
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: 0,
                  width: cardW,
                  zIndex: Math.round(100 + n - abs * 4),
                  opacity: k * fade,
                  transform: `translate(calc(-50% + ${diff * 70}%), ${(1 - k) * -16}px) translateZ(${-abs * 80}px) rotateY(${diff * -5}deg) scale(${1 - abs * 0.08})`,
                }}
              >
                <AnkiCardFace tk={tk} text={c.front} />
                <div
                  style={{
                    position: 'absolute',
                    left: '10%',
                    width: '80%',
                    bottom: -30,
                    height: 20,
                    background: 'radial-gradient(ellipse at center, hsl(220 30% 10% / 0.2) 0%, transparent 70%)',
                    opacity: abs < 0.5 ? 0.8 : 0.5,
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* 导航：上一张 / 圆点 / 下一张 */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: ANKI_BLOCK.navTop, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
        <RoundBtn tk={tk} size={48} style={{ background: `color-mix(in hsl, ${tk.background} 90%, transparent)`, boxShadow: '0 2px 8px hsl(220 20% 10% / 0.1)' }}>
          <CaretLeft size={18} />
        </RoundBtn>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {Array.from({ length: shown }, (_, i) => {
            const on = Math.max(0, 1 - Math.abs(i - cur));
            return (
              <span
                key={i}
                style={{
                  width: 8 + 16 * on,
                  height: 8,
                  borderRadius: on > 0.5 ? 4 : 999,
                  background: on > 0.01 ? `color-mix(in hsl, ${tk.foreground} ${on * 100}%, color-mix(in hsl, ${tk.mutedFg} 30%, transparent))` : `color-mix(in hsl, ${tk.mutedFg} 30%, transparent)`,
                }}
              />
            );
          })}
        </div>
        <RoundBtn tk={tk} size={48} style={{ background: `color-mix(in hsl, ${tk.background} 90%, transparent)`, boxShadow: '0 2px 8px hsl(220 20% 10% / 0.1)' }}>
          <CaretRight size={18} />
        </RoundBtn>
      </div>

      {/* 底栏：总数 + 编辑入口 */}
      <div
        style={{
          position: 'absolute',
          left: 4,
          right: 4,
          top: ANKI_BLOCK.footTop,
          height: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 12,
          color: tk.mutedFg,
          opacity: doneK,
        }}
      >
        <span>
          {S.anki.total(n)}
          <span style={{ marginLeft: 8, color: tk.success }}>{S.anki.saved}</span>
        </span>
        <span>{S.anki.clickToEdit} →</span>
      </div>

      {/* 操作行 */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: ANKI_BLOCK.actTop, height: 40, opacity: doneK, transform: `translateY(${(1 - doneK) * 6}px)` }}>
        <Ghost tk={tk} x={ACTIONS[0].x} w={ACTIONS[0].w}>
          <Pencil size={14} />
          {S.anki.edit}
        </Ghost>
        <Ghost tk={tk} x={ACTIONS[1].x} w={ACTIONS[1].w}>
          <FloppyDisk size={14} color={tk.success} />
          {S.anki.added}
        </Ghost>
        <Ghost tk={tk} x={ACTIONS[2].x} w={ACTIONS[2].w} hover={reviewHover} press={reviewPress}>
          <Stack size={16} />
          {S.anki.review}
        </Ghost>
        <Ghost tk={tk} x={ACTIONS[3].x} w={ACTIONS[3].w}>
          <Cards size={14} />
          高数 · 中值定理
        </Ghost>
      </div>
    </div>
  );
};
