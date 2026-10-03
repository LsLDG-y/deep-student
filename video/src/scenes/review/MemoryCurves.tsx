import { clamp, ease, prog } from '../../lib/time';
import { font, type Tokens } from '../../theme';
import { ratingTone, type Rating } from '../../ui/flashcards';

/**
 * FSRS 记忆曲线信息图：与工作台窗口同材质的实色面板，细线、无发光、无渐变填充。
 * 保留率 R(t) = (1 + 19/81 · t/S)^(−0.5)，t = S 时恰为 90%（FSRS-4.5/5 的定义）；
 * 三条曲线的稳定性取 FSRS-5 默认参数下首评「重来 / 良好 / 简单」的初始稳定性。
 */
const FACTOR = 19 / 81;
const R = (tDays: number, s: number) => (1 + (FACTOR * tDays) / s) ** -0.5;

type Curve = { name: string; tag: string; rating: Rating; s: number; when: string };
export const CURVES: Curve[] = [
  { name: 'ξ 的取值范围', tag: '薄弱', rating: 1, s: 0.4, when: '10 小时后' },
  { name: '罗尔定理的三个条件', tag: '一般', rating: 3, s: 3.17, when: '3 天后' },
  { name: '拉格朗日中值定理的条件', tag: '牢固', rating: 4, s: 15.69, when: '16 天后' },
];

const T0 = 1 / 24; // 1 小时
const T1 = 60; // 60 天
const Y0 = 0.4;
const N = 160;
/** 曲线按对数时间匀速画出；越过 90%（t = S）的时刻点亮复习点。 */
const DRAW = 0.7;
const curveStart = (start: number, i: number) => start + 0.4 + i * 0.16;
export const hitAt = (start: number, i: number) => curveStart(start, i) + DRAW * (Math.log(CURVES[i].s / T0) / Math.log(T1 / T0));
const TICKS: Array<[number, string]> = [
  [1 / 24, '1 小时'],
  [1, '1 天'],
  [7, '1 周'],
  [30, '1 个月'],
];

