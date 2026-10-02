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
export const textW = (s: string, size: number) => [...s].reduce((w, ch) => w + charW(ch, size), 0);

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

/**
 * 背诵态：mask 为遮罩浮现进度（0→1），revealed[id] 为逐个揭示进度（0→1）；
 * highlight 控制揭示后浅绿高亮的保留程度（退出背诵时淡掉）。
 */
export type ReciteState = { active: boolean; mask?: number; revealed: Record<string, number>; highlight?: number };

const NodeLabel = ({ n, tk, recite }: { n: MMNode; tk: Tokens; recite?: ReciteState }) => {
  if (n.tex) return <Tex tex={n.tex} style={{ fontSize: 15 }} />;
  if (!n.blank) return <>{n.text}</>;
  const [pre, mid, post] = n.blank;
  const mask = recite ? (recite.mask ?? (recite.active ? 1 : 0)) : 0;
  const rk = recite?.revealed[n.id] ?? 0;
  const hl = (recite?.highlight ?? 1) * Math.min(1, rk * 1.4);
  const hiColor = tk.dark ? brand.emerald900a : brand.emerald100;
  const cover = mask * (1 - rk);
  const ink = 1 - cover;
  return (
    <>
      {pre}
      <span
        style={{
          position: 'relative',
          display: 'inline-block',
          borderRadius: 2,
          padding: '0 2px',
          background: `color-mix(in srgb, ${hiColor} ${hl * 100}%, transparent)`,
          color: `color-mix(in srgb, ${tk.foreground} ${ink * 100}%, transparent)`,
          transform: `scale(${1 + Math.sin(rk * Math.PI) * 0.08})`,
        }}
      >
        {mid}
        {cover > 0.001 ? (
          <span
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 2,
              background: tk.foreground,
              opacity: mask,
              clipPath: `inset(0 0 0 ${rk * 100}%)`,
            }}
          />
        ) : null}
      </span>
      {post}
    </>
  );
};

/** 挖空段（中间那截）的中心相对节点所在布局包围盒中心的偏移（图坐标）。 */
export const blankAnchor = (layout: LayoutId, id: string) => {
  const n = byId[id];
  const c = layoutNodeCenter(layout, id);
  if (!n.blank) return c;
  const s = nodeSize(n);
  const [pre, mid] = n.blank;
  return { x: c.x - s.w / 2 + 4 + textW(pre, 14) + (textW(mid, 14) + 4) / 2, y: c.y + 1 };
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
  maxScale = Infinity,
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
  /** fitView 的最大缩放（对应 React Flow maxZoom），避免节点少的布局被放得过大。 */
  maxScale?: number;
}) => {
  const palette = tk.dark ? DARK_PALETTE : LIGHT_PALETTE;
  const A = LAYOUTS[from];
  const B = LAYOUTS[to];
  const pos = (id: string): Pos => ({ x: lerp(A[id].x, B[id].x, k), y: lerp(A[id].y, B[id].y, k) });
  const ba = bounds(A);
  const bb = bounds(B);
  const bw = lerp(ba.w, bb.w, k);
  const bh = lerp(ba.h, bb.h, k);
  const scale = Math.min((width * fit) / bw, (height * fit) / bh, maxScale) * zoom;
  const cx = lerp(ba.cx, bb.cx, k);
  const cy = lerp(ba.cy, bb.cy, k);
  // 布局形变时两种连线风格交叉淡化，避免在某一帧硬切
  const edgeStyles: Array<[LayoutId, number]> = from === to ? [[to, 1]] : [[from, 1 - k], [to, k]];
  const axisW = edgeStyles.reduce((s, [st, w]) => s + (st === 'timeline' ? w : 0), 0);
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
            {axisW > 0.001 ? (
              <line
                x1={pos('root').x + nodeSize(byId.root).w / 2}
                y1={pos('root').y}
                x2={pos('taylor').x + nodeSize(byId.taylor).w / 2 + 30}
                y2={pos('root').y}
                stroke={tk.mutedFg}
                strokeOpacity={0.45 * axisW}
                strokeWidth={1.5}
              />
            ) : null}
            {edgeStyles.map(([st, w]) =>
              w > 0.001
                ? MM_NODES.filter((n) => n.parent).map((n, i) => {
                    const p = byId[n.parent!];
                    const e = enter ? enter(n, i) : 1;
                    return (
                      <path
                        key={`${st}:${n.id}`}
                        d={edgePath(st, pos(p.id), nodeSize(p), pos(n.id), nodeSize(n), n.depth)}
                        fill="none"
                        stroke={edgeColor(n)}
                        strokeOpacity={0.85 * Math.min(1, e * 1.5) * w}
                        strokeWidth={1.5}
                        strokeLinecap="round"
                      />
                    );
                  })
                : null,
            )}
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
}) => (
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
    <MindmapCardChrome tk={tk} openPress={openPress} />
  </div>
);

