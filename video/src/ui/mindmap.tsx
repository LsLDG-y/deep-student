import {
  ArrowClockwise,
  ArrowCounterClockwise,
  ArrowsOut,
  BookOpen,
  Crosshair,
  DotsThree,
  Eye,
  EyeSlash,
  FileText,
  Fire,
  Gear,
  GitBranch,
  GitFork,
  MagnifyingGlass,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
  SquaresFour,
  Users,
  X,
} from '@phosphor-icons/react';
import type { CSSProperties, ReactNode } from 'react';
import { brand, font, type Tokens } from '../theme';
import { lerp } from '../lib/time';
import { S } from '../strings';
import { Tex } from './tex';

/** src/features/mindmap/styles/themes/palettes.ts */
const LIGHT_PALETTE = ['#E05252', '#E69038', '#EBCB4B', '#5BB98C', '#2EAADC', '#6C63FF', '#F2668B'];
const DARK_PALETTE = ['#FF6B6B', '#FFA94D', '#FFD43B', '#51CF66', '#4DABF7', '#9775FA', '#F783AC'];

export type MMNode = {
  id: string;
  parent?: string;
  depth: 0 | 1 | 2;
  text: string;
  branch?: number;
  tex?: string;
  blank?: [string, string, string];
};

export const MM_NODES: MMNode[] = [
  { id: 'root', depth: 0, text: '微分中值定理' },
  { id: 'rolle', parent: 'root', depth: 1, text: '罗尔定理', branch: 0 },
  { id: 'lag', parent: 'root', depth: 1, text: '拉格朗日中值定理', branch: 4 },
  { id: 'cauchy', parent: 'root', depth: 1, text: '柯西中值定理', branch: 5 },
  { id: 'taylor', parent: 'root', depth: 1, text: '泰勒公式', branch: 3 },
  { id: 'rolle1', parent: 'rolle', depth: 2, text: '端点值相等 ⇒ f′(ξ) = 0', blank: ['端点值相等 ⇒ ', 'f′(ξ) = 0', ''] },
  { id: 'lag1', parent: 'lag', depth: 2, text: 'f(b) − f(a) = f′(ξ)(b − a)', tex: "f(b)-f(a)=f'(\\xi)(b-a)" },
  { id: 'lag2', parent: 'lag', depth: 2, text: '关键：构造辅助函数 φ(x)', blank: ['关键：构造', '辅助函数 φ(x)', ''] },
  { id: 'cauchy1', parent: 'cauchy', depth: 2, text: '推广到两个函数', blank: ['推广到', '两个函数', ''] },
  { id: 'taylor1', parent: 'taylor', depth: 2, text: '余项 Rₙ(x) 刻画误差', blank: ['余项 ', 'Rₙ(x)', ' 刻画误差'] },
];

export const MM_BLANK_IDS = MM_NODES.filter((n) => n.blank).map((n) => n.id);

const byId = Object.fromEntries(MM_NODES.map((n) => [n.id, n]));
const kids = (id: string) => MM_NODES.filter((n) => n.parent === id);
const branchOf = (n: MMNode): number => (n.branch !== undefined ? n.branch : n.parent ? branchOf(byId[n.parent]) : 4);

const charW = (ch: string, size: number) => (/[\u3000-\u9fff\uff00-\uffef]/.test(ch) ? size : /[A-Za-z0-9 ()=−+.,]/.test(ch) ? size * 0.56 : size * 0.62);
const textW = (s: string, size: number) => [...s].reduce((w, ch) => w + charW(ch, size), 0);

export const nodeSize = (n: MMNode) => {
  if (n.depth === 0) return { w: textW(n.text, 18) + 42, h: 47 };
  if (n.depth === 1) return { w: textW(n.text, 15) + 26, h: 36 };
  if (n.tex) return { w: 236, h: 36 };
  return { w: textW(n.text, 14) + 12, h: 28 };
};

export type LayoutId = 'balanced' | 'logic' | 'org' | 'timeline';
export type Pos = { x: number; y: number };
type Layout = Record<string, Pos>;

const GAP_X = 80;
const GAP_Y = 24;

