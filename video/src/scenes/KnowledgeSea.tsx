import { useLayoutEffect, useRef } from 'react';
import { AbsoluteFill } from 'remotion';
import { clamp, ease, HEIGHT, keys, prog, WIDTH } from '../lib/time';
import { S } from '../strings';
import { font } from '../theme';

type P3 = { x: number; y: number; z: number; s: number; c: number };

const mulberry = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const gauss = (r: () => number) => {
  const u = Math.max(1e-9, r());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
};

export const HITS = [
  { x: -420, y: 140, z: 1500, at: 7.0, label: '高等数学（第七版）上册 · 第134页', tag: S.unifiedSearch },
  { x: 120, y: -60, z: 1350, at: 7.25, label: '证明笔记 · 拉格朗日中值定理', tag: S.unifiedSearch },
  { x: 560, y: 190, z: 1600, at: 7.5, label: '学习记忆 · ξ 的取值范围常写错', tag: S.memorySearch },
];

let CLOUD: P3[] | null = null;
const cloud = () => {
  if (CLOUD) return CLOUD;
  const r = mulberry(20260930);
  const pts: P3[] = [];
  const clusters = Array.from({ length: 16 }, () => ({
    x: (r() - 0.5) * 2600,
    y: (r() - 0.5) * 1400,
    z: 500 + r() * 3200,
    sx: 80 + r() * 260,
    sy: 60 + r() * 180,
    sz: 120 + r() * 400,
  }));
  for (const h of HITS) clusters.push({ x: h.x, y: h.y, z: h.z, sx: 160, sy: 120, sz: 240 });
  for (let i = 0; i < 20000; i++) {
    if (i % 5 === 0) {
      pts.push({ x: (r() - 0.5) * 3600, y: (r() - 0.5) * 2000, z: 300 + r() * 3800, s: r(), c: r() });
    } else {
      const c = clusters[Math.floor(r() * clusters.length)];
      pts.push({ x: c.x + gauss(r) * c.sx, y: c.y + gauss(r) * c.sy, z: c.z + gauss(r) * c.sz, s: r(), c: r() });
    }
  }
  CLOUD = pts;
  return pts;
};

const FOCAL = 900;

export const seaCamZ = (t: number) =>
  keys(t, [
    [6.4, -900],
    [6.8, -300, ease.outCubic],
    [8.0, 250, ease.linear],
    [8.3, 700, ease.inCubic],
  ]);

const projectSea = (t: number, x: number, y: number, z: number) => {
  const cz = seaCamZ(t);
  const drift = (t - 6.4) * 40;
  const dz = z - cz;
  if (dz < 20) return null;
  const k = FOCAL / dz;
  return { x: WIDTH / 2 + (x - drift) * k, y: HEIGHT / 2 + (y + 40) * k, k, dz };
};

