import {
  ArrowUp,
  Brain,
  CaretDown,
  CaretRight,
  Lightning,
  MagnifyingGlass,
  Plus,
  Quotes,
} from '@phosphor-icons/react';
import type { CSSProperties, ReactNode } from 'react';
import { brand, font, type Tokens } from '../theme';
import { SWEEP } from '../lib/motion';
import { S } from '../strings';

export const Shimmer = ({ text, t, tk, style }: { text: string; t: number; tk: Tokens; style?: CSSProperties }) => {
  const phase = ((t % 1.5) / 1.5) * 200;
  return (
    <span
      style={{
        backgroundImage: `linear-gradient(90deg, ${tk.mutedFg} 0%, ${tk.mutedFg} 35%, ${tk.foreground} 50%, ${tk.mutedFg} 65%, ${tk.mutedFg} 100%)`,
        backgroundSize: '200% 100%',
        backgroundPosition: `${100 - phase}% 0`,
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
        ...style,
      }}
    >
      {text}
    </span>
  );
};

/** 工具运行光扫：105°、白 42%，translateX(-130% → 130%)。 */
export const Sweep = ({ k, radius = 6, alpha = SWEEP.whiteAlpha }: { k: number; radius?: number; alpha?: number }) => (
  <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: radius, pointerEvents: 'none' }}>
    <div
      style={{
        position: 'absolute',
        inset: 0,
        transform: `translateX(${-130 + k * 260}%)`,
        background: `linear-gradient(${SWEEP.angleDeg}deg, transparent 30%, rgba(255,255,255,${alpha}) 50%, transparent 70%)`,
      }}
    />
  </div>
);

export const RefChip = ({ label, tk, style }: { label: string; tk: Tokens; style?: CSSProperties }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '4px 12px',
      borderRadius: 999,
      background: tk.dark ? brand.rose900a : brand.rose100,
      color: tk.dark ? brand.rose300 : brand.rose700,
      fontFamily: font.ui,
      fontSize: 12,
      fontWeight: 500,
      lineHeight: '16px',
      whiteSpace: 'nowrap',
      ...style,
    }}
  >
    <Quotes size={12} weight="bold" />
    {label}
  </span>
);

const Thumb = ({ seed }: { seed: number }) => (
  <svg width={20} height={20} viewBox="0 0 20 20" style={{ borderRadius: '50%', display: 'block' }}>
    <rect width={20} height={20} fill="#f4f1e8" />
    {[5, 9, 13].map((y, i) => (
      <path
        key={y}
        d={`M3 ${y} q3 ${-1.5 + ((seed + i) % 3)} 6 0 t6 0`}
        stroke="#3b4a6b"
        strokeWidth={1.1}
        fill="none"
        opacity={0.8}
      />
    ))}
    <circle cx={15} cy={15} r={2.4} fill="none" stroke="#d64545" strokeWidth={1} />
  </svg>
);

export const AttachPill = ({ name, tk, seed = 0 }: { name: string; tk: Tokens; seed?: number }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      height: 32,
      padding: '0 12px 0 6px',
      borderRadius: 999,
      border: `1px solid ${tk.border}`,
      background: tk.background,
      boxShadow: tk.shadowSoft,
      fontFamily: font.ui,
      fontSize: 13,
      fontWeight: 600,
      color: tk.foreground,
      whiteSpace: 'nowrap',
      boxSizing: 'border-box',
    }}
  >
    <span style={{ width: 20, height: 20, borderRadius: '50%', overflow: 'hidden', display: 'inline-block' }}>
      <Thumb seed={seed} />
    </span>
    <span style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
  </span>
);

export const SendButton = ({ tk, active, press = 0 }: { tk: Tokens; active: boolean; press?: number }) => (
  <span
    style={{
      width: 32,
      height: 32,
      borderRadius: '50%',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: active ? (tk.dark ? '#fff' : '#000') : tk.muted,
      color: active ? (tk.dark ? '#000' : '#fff') : tk.mutedFg,
      transform: `scale(${1 - press * 0.12})`,
    }}
  >
    <ArrowUp size={16} weight="bold" />
  </span>
);

const GhostIcon = ({ children, tk }: { children: ReactNode; tk: Tokens }) => (
  <span
    style={{
      height: 32,
      minWidth: 32,
      borderRadius: 10,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      color: tk.mutedFg,
    }}
  >
    {children}
  </span>
);

export const COMPOSER_W = 656;