const layoutHorizontal = (sides: Array<{ side: 1 | -1; l1: MMNode[] }>): Layout => {
  const out: Layout = { root: { x: 0, y: 0 } };
  const root = nodeSize(byId.root);
  for (const { side, l1 } of sides) {
    const heights = l1.map((n) => {
      const leaves = kids(n.id);
      const lh = leaves.reduce((s, c) => s + nodeSize(c).h, 0) + GAP_Y * Math.max(0, leaves.length - 1);
      return Math.max(nodeSize(n).h, lh);
    });
    const total = heights.reduce((s, h) => s + h, 0) + GAP_Y * 1.6 * (l1.length - 1);
    let y = -total / 2;
    l1.forEach((n, i) => {
      const sz = nodeSize(n);
      const cy = y + heights[i] / 2;
      const x = side * (root.w / 2 + GAP_X + sz.w / 2);
      out[n.id] = { x, y: cy };
      const leaves = kids(n.id);
      const lh = leaves.reduce((s, c) => s + nodeSize(c).h, 0) + GAP_Y * Math.max(0, leaves.length - 1);
      let ly = cy - lh / 2;
      leaves.forEach((c) => {
        const cs = nodeSize(c);
        out[c.id] = { x: side * (root.w / 2 + GAP_X + sz.w + GAP_X * 0.75 + cs.w / 2), y: ly + cs.h / 2 };
        ly += cs.h + GAP_Y;
      });
      y += heights[i] + GAP_Y * 1.6;
    });
  }
  return out;
};

const layoutOrg = (): Layout => {
  const out: Layout = { root: { x: 0, y: 0 } };
  const l1 = kids('root');
  const widths = l1.map((n) => {
    const leaves = kids(n.id);
    const lw = leaves.reduce((s, c) => s + nodeSize(c).w, 0) + 24 * Math.max(0, leaves.length - 1);
    return Math.max(nodeSize(n).w, lw);
  });
  const total = widths.reduce((s, w) => s + w, 0) + 40 * (l1.length - 1);
  let x = -total / 2;
  l1.forEach((n, i) => {
    const cx = x + widths[i] / 2;
    out[n.id] = { x: cx, y: 104 };
    const leaves = kids(n.id);
    const lw = leaves.reduce((s, c) => s + nodeSize(c).w, 0) + 24 * Math.max(0, leaves.length - 1);
    let lx = cx - lw / 2;
    leaves.forEach((c) => {
      const cs = nodeSize(c);
      out[c.id] = { x: lx + cs.w / 2, y: 196 };
      lx += cs.w + 24;
    });
    x += widths[i] + 40;
  });
  return out;
};

const layoutTimeline = (): Layout => {
  const root = nodeSize(byId.root);
  const out: Layout = { root: { x: 0, y: 0 } };
  let x = root.w / 2 + 64;
  for (const n of kids('root')) {
    const sz = nodeSize(n);
    const leaves = kids(n.id);
    const colW = Math.max(sz.w, ...leaves.map((c) => nodeSize(c).w + 24));
    out[n.id] = { x: x + sz.w / 2, y: 0 };
    let ly = sz.h / 2 + 26;
    for (const c of leaves) {
      const cs = nodeSize(c);
      out[c.id] = { x: x + 24 + cs.w / 2, y: ly + cs.h / 2 };
      ly += cs.h + 12;
    }
    x += colW + 44;
  }
  return out;
};

export const LAYOUTS: Record<LayoutId, Layout> = {
  balanced: layoutHorizontal([
    { side: 1, l1: [byId.rolle, byId.lag] },
    { side: -1, l1: [byId.cauchy, byId.taylor] },
  ]),
  logic: layoutHorizontal([{ side: 1, l1: kids('root') }]),
  org: layoutOrg(),
  timeline: layoutTimeline(),
};

const bounds = (l: Layout) => {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const n of MM_NODES) {
    const p = l[n.id];
    const s = nodeSize(n);
    x0 = Math.min(x0, p.x - s.w / 2);
    x1 = Math.max(x1, p.x + s.w / 2);
    y0 = Math.min(y0, p.y - s.h / 2);
    y1 = Math.max(y1, p.y + s.h / 2);
  }
  return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
};