export const KnowledgeSea = ({ t }: { t: number }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const fade = prog(t, 6.42, 6.7) * (1 - prog(t, 8.05, 8.3));

  useLayoutEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    const bg = ctx.createRadialGradient(WIDTH / 2, -200, 100, WIDTH / 2, HEIGHT * 0.4, WIDTH * 0.9);
    bg.addColorStop(0, 'hsl(214 50% 22%)');
    bg.addColorStop(0.45, 'hsl(217 45% 11%)');
    bg.addColorStop(1, 'hsl(220 50% 5%)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 7; i++) {
      const y0 = 30 + i * 22;
      ctx.beginPath();
      for (let x = 0; x <= WIDTH; x += 24) {
        const y = y0 + Math.sin(x / 140 + t * 1.8 + i) * 8 + Math.sin(x / 57 - t * 2.4 + i * 2) * 4;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `hsla(205, 80%, 80%, ${0.05 - i * 0.006})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    const pts = cloud();
    for (const p of pts) {
      const q = projectSea(t, p.x, p.y, p.z);
      if (!q || q.x < -20 || q.x > WIDTH + 20 || q.y < -20 || q.y > HEIGHT + 20) continue;
      const fog = clamp(1 - q.dz / 4200);
      const a = fog * fog * (0.25 + p.s * 0.6);
      const size = Math.max(0.8, q.k * (1.6 + p.s * 2.4));
      const hue = 205 + p.c * 20;
      ctx.fillStyle = `hsla(${hue}, 70%, ${68 + p.s * 18}%, ${a})`;
      if (size > 2.6) {
        ctx.beginPath();
        ctx.arc(q.x, q.y, size / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `hsla(${hue}, 80%, 75%, ${a * 0.12})`;
        ctx.beginPath();
        ctx.arc(q.x, q.y, size * 2.2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(q.x - size / 2, q.y - size / 2, size, size);
      }
    }

    HITS.forEach((h, i) => {
      const q = projectSea(t, h.x, h.y, h.z);
      if (!q) return;
      const beam = prog(t, h.at - 0.35, h.at, ease.inCubic);
      const lit = prog(t, h.at, h.at + 0.3, ease.outCubic);
      const rise = prog(t, 7.8 + i * 0.04, 8.15, ease.inCubic);
      if (beam > 0 && lit < 1) {
        const g = ctx.createLinearGradient(q.x, 0, q.x, q.y);
        g.addColorStop(0, 'hsla(210, 90%, 85%, 0)');
        g.addColorStop(1, `hsla(210, 90%, 85%, ${0.55 * (1 - lit)})`);
        ctx.strokeStyle = g;
        ctx.lineWidth = 2 + 10 * (1 - lit);
        ctx.beginPath();
        ctx.moveTo(q.x + (1 - beam) * 0, 0);
        ctx.lineTo(q.x, q.y * beam);
        ctx.stroke();
      }
      if (lit > 0) {
        const r = 10 + lit * 60;
        const ring = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, r * 2.2);
        ring.addColorStop(0, `hsla(210, 100%, 92%, ${0.9})`);
        ring.addColorStop(0.18, `hsla(212, 90%, 75%, ${0.5})`);
        ring.addColorStop(1, 'hsla(215, 80%, 60%, 0)');
        ctx.fillStyle = ring;
        ctx.beginPath();
        ctx.arc(q.x, q.y, r * 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `hsla(210, 100%, 90%, ${(1 - lit) * 0.8})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(q.x, q.y, 20 + lit * 120, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (rise > 0) {
        const g = ctx.createLinearGradient(q.x, q.y, q.x, 0);
        g.addColorStop(0, 'hsla(210, 100%, 92%, 0.9)');
        g.addColorStop(1, 'hsla(210, 100%, 92%, 0.1)');
        ctx.strokeStyle = g;
        ctx.lineWidth = 3;
        ctx.beginPath();
        const topX = WIDTH / 2 + (i - 1) * 180;
        ctx.moveTo(q.x, q.y);
        ctx.bezierCurveTo(q.x, q.y - 300, topX, q.y * (1 - rise) + 200, topX, q.y - (q.y + 50) * rise);
        ctx.stroke();
      }
    });
    ctx.globalCompositeOperation = 'source-over';
  }, [t]);

  if (fade <= 0) return null;
  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <canvas ref={ref} width={WIDTH} height={HEIGHT} style={{ width: WIDTH, height: HEIGHT }} />
      {HITS.map((h) => {
        const q = projectSea(t, h.x, h.y, h.z);
        const k = prog(t, h.at + 0.08, h.at + 0.35, ease.brand) * (1 - prog(t, 7.85, 8.05));
        if (!q || k <= 0) return null;
        return (
          <div
            key={h.label}
            style={{
              position: 'absolute',
              left: q.x + 26,
              top: q.y - 18,
              padding: '8px 14px',
              borderRadius: 10,
              background: 'hsl(217 45% 14% / 0.72)',
              border: '1px solid hsl(210 80% 80% / 0.25)',
              backdropFilter: 'blur(8px)',
              color: 'hsl(210 60% 92%)',
              fontFamily: font.ui,
              fontSize: 17,
              whiteSpace: 'nowrap',
              opacity: k,
              transform: `translateX(${(1 - k) * -10}px)`,
            }}
          >
            <div style={{ fontSize: 12, color: 'hsl(214 64% 72%)', marginBottom: 2, letterSpacing: '0.06em' }}>{h.tag}</div>
            {h.label}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
