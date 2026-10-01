import { clamp, ease, PACE, prog, rand } from '../../lib/time';
import { font, light } from '../../theme';
import { CW } from '../../ui/classic';
import {
  BUBBLE,
  cellCss,
  cellValue,
  QUERY_TOKENS,
  RV,
  STRIP,
  STRIP_W,
  STRIP_WORLD,
  TOKEN_DIMS,
  tokenCell,
} from './beats';

let measureCtx: CanvasRenderingContext2D | null = null;
const measure = (s: string) => {
  measureCtx ??= document.createElement('canvas').getContext('2d');
  if (!measureCtx) return [...s].length * BUBBLE.font;
  measureCtx.font = `${BUBBLE.font}px ${font.ui}`;
  return measureCtx.measureText(s).width;
};

/**
 * 提问被向量化（世界坐标层，叠在经典窗口之上）：
 * 压暗 → 分词括线 → 每个 token 升起一列嵌入 → 池化成一条 64 格查询向量。
 * 结尾镜头推到向量条，匹配剪辑进 3D。
 */
export const Vectorize = ({ t }: { t: number }) => {
  if (t < RV.focus || t > RV.cut + 0.02) return null;
  const tk = light;
  const widths = QUERY_TOKENS.map(measure);
  const W = widths.reduce((a, b) => a + b, 0);
  const textX = CW.chatX + BUBBLE.right - BUBBLE.padX - W;
  const lineTop = CW.title + BUBBLE.top + BUBBLE.padY;
  const bubbleBottom = lineTop - BUBBLE.padY + BUBBLE.line + BUBBLE.padY * 2;
  const xs = widths.map((_, i) => textX + widths.slice(0, i).reduce((a, b) => a + b, 0));

  const veil = prog(t, RV.focus, RV.focus + 0.26, ease.inOutCubic);
  const labelK = prog(t, RV.pool + 0.2, RV.pool + 0.32, ease.brand) * (1 - prog(t, RV.cut - 0.1, RV.cut - 0.03));
  const stripX0 = STRIP_WORLD.x - STRIP_W / 2;

  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: CW.w, height: CW.h, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', inset: 0, background: tk.background, opacity: 0.9 * veil }} />

      {/* 气泡副本（与真实气泡同位置），在压暗层之上 */}
      <div
        style={{
          position: 'absolute',
          left: textX - BUBBLE.padX,
          top: lineTop - BUBBLE.padY,
          width: W + BUBBLE.padX * 2,
          height: BUBBLE.line + BUBBLE.padY * 2,
          borderRadius: 12,
          background: tk.muted,
          boxShadow: `0 ${10 * veil}px ${28 * veil}px hsl(220 20% 10% / ${0.08 * veil})`,
        }}
      />
      {QUERY_TOKENS.map((tok, i) => {
        const k = prog(t, RV.tokenize + i * 0.022, RV.tokenize + i * 0.022 + 0.12, ease.brand);
        return (
          <div key={i} style={{ position: 'absolute', left: xs[i], top: lineTop, width: widths[i], height: BUBBLE.line }}>
            <div
              style={{
                position: 'absolute',
                left: 1,
                right: 1,
                top: -1,
                bottom: -1,
                borderRadius: 4,
                background: `hsl(215 72% 42% / ${0.1 * k})`,
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: 2,
                right: 2,
                top: BUBBLE.line + 1,
                height: 2,
                borderRadius: 1,
                background: tk.primary,
                opacity: k,
                transform: `scaleX(${0.4 + 0.6 * k})`,
              }}
            />
            <span
              style={{
                position: 'relative',
                fontFamily: font.ui,
                fontSize: BUBBLE.font,
                lineHeight: `${BUBBLE.line}px`,
                color: tk.foreground,
                whiteSpace: 'pre',
              }}
            >
              {tok}
            </span>
          </div>
        );
      })}

      {/* token 嵌入列 → 池化成查询向量条 */}
      {QUERY_TOKENS.flatMap((_, i) =>
        Array.from({ length: TOKEN_DIMS }, (_, d) => {
          const j = i * TOKEN_DIMS + d;
          const appear = prog(t, RV.embed + i * 0.026 + d * 0.008, RV.embed + i * 0.026 + d * 0.008 + 0.11, ease.brand);
          if (appear <= 0) return null;
          const flickering = t < RV.embed + i * 0.026 + 0.2;
          const v0 = flickering ? rand(j * 31 + Math.floor(t * PACE * 30)) * 2 - 1 : tokenCell(i, d);
          const pool = prog(t, RV.pool + i * 0.012 + d * 0.004, RV.pool + i * 0.012 + d * 0.004 + 0.2, ease.inOutCubic);
          const ax = xs[i] + widths[i] / 2 - STRIP.cell / 2;
          const ay = bubbleBottom + 16 + d * STRIP.pitch;
          const bx = stripX0 + j * STRIP.pitch;
          const by = STRIP_WORLD.y - STRIP.cell / 2;
          const x = ax + (bx - ax) * pool;
          const y = ay + (by - ay) * pool - Math.sin(pool * Math.PI) * 26;
          const v = v0 + (cellValue(j) - v0) * pool;
          return (
            <div
              key={j}
              style={{
                position: 'absolute',
                left: x,
                top: y,
                width: STRIP.cell,
                height: STRIP.cell,
                borderRadius: 2,
                background: cellCss(v),
                opacity: clamp(appear * 1.4),
                transform: `scale(${0.4 + 0.6 * appear})`,
              }}
            />
          );
        }),
      )}

      <div
        style={{
          position: 'absolute',
          left: stripX0,
          top: STRIP_WORLD.y - 26,
          width: STRIP_W,
          display: 'flex',
          justifyContent: 'space-between',
          fontFamily: font.mono,
          fontSize: 10,
          letterSpacing: '0.04em',
          color: 'hsl(220 8% 46%)',
          opacity: labelK,
        }}
      >
        <span>q = embed(提问)</span>
        <span>1024 维 · L2 归一化</span>
      </div>
    </div>
  );
};