const edgePath = (layout: LayoutId, p: Pos, ps: { w: number; h: number }, c: Pos, cs: { w: number; h: number }, childDepth: number) => {
  if (layout === 'org') {
    const y0 = p.y + ps.h / 2;
    const y1 = c.y - cs.h / 2;
    const my = (y0 + y1) / 2;
    const r = Math.min(8, Math.abs(c.x - p.x) / 2);
    if (Math.abs(c.x - p.x) < 1) return `M${p.x} ${y0} V${y1}`;
    const dir = c.x > p.x ? 1 : -1;
    return `M${p.x} ${y0} V${my - r} Q${p.x} ${my} ${p.x + dir * r} ${my} H${c.x - dir * r} Q${c.x} ${my} ${c.x} ${my + r} V${y1}`;
  }
  if (layout === 'timeline') {
    if (childDepth === 1) return `M${p.x + ps.w / 2} ${p.y} H${c.x - cs.w / 2}`;
    const x0 = p.x - ps.w / 2 + 12;
    return `M${x0} ${p.y + ps.h / 2} V${c.y} H${c.x - cs.w / 2}`;
  }
  const dir = c.x >= p.x ? 1 : -1;
  const x0 = p.x + (dir * ps.w) / 2;
  const x1 = c.x - (dir * cs.w) / 2;
  if (layout === 'logic') {
    const mx = (x0 + x1) / 2;
    return `M${x0} ${p.y} H${mx} V${c.y} H${x1}`;
  }
  const dx = (x1 - x0) / 2;
  return `M${x0} ${p.y} C${x0 + dx} ${p.y} ${x1 - dx} ${c.y} ${x1} ${c.y}`;
};

export type ReciteState = { active: boolean; revealed: Record<string, number> };

const NodeLabel = ({ n, tk, recite }: { n: MMNode; tk: Tokens; recite?: ReciteState }) => {
  if (n.tex) return <Tex tex={n.tex} style={{ fontSize: 15 }} />;
  if (!n.blank) return <>{n.text}</>;
  const [pre, mid, post] = n.blank;
  const rk = recite?.revealed[n.id] ?? 0;
  const masked = recite?.active && rk < 1;
  return (
    <>
      {pre}
      <span
        style={{
          borderRadius: 2,
          padding: '0 2px',
          background: recite?.active
            ? masked && rk === 0
              ? tk.foreground
              : tk.dark
                ? brand.emerald900a
                : brand.emerald100
            : 'transparent',
          color: recite?.active && rk === 0 ? 'transparent' : undefined,
          opacity: 1,
          transition: 'none',
        }}
      >
        {mid}
      </span>
      {post}
    </>
  );
};