/** 内嵌导图卡的浮层控件（标题行 + 左下角缩放组），展开成全窗视图时淡出。 */
export const MindmapCardChrome = ({ tk, openPress = 0, opacity = 1 }: { tk: Tokens; openPress?: number; opacity?: number }) => {
  const chrome: CSSProperties = {
    ...ctl,
    background: `color-mix(in hsl, ${tk.background} 80%, transparent)`,
    border: `1px solid color-mix(in hsl, ${tk.border} 50%, transparent)`,
    color: tk.mutedFg,
  };
  return (
    <div style={{ position: 'absolute', inset: 0, opacity, pointerEvents: 'none' }}>
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

const TB = ({
  children,
  tk,
  active = false,
  press = 0,
  style,
}: {
  children: ReactNode;
  tk: Tokens;
  active?: boolean;
  press?: number;
  style?: CSSProperties;
}) => (
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
      background: active
        ? `color-mix(in hsl, ${tk.primary} ${12 + press * 10}%, transparent)`
        : press > 0
          ? `color-mix(in hsl, ${tk.accent} ${press * 100}%, transparent)`
          : 'transparent',
      fontSize: 11,
      whiteSpace: 'nowrap',
      transform: `scale(${1 - press * 0.08})`,
      ...style,
    }}
  >
    {children}
  </span>
);

export const VIEW_TB_H = 36;

/** 工具栏右侧槽位（右→左，固定宽度），瞳点据此精确落在按钮上。 */
const TB_SLOTS: Array<{ id: string; w: number }> = [
  { id: 'more', w: 28 },
  { id: 'search', w: 28 },
  { id: 'sep2', w: 13 },
  { id: 'hide', w: 92 },
  { id: 'recite', w: 80 },
  { id: 'label', w: 26 },
  { id: 'sep1', w: 13 },
  { id: 'gear', w: 28 },
  { id: 'structure', w: 28 },
];
const TB_PAD = 8;
const TB_GAP = 4;
const slotRightEdge = (id: string) => {
  let r = TB_PAD;
  for (const s of TB_SLOTS) {
    if (s.id === id) return r;
    r += s.w + TB_GAP;
  }
  return r;
};
/** 槽位中心距工具栏右缘的距离。 */
export const tbSlotRight = (id: string) => slotRightEdge(id) + (TB_SLOTS.find((s) => s.id === id)?.w ?? 0) / 2;