export const Composer = ({
  tk,
  text,
  caret = false,
  attachments = [],
  refs = [],
  sendPress = 0,
  focused = false,
  chipIn = 1,
}: {
  tk: Tokens;
  text: string;
  caret?: boolean;
  attachments?: string[];
  refs?: string[];
  sendPress?: number;
  focused?: boolean;
  chipIn?: number;
}) => (
  <div
    style={{
      width: COMPOSER_W,
      boxSizing: 'border-box',
      borderRadius: 16,
      border: `1px solid ${tk.border}`,
      background: tk.background,
      boxShadow: focused ? tk.shadowPanel : tk.shadowSoft,
      padding: '12px 12px 12px 16px',
      fontFamily: font.ui,
    }}
  >
    {attachments.length > 0 ? (
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        {attachments.map((a, i) => (
          <AttachPill key={a} name={a} tk={tk} seed={i} />
        ))}
      </div>
    ) : null}
    {refs.length > 0 ? (
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, height: 24 }}>
        {refs.map((r) => (
          <RefChip key={r} label={r} tk={tk} style={{ opacity: chipIn, transform: `scale(${0.9 + 0.1 * chipIn})` }} />
        ))}
      </div>
    ) : null}
    <div style={{ minHeight: 24, fontSize: 16, lineHeight: '24px', color: text ? tk.foreground : tk.mutedFg }}>
      {text || S.placeholder}
      {caret ? (
        <span
          style={{
            display: 'inline-block',
            width: 2,
            height: 20,
            marginLeft: 1,
            verticalAlign: 'text-bottom',
            background: tk.primary,
          }}
        />
      ) : null}
    </div>
    <div style={{ display: 'flex', alignItems: 'center', marginTop: 8, height: 32 }}>
      <GhostIcon tk={tk}>
        <Plus size={18} weight="bold" />
      </GhostIcon>
      <div style={{ flex: 1 }} />
      <GhostIcon tk={tk}>
        <svg width={16} height={16} viewBox="0 0 16 16">
          <circle cx={8} cy={8} r={6} fill="none" stroke={tk.border} strokeWidth={2} />
          <path d="M8 2 A6 6 0 0 1 13.2 5" fill="none" stroke={tk.mutedFg} strokeWidth={2} strokeLinecap="round" />
        </svg>
      </GhostIcon>
      <GhostIcon tk={tk}>
        <Lightning size={15} />
        <CaretDown size={13} />
      </GhostIcon>
      <span style={{ width: 6 }} />
      <SendButton tk={tk} active={text.length > 0} press={sendPress} />
    </div>
  </div>
);

export const UserMessage = ({
  tk,
  text,
  attachments = [],
  refs = [],
}: {
  tk: Tokens;
  text: string;
  attachments?: string[];
  refs?: string[];
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, fontFamily: font.ui }}>
    {attachments.length + refs.length > 0 ? (
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        {attachments.map((a, i) => (
          <AttachPill key={a} name={a} tk={tk} seed={i} />
        ))}
        {refs.map((r) => (
          <RefChip key={r} label={r} tk={tk} style={{ alignSelf: 'center' }} />
        ))}
      </div>
    ) : null}
    <div
      style={{
        maxWidth: '85%',
        background: tk.dark ? 'hsl(0 0% 14% / 0.6)' : tk.muted,
        boxShadow: tk.dark ? `inset 0 0 0 1px ${tk.border}` : undefined,
        borderRadius: 12,
        padding: '12px 16px',
        fontSize: 16,
        lineHeight: '24px',
        color: tk.foreground,
      }}
    >
      {text}
    </div>
  </div>
);

export const TimelineRow = ({
  tk,
  kind,
  label,
  status,
  shimmer = false,
  t,
  sweepK,
  rail = true,
}: {
  tk: Tokens;
  kind: 'thinking' | 'search';
  label: string;
  status?: string;
  shimmer?: boolean;
  t: number;
  sweepK?: number;
  rail?: boolean;
}) => (
  <div style={{ position: 'relative', height: 28, display: 'flex', alignItems: 'center', gap: 8, fontFamily: font.ui, fontSize: 14 }}>
    {rail ? (
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: kind === 'thinking' ? tk.primary : tk.border,
          marginRight: 4,
          flexShrink: 0,
        }}
      />
    ) : null}
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '0 6px', height: 28 }}>
      {kind === 'thinking' ? (
        <Brain size={15} weight={shimmer ? 'fill' : 'regular'} color={tk.primary} />
      ) : (
        <MagnifyingGlass size={15} color={tk.mutedFg} />
      )}
      {shimmer ? (
        <Shimmer text={label} t={t} tk={tk} />
      ) : (
        <span style={{ color: kind === 'thinking' ? tk.mutedFg : tk.foreground }}>{label}</span>
      )}
      {status ? <span style={{ color: tk.mutedFg, fontSize: 13 }}>{status}</span> : null}
      <CaretRight size={12} color={tk.mutedFg} />
      {sweepK !== undefined ? <Sweep k={sweepK} radius={6} /> : null}
    </span>
  </div>
);

export const CitationBadge = ({ n, tk, glow = 0 }: { n: number; tk: Tokens; glow?: number }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: 20,
      minWidth: 20,
      padding: '0 4px',
      margin: '0 2px',
      borderRadius: 4,
      verticalAlign: 'text-bottom',
      background: `color-mix(in hsl, ${tk.primary} ${10 + glow * 20}%, transparent)`,
      color: tk.primary,
      fontFamily: font.ui,
      fontSize: 12,
      fontWeight: 500,
      lineHeight: '20px',
      boxShadow: glow > 0 ? `0 0 ${16 * glow}px ${tk.primary}` : undefined,
    }}
  >
    [{n}]
  </span>
);

export const PdfBadge = ({ page, tk, press = 0 }: { page: number; tk: Tokens; press?: number }) => {
  const c = tk.dark ? 'hsl(215 80% 72%)' : 'hsl(215 80% 50%)';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        padding: '1.6px 7.2px',
        margin: '0 2px',
        borderRadius: 6,
        verticalAlign: 'text-bottom',
        fontFamily: font.ui,
        fontSize: 11.2,
        lineHeight: '16px',
        color: c,
        background: `hsl(210 85% 55% / ${0.1 + press * 0.12})`,
        border: `1px solid ${c.replace(')', ' / 0.2)')}`,
        transform: `scale(${1 - press * 0.06})`,
      }}
    >
      <svg width={12} height={12} viewBox="0 0 12 12" fill="none">
        <path d="M3 1.5h4l2.5 2.5v6.5H3z" stroke={c} strokeWidth={1} />
        <path d="M7 1.5V4h2.5" stroke={c} strokeWidth={1} />
      </svg>
      第{page}页
    </span>
  );
};