export const MemoryCurves = ({ tk, t, start, rect }: { tk: Tokens; t: number; start: number; rect: { x: number; y: number; w: number; h: number } }) => {
  const appear = prog(t, start, start + 0.26, ease.wbOut);
  if (appear <= 0) return null;
  const plot = { x: 76, y: 196, w: rect.w - 76 - 48, h: rect.h - 196 - 74 };
  const xOf = (d: number) => plot.x + (Math.log(d / T0) / Math.log(T1 / T0)) * plot.w;
  const yOf = (r: number) => plot.y + ((1 - r) / (1 - Y0)) * plot.h;
  const axisK = prog(t, start + 0.1, start + 0.3, ease.outCubic);
  const lineY = yOf(0.9);
  const muted = 'hsl(0 0% 62%)';
  const faint = 'hsl(0 0% 100% / 0.06)';

  return (
    <div
      style={{
        position: 'absolute',
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        boxSizing: 'border-box',
        borderRadius: 20,
        background: tk.card,
        border: '1px solid hsl(0 0% 18% / 0.85)',
        boxShadow: '0 0 0 0.5px rgba(0,0,0,0.42), 0 28px 80px rgba(0,0,0,0.5), 0 9px 26px rgba(0,0,0,0.3)',
        fontFamily: font.ui,
        color: tk.foreground,
        opacity: clamp(appear * 1.6),
        transform: `translateY(${(1 - appear) * 24}px) scale(${0.97 + 0.03 * appear})`,
        transformOrigin: '50% 60%',
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', left: 40, top: 34, right: 40 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <span style={{ fontSize: 28, fontWeight: 600, letterSpacing: '0.02em' }}>记忆曲线</span>
          <span style={{ fontFamily: font.mono, fontSize: 14, letterSpacing: '0.06em', color: muted }}>FSRS</span>
        </div>
        <div style={{ marginTop: 10, fontSize: 15, lineHeight: 1.6, color: muted }}>每张卡忘得快慢不同；保留率跌到 90% 之前，安排下一次复习。</div>
      </div>

      <svg width={rect.w} height={rect.h} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
        <g opacity={axisK}>
          {[1, 0.8, 0.6, 0.4].map((r) => (
            <g key={r}>
              <line x1={plot.x} x2={plot.x + plot.w} y1={yOf(r)} y2={yOf(r)} stroke={faint} />
              <text x={plot.x - 14} y={yOf(r) + 4} textAnchor="end" fontSize={12} fill={muted} fontFamily={font.mono}>
                {Math.round(r * 100)}%
              </text>
            </g>
          ))}
          {TICKS.map(([d, label]) => (
            <g key={label}>
              <line x1={xOf(d)} x2={xOf(d)} y1={plot.y + plot.h} y2={plot.y + plot.h + 6} stroke="hsl(0 0% 100% / 0.22)" />
              <text x={xOf(d)} y={plot.y + plot.h + 28} textAnchor="middle" fontSize={13} fill={muted}>
                {label}
              </text>
            </g>
          ))}
          <line x1={plot.x} x2={plot.x + plot.w} y1={plot.y + plot.h} y2={plot.y + plot.h} stroke="hsl(0 0% 100% / 0.22)" />
          <text x={plot.x - 14} y={plot.y - 20} textAnchor="end" fontSize={12} fill={muted}>
            保留率
          </text>
        </g>
        {/* 期望保留率 90% */}
        <g opacity={prog(t, start + 0.25, start + 0.4)}>
          <line
            x1={plot.x}
            x2={plot.x + plot.w * prog(t, start + 0.25, start + 0.55, ease.inOutCubic)}
            y1={lineY}
            y2={lineY}
            stroke="hsl(0 0% 100% / 0.55)"
            strokeWidth={1.25}
            strokeDasharray="5 6"
          />
          {/* 左端线下：红线在交点左侧还在线上方，这一角是空的 */}
          <text x={plot.x + 10} y={lineY + 24} textAnchor="start" fontSize={13} fill="hsl(0 0% 86%)">
            期望保留率 90%
          </text>
        </g>
        {/* 三条曲线：从左往右画出，越过 90% 时点亮复习点 */}
        {CURVES.map((c, i) => {
          const tone = ratingTone(tk, c.rating);
          const s0 = curveStart(start, i);
          const drawX = prog(t, s0, s0 + DRAW);
          const shown: Array<[number, number]> = [];
          for (let j = 0; j <= N; j++) {
            if (j / N > drawX && j > 1) break;
            const d = T0 * (T1 / T0) ** (j / N);
            const r = R(d, c.s);
            if (r < Y0) break;
            shown.push([xOf(d), yOf(r)]);
          }
          const path = shown.map(([x, y], j) => `${j ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
          const cx = xOf(c.s);
          const at = hitAt(start, i);
          const hit = prog(t, at - 0.01, at + 0.12, ease.overshoot);
          const pulse = c.rating === 1 ? t - at : -1;
          return (
            <g key={c.name}>
              <path d={path} fill="none" stroke={tone.text} strokeWidth={c.rating === 1 ? 3 : 2.2} strokeLinecap="round" strokeLinejoin="round" opacity={drawX > 0 ? 1 : 0} />
              {hit > 0 ? (
                <g>
                  <line x1={cx} x2={cx} y1={lineY} y2={plot.y + plot.h} stroke={tone.text} strokeOpacity={0.4 * clamp(hit)} strokeDasharray="2 4" />
                  {pulse > 0 && pulse < 0.7 ? <circle cx={cx} cy={lineY} r={8 + pulse * 36} fill="none" stroke={tone.text} strokeOpacity={(1 - pulse / 0.7) * 0.5} strokeWidth={1.5} /> : null}
                  <circle cx={cx} cy={lineY} r={6.5 * hit} fill={tone.text} stroke={tk.card} strokeWidth={3} />
                </g>
              ) : null}
            </g>
          );
        })}
      </svg>

      {/* 复习点标注：直接写在面板上，不再套边框 */}
      {CURVES.map((c, i) => {
        const at = hitAt(start, i);
        const k = prog(t, at + 0.04, at + 0.22, ease.brand);
        if (k <= 0) return null;
        const tone = ratingTone(tk, c.rating);
        const above = i !== 1;
        return (
          <div
            key={c.name}
            style={{
              position: 'absolute',
              left: xOf(c.s),
              top: lineY + (above ? -18 : 18),
              transform: `translate(-50%, ${above ? '-100%' : '0'}) translateY(${(1 - k) * (above ? 6 : -6)}px)`,
              opacity: k,
              whiteSpace: 'nowrap',
              textAlign: 'center',
              // 标注压在其它曲线上时用面板底色垫一块，线从字后面穿过
              padding: '3px 8px 4px',
              borderRadius: 6,
              background: tk.card,
            }}
          >
            <div style={{ fontSize: 14, color: tone.text, fontWeight: 600, letterSpacing: '0.02em' }}>
              {c.tag} · {c.when}再见
            </div>
            <div style={{ marginTop: 3, fontSize: 12.5, color: muted }}>{c.name}</div>
          </div>
        );
      })}
    </div>
  );
};