export const MindmapGraph = ({
  tk,
  from,
  to,
  k,
  width,
  height,
  zoom = 1,
  pan = { x: 0, y: 0 },
  enter,
  recite,
  fit = 0.86,
}: {
  tk: Tokens;
  from: LayoutId;
  to: LayoutId;
  k: number;
  width: number;
  height: number;
  zoom?: number;
  pan?: Pos;
  enter?: (n: MMNode, i: number) => number;
  recite?: ReciteState;
  fit?: number;
}) => {
  const palette = tk.dark ? DARK_PALETTE : LIGHT_PALETTE;
  const A = LAYOUTS[from];
  const B = LAYOUTS[to];
  const pos = (id: string): Pos => ({ x: lerp(A[id].x, B[id].x, k), y: lerp(A[id].y, B[id].y, k) });
  const ba = bounds(A);
  const bb = bounds(B);
  const bw = lerp(ba.w, bb.w, k);
  const bh = lerp(ba.h, bb.h, k);
  const scale = Math.min((width * fit) / bw, (height * fit) / bh) * zoom;
  const cx = lerp(ba.cx, bb.cx, k);
  const cy = lerp(ba.cy, bb.cy, k);
  const style: LayoutId = k > 0.02 ? to : from;
  const edgeColor = (n: MMNode) => palette[branchOf(n) % palette.length];
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width, height, overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          left: width / 2,
          top: height / 2,
          transform: `scale(${scale}) translate(${-cx + pan.x}px, ${-cy + pan.y}px)`,
          transformOrigin: '0 0',
        }}
      >
        <svg style={{ position: 'absolute', left: -2000, top: -2000, overflow: 'visible' }} width={4000} height={4000}>
          <g transform="translate(2000 2000)">
            {style === 'timeline' ? (
              <line
                x1={pos('root').x + nodeSize(byId.root).w / 2}
                y1={0}
                x2={pos('taylor').x + nodeSize(byId.taylor).w / 2 + 30}
                y2={0}
                stroke={tk.mutedFg}
                strokeOpacity={0.45}
                strokeWidth={1.5}
              />
            ) : null}
            {MM_NODES.filter((n) => n.parent).map((n, i) => {
              const p = byId[n.parent!];
              const e = enter ? enter(n, i) : 1;
              return (
                <path
                  key={n.id}
                  d={edgePath(style, pos(p.id), nodeSize(p), pos(n.id), nodeSize(n), n.depth)}
                  fill="none"
                  stroke={edgeColor(n)}
                  strokeOpacity={0.85 * Math.min(1, e * 1.5)}
                  strokeWidth={1.5}
                  strokeLinecap="round"
                />
              );
            })}
          </g>
        </svg>
        {MM_NODES.map((n, i) => {
          const p = pos(n.id);
          const s = nodeSize(n);
          const e = enter ? enter(n, i) : 1;
          const color = edgeColor(n);
          const base: CSSProperties = {
            position: 'absolute',
            left: p.x - s.w / 2,
            top: p.y - s.h / 2,
            width: s.w,
            height: s.h,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxSizing: 'border-box',
            fontFamily: font.ui,
            color: tk.foreground,
            whiteSpace: 'nowrap',
            opacity: Math.min(1, e * 2),
            transform: `scale(${0.6 + 0.4 * e})`,
            lineHeight: 1.5,
          };
          if (n.depth === 0) {
            return (
              <div
                key={n.id}
                style={{ ...base, padding: '10px 20px', borderRadius: 4, fontSize: 18, fontWeight: 600, background: tk.card, border: `1px solid color-mix(in hsl, ${tk.mutedFg} 50%, transparent)` }}
              >
                {n.text}
              </div>
            );
          }
          if (n.depth === 1) {
            return (
              <div key={n.id} style={{ ...base, padding: '6px 12px', borderRadius: 4, fontSize: 15, background: tk.card, border: `1px solid ${color}` }}>
                {n.text}
              </div>
            );
          }
          return (
            <div
              key={n.id}
              style={{ ...base, padding: '2px 4px 4px 4px', fontSize: 14, borderBottom: `1.5px solid ${color}`, justifyContent: 'flex-start' }}
            >
              <NodeLabel n={n} tk={tk} recite={recite} />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const mindmapScreenScale = (from: LayoutId, to: LayoutId, k: number, width: number, height: number, fit = 0.86) => {
  const ba = bounds(LAYOUTS[from]);
  const bb = bounds(LAYOUTS[to]);
  return Math.min((width * fit) / lerp(ba.w, bb.w, k), (height * fit) / lerp(ba.h, bb.h, k));
};

export const layoutNodeCenter = (layout: LayoutId, id: string) => {
  const b = bounds(LAYOUTS[layout]);
  const p = LAYOUTS[layout][id];
  return { x: p.x - b.cx, y: p.y - b.cy };
};

const ctl: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 6,
  borderRadius: 6,
};

/** 对话内嵌导图卡（MindmapCitationCard → MindMapEmbed）。 */
export const MindmapCard = ({
  tk,
  width,
  height = 280,
  enter,
  openPress = 0,
  children,
}: {
  tk: Tokens;
  width: number;
  height?: number;
  enter?: (n: MMNode, i: number) => number;
  openPress?: number;
  children?: ReactNode;
}) => {
  const chrome: CSSProperties = {
    ...ctl,
    background: `color-mix(in hsl, ${tk.background} 80%, transparent)`,
    border: `1px solid color-mix(in hsl, ${tk.border} 50%, transparent)`,
    color: tk.mutedFg,
  };
  return (
    <div
      style={{
        position: 'relative',
        width,
        height,
        borderRadius: 8,
        border: `1px solid color-mix(in hsl, ${tk.border} 50%, transparent)`,
        overflow: 'hidden',
        background: tk.background,
      }}
    >
      {children ?? <MindmapGraph tk={tk} from="balanced" to="balanced" k={0} width={width} height={height} enter={enter} fit={0.8} />}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          padding: '6px 12px',
          display: 'flex',
          alignItems: 'center',
          background: `linear-gradient(to bottom, color-mix(in hsl, ${tk.background} 80%, transparent), transparent)`,
          fontFamily: font.ui,
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 500, color: `color-mix(in hsl, ${tk.foreground} 80%, transparent)` }}>微分中值定理</span>
        <span style={{ marginLeft: 6, fontSize: 12, color: `color-mix(in hsl, ${tk.mutedFg} 60%, transparent)` }}>{S.nodeCount(MM_NODES.length)}</span>
        <span style={{ flex: 1 }} />
        <span style={{ ...chrome, transform: `scale(${1 - openPress * 0.1})`, background: openPress > 0 ? tk.background : chrome.background }}>
          <ArrowsOut size={16} />
        </span>
      </div>
      <div style={{ position: 'absolute', left: 10, bottom: 10, display: 'flex', gap: 6 }}>
        {[GitFork, MagnifyingGlassPlus, MagnifyingGlassMinus, Crosshair].map((I, i) => (
          <span key={i} style={chrome}>
            <I size={14} />
          </span>
        ))}
      </div>
    </div>
  );
};

const TB = ({ children, tk, active = false, style }: { children: ReactNode; tk: Tokens; active?: boolean; style?: CSSProperties }) => (
  <span
    style={{
      height: 28,
      minWidth: 28,
      padding: '0 6px',
      borderRadius: 5,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      color: active ? tk.primary : tk.mutedFg,
      background: active ? `color-mix(in hsl, ${tk.primary} 12%, transparent)` : 'transparent',
      fontSize: 11,
      ...style,
    }}
  >
    {children}
  </span>
);

export const MindmapToolbar = ({ tk, recite = false, structureActive = false }: { tk: Tokens; recite?: boolean; structureActive?: boolean }) => (
  <div
    style={{
      height: 36,
      padding: '0 8px',
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      background: tk.background,
      borderBottom: `1px solid ${tk.border}`,
      fontFamily: font.ui,
      fontSize: 14,
    }}
  >
    <span style={{ display: 'inline-flex', padding: 2, borderRadius: 6, background: tk.muted, gap: 2 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', fontSize: 12, color: tk.mutedFg }}>
        <FileText size={14} />
        {S.mm.outline}
      </span>
      <span
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', fontSize: 12, borderRadius: 5, background: tk.background, color: tk.foreground, boxShadow: '0 1px 2px rgba(0,0,0,0.08)' }}
      >
        <GitBranch size={14} />
        {S.mm.mindmap}
      </span>
    </span>
    <span style={{ width: 8 }} />
    <TB tk={tk}>
      <ArrowCounterClockwise size={16} />
    </TB>
    <TB tk={tk}>
      <ArrowClockwise size={16} />
    </TB>
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: tk.mutedFg, marginLeft: 4 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: tk.mutedFg, opacity: 0.6 }} />
      {S.mm.saved}
    </span>
    <span style={{ flex: 1 }} />
    <TB tk={tk} active={structureActive}>
      <GitBranch size={16} />
    </TB>
    <TB tk={tk}>
      <Gear size={16} />
    </TB>
    <span style={{ width: 1, height: 18, background: tk.border, margin: '0 6px' }} />
    <span style={{ fontSize: 11, color: tk.mutedFg, marginRight: 2 }}>{S.mm.learning}</span>
    <TB tk={tk} active={recite} style={{ padding: '0 7px' }}>
      <BookOpen size={15} />
      {recite ? S.mm.exit : S.mm.recite}
    </TB>
    <TB tk={tk} style={{ padding: '0 7px' }}>
      <EyeSlash size={15} />
      {S.mm.hideCompleted}
    </TB>
    <span style={{ width: 1, height: 18, background: tk.border, margin: '0 6px' }} />
    <TB tk={tk}>
      <MagnifyingGlass size={16} />
    </TB>
    <TB tk={tk}>
      <DotsThree size={16} />
    </TB>
  </div>
);

export const ReciteStatusBar = ({ tk, revealed, total, barK = 1 }: { tk: Tokens; revealed: number; total: number; barK?: number }) => {
  const pct = Math.round((revealed / total) * 100);
  const btn: CSSProperties = { height: 28, padding: '0 8px', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: tk.mutedFg };
  return (
    <div
      style={{
        padding: '6px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        borderBottom: `1px solid ${tk.border}`,
        background: tk.card,
        fontFamily: font.ui,
        fontSize: 13,
        color: tk.foreground,
        transform: `translateY(${(1 - barK) * -8}px)`,
        opacity: barK,
      }}
    >
      <BookOpen size={16} />
      <span style={{ fontWeight: 500 }}>{S.mm.recite}</span>
      <span style={{ width: 96, height: 6, borderRadius: 3, background: tk.muted, overflow: 'hidden' }}>
        <span style={{ display: 'block', height: '100%', width: `${pct}%`, background: tk.warning }} />
      </span>
      <span style={{ fontVariantNumeric: 'tabular-nums', color: tk.mutedFg, fontSize: 12 }}>
        {revealed}/{total} · {pct}%{revealed < total ? `　${S.mm.remaining(total - revealed)}` : ''}
      </span>
      <span style={{ width: 1, height: 16, background: tk.border }} />
      <span style={btn}>
        <Fire size={14} />
        {S.mm.reviewStart}
      </span>
      <span style={{ flex: 1 }} />
      <span style={btn}>
        <Eye size={14} />
        {S.mm.revealAll}
      </span>
      <span style={btn}>
        <EyeSlash size={14} />
        {S.mm.resetAll}
      </span>
      <span style={btn}>
        <X size={14} />
        {S.mm.exit}
      </span>
    </div>
  );
};

export const STRUCTURE_STEPS: Array<{ layout: LayoutId; category: 0 | 1 | 2; preset: string }> = [
  { layout: 'balanced', category: 0, preset: S.mm.presetBalanced },
  { layout: 'logic', category: 1, preset: S.mm.presetLogic },
  { layout: 'org', category: 2, preset: S.mm.presetOrg },
  { layout: 'timeline', category: 1, preset: S.mm.presetTimeline },
];

export const StructurePopover = ({ tk, step, style }: { tk: Tokens; step: number; style?: CSSProperties }) => {
  const cur = STRUCTURE_STEPS[step];
  const cats = [
    { label: S.mm.structMindmap, Icon: SquaresFour },
    { label: S.mm.structLogic, Icon: GitBranch },
    { label: S.mm.structOrg, Icon: Users },
  ];
  return (
    <div
      style={{
        width: 248,
        padding: 8,
        borderRadius: 10,
        background: tk.card,
        border: `1px solid ${tk.border}`,
        boxShadow: tk.shadowFloating,
        fontFamily: font.ui,
        ...style,
      }}
    >
      <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
        {cats.map(({ label, Icon }, i) => (
          <span
            key={label}
            style={{
              flex: 1,
              display: 'inline-flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              padding: '8px 4px',
              borderRadius: 8,
              fontSize: 11,
              color: i === cur.category ? tk.primary : tk.mutedFg,
              background: i === cur.category ? `color-mix(in hsl, ${tk.primary} 10%, transparent)` : 'transparent',
            }}
          >
            <Icon size={16} />
            {label}
          </span>
        ))}
      </div>
      {STRUCTURE_STEPS.map((s, i) => (
        <div
          key={s.preset}
          style={{
            padding: '6px 10px',
            borderRadius: 6,
            fontSize: 12,
            color: i === step ? tk.foreground : tk.mutedFg,
            fontWeight: i === step ? 500 : 400,
            background: i === step ? tk.accent : 'transparent',
          }}
        >
          {s.preset}
        </div>
      ))}
    </div>
  );
};