export const MindmapToolbar = ({
  tk,
  recite = false,
  structureActive = false,
  structurePress = 0,
  recitePress = 0,
}: {
  tk: Tokens;
  recite?: boolean;
  structureActive?: boolean;
  structurePress?: number;
  recitePress?: number;
}) => {
  const slot = (id: string, child: ReactNode) => {
    const s = TB_SLOTS.find((x) => x.id === id)!;
    return (
      <span key={id} style={{ position: 'absolute', right: slotRightEdge(id), top: 4, width: s.w, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {child}
      </span>
    );
  };
  const sep = <span style={{ width: 1, height: 18, background: tk.border }} />;
  return (
    <div
      style={{
        position: 'relative',
        height: VIEW_TB_H,
        padding: '0 8px',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        boxSizing: 'border-box',
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
      {slot(
        'structure',
        <TB tk={tk} active={structureActive} press={structurePress}>
          <GitBranch size={16} />
        </TB>,
      )}
      {slot(
        'gear',
        <TB tk={tk}>
          <Gear size={16} />
        </TB>,
      )}
      {slot('sep1', sep)}
      {slot('label', <span style={{ fontSize: 11, color: tk.mutedFg }}>{S.mm.learning}</span>)}
      {slot(
        'recite',
        <TB tk={tk} active={recite} press={recitePress} style={{ padding: '0 7px' }}>
          <BookOpen size={15} />
          {recite ? S.mm.exit : S.mm.recite}
        </TB>,
      )}
      {slot(
        'hide',
        <TB tk={tk} style={{ padding: '0 7px' }}>
          <EyeSlash size={15} />
          {S.mm.hideCompleted}
        </TB>,
      )}
      {slot('sep2', sep)}
      {slot(
        'search',
        <TB tk={tk}>
          <MagnifyingGlass size={16} />
        </TB>,
      )}
      {slot(
        'more',
        <TB tk={tk}>
          <DotsThree size={16} />
        </TB>,
      )}
    </div>
  );
};

export const ReciteStatusBar = ({
  tk,
  revealed,
  total,
  barK = 1,
  fill,
}: {
  tk: Tokens;
  revealed: number;
  total: number;
  barK?: number;
  /** 进度条的连续填充值（0..1），缺省按 revealed/total。 */
  fill?: number;
}) => {
  const pct = Math.round((revealed / total) * 100);
  const barPct = (fill ?? revealed / total) * 100;
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
        <span style={{ display: 'block', height: '100%', width: `${barPct}%`, background: revealed >= total ? tk.success : tk.warning }} />
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

/** 结构弹层的几何（固定行高，瞳点按行定位）。 */
export const POPOVER = { w: 248, pad: 8, catH: 52, catGap: 6, rowH: 30 } as const;
export const popoverRowY = (i: number) => POPOVER.pad + POPOVER.catH + POPOVER.catGap + POPOVER.rowH * i + POPOVER.rowH / 2;

export const StructurePopover = ({
  tk,
  step,
  hot = -1,
  press = 0,
  style,
}: {
  tk: Tokens;
  step: number;
  hot?: number;
  press?: number;
  style?: CSSProperties;
}) => {
  const cur = STRUCTURE_STEPS[step];
  const cats = [
    { label: S.mm.structMindmap, Icon: SquaresFour },
    { label: S.mm.structLogic, Icon: GitBranch },
    { label: S.mm.structOrg, Icon: Users },
  ];
  return (
    <div
      style={{
        width: POPOVER.w,
        padding: POPOVER.pad,
        boxSizing: 'border-box',
        borderRadius: 10,
        background: tk.card,
        border: `1px solid ${tk.border}`,
        boxShadow: tk.shadowFloating,
        fontFamily: font.ui,
        ...style,
      }}
    >
      <div style={{ display: 'flex', gap: 4, height: POPOVER.catH, marginBottom: POPOVER.catGap }}>
        {cats.map(({ label, Icon }, i) => (
          <span
            key={label}
            style={{
              flex: 1,
              display: 'inline-flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
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
      {STRUCTURE_STEPS.map((s, i) => {
        const on = i === step;
        const isHot = i === hot && !on;
        return (
          <div
            key={s.preset}
            style={{
              height: POPOVER.rowH,
              boxSizing: 'border-box',
              padding: '0 10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderRadius: 6,
              fontSize: 12,
              color: on || isHot ? tk.foreground : tk.mutedFg,
              fontWeight: on ? 500 : 400,
              background: on
                ? `color-mix(in hsl, ${tk.foreground} ${8 + (i === hot ? press * 8 : 0)}%, ${tk.accent})`
                : isHot
                  ? `color-mix(in hsl, ${tk.accent} 70%, transparent)`
                  : 'transparent',
              transform: i === hot ? `scale(${1 - press * 0.02})` : undefined,
            }}
          >
            {s.preset}
            {on ? <span style={{ width: 6, height: 6, borderRadius: 3, background: tk.primary }} /> : null}
          </div>
        );
      })}
    </div>
  );
};
