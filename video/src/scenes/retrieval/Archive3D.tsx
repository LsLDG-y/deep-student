import { useThree } from '@react-three/fiber';
import { Bloom, DepthOfField, EffectComposer, Vignette } from '@react-three/postprocessing';
import { ThreeCanvas } from '@remotion/three';
import { useLayoutEffect, useMemo } from 'react';
import { useRef } from 'react';
import { AbsoluteFill } from 'remotion';
import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { clamp, ease, HEIGHT, keys, PACE, prog, springAt, WIDTH } from '../../lib/time';
import { S } from '../../strings';
import { font } from '../../theme';
import {
  applyCam,
  camAtT,
  camLocal,
  camPose,
  cards,
  FOV,
  HIT_BASE,
  HIT_D,
  HIT_H,
  HIT_SLOT_X,
  HIT_SLOT_Y,
  HIT_W,
  hitScreenRect,
  probePos,
  PROBE_REST,
  pulseOrigin,
  PULSE_SPEED,
  PULSES,
  STRIP_D,
  strip3D,
  toScreen,
  type Card,
} from './archive';
import { useArchiveAssets, type ArchiveAssets } from './assets';
import { cellRGB, cellValue, HITS, RV, STRIP } from './beats';
import type { CardType } from './textures';

// ── 时间曲线 ──────────────────────────────────────────
const mood = (t: number) => keys(t, [[RV.cut, 0], [7.28, 1, ease.inOutCubic], [8.12, 1], [8.36, 0, ease.inOutCubic]]);
const fogNear = (t: number) => keys(t, [[RV.cut, 3.2], [RV.probe, 3.2], [7.42, 5, ease.outCubic], [8.14, 5], [8.36, 4.7, ease.inOutCubic]]);
// 退场：雾向镜头合拢，只留命中卡（命中卡不受雾影响），交接给界面时画面是干净的白底
const fogFar = (t: number) => keys(t, [[RV.cut, 3.4], [RV.probe, 3.4], [7.42, 46, ease.outCubic], [8.14, 46], [8.36, 5, ease.inOutCubic]]);
const bloomI = (t: number) =>
  keys(t, [[RV.cut, 0], [RV.probe - 0.07, 0.4], [RV.probe + 0.01, 1.0, ease.outCubic], [7.32, 0.35], [8.12, 0.3], [8.34, 0]]);
const bokeh = (t: number) => keys(t, [[RV.cut, 0], [7.16, 0], [7.36, 3.2], [8.2, 3.2], [8.36, 0]]);
const vignette = (t: number) => keys(t, [[RV.cut, 0], [7.2, 0.5], [8.12, 0.5], [8.36, 0]]);
const extractK = (t: number, i: number) => springAt(t, RV.extract + i * 0.06, { stiffness: 150, damping: 21 });

const WHITE = new THREE.Color(1, 1, 1);
const DUSK = new THREE.Color().setRGB(0.115, 0.125, 0.15, THREE.SRGBColorSpace);
const GLOW_BLUE = new THREE.Vector3(0.2, 0.38, 0.85);
const smooth = (a: number, b: number, x: number) => {
  const k = clamp((x - a) / (b - a));
  return k * k * (3 - 2 * k);
};

// ── 纹理 ──────────────────────────────────────────────
export const canvasTex = (c: HTMLCanvasElement) => {
  const tx = new THREE.CanvasTexture(c);
  tx.colorSpace = THREE.SRGBColorSpace;
  tx.anisotropy = 8;
  return tx;
};
const radialTex = () => {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  return canvasTex(c);
};
const roundedTex = (w: number, h: number, r: number, blur = 0) => {
  const pad = blur * 2;
  const c = document.createElement('canvas');
  c.width = w + pad * 2;
  c.height = h + pad * 2;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff';
  if (blur) {
    g.shadowColor = '#fff';
    g.shadowBlur = blur;
  }
  g.beginPath();
  g.roundRect(pad, pad, w, h, r);
  g.fill();
  return canvasTex(c);
};

const glowMaterial = (map: THREE.Texture) => {
  const m = new THREE.MeshStandardMaterial({ map, roughness: 0.68, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aGlow;\nvarying vec3 vGlow;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = aGlow;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGlow;')
      .replace('#include <opaque_fragment>', 'outgoingLight += vGlow;\n#include <opaque_fragment>');
  };
  return m;
};

// ── 每张纸片的逐帧状态 ────────────────────────────────
const pulseFlash = (pos: THREE.Vector3, t: number) => {
  let f = 0;
  for (let k = 0; k < PULSES.length; k++) {
    const age = t - PULSES[k];
    if (age <= 0) continue;
    const d = pulseOrigin(k).distanceTo(pos);
    const x = (d - age * PULSE_SPEED) / 1.3;
    f = Math.max(f, Math.exp(-x * x) * Math.exp(-age * 1.1));
  }
  return f;
};

const _v = new THREE.Vector3();
const cardState = (c: Card, t: number, out: { pos: THREE.Vector3; rot: THREE.Euler; bright: number; glow: THREE.Vector3 }) => {
  const sway = t * PACE;
  out.pos.set(
    c.pos.x + Math.sin(sway * 0.5 + c.phase) * 0.05,
    c.pos.y + Math.cos(sway * 0.43 + c.phase) * 0.05,
    c.pos.z,
  );
  // 选中后：离探针近的纸片被推开，给命中让路
  const part = prog(t, RV.select, RV.select + 0.4, ease.outCubic);
  if (part > 0) {
    _v.copy(out.pos).sub(PROBE_REST);
    const d = _v.length();
    const push = Math.max(0, 1 - d / 15) * 4.5 * part;
    if (d > 1e-3) out.pos.addScaledVector(_v.normalize(), push);
  }
  out.rot.set(
    c.rot.x + Math.sin(sway * 0.35 + c.phase) * 0.03,
    c.rot.y + Math.cos(sway * 0.3 + c.phase * 1.3) * 0.04,
    c.rot.z,
  );
  const shown = prog(t, c.reveal, c.reveal + 0.1);
  const rel = smooth(0.3, 0.78, c.sim);
  const dimAfter = 1 - 0.55 * part * (1 - rel * 0.6);
  out.bright = (1 + (0.5 + 0.56 * rel - 1) * shown) * dimAfter;
  const flash = pulseFlash(c.pos, t);
  const g = flash * 0.34 + shown * rel * rel * 0.34 * (1 - part * 0.5);
  out.glow.copy(GLOW_BLUE).multiplyScalar(g);
};

// ── 场景组件 ──────────────────────────────────────────
const Rig = ({ t }: { t: number }) => {
  const { camera, scene } = useThree();
  const fog = useMemo(() => new THREE.Fog(0xffffff, 3.2, 3.4), []);
  const bg = useMemo(() => new THREE.Color(), []);
  useLayoutEffect(() => {
    applyCam(camera as THREE.PerspectiveCamera, t);
    bg.copy(WHITE).lerp(DUSK, mood(t));
    scene.background = bg;
    fog.color.copy(bg);
    fog.near = fogNear(t);
    fog.far = fogFar(t);
    scene.fog = fog;
  }, [t, camera, scene, fog, bg]);
  return null;
};

const CardField = ({ t, assets }: { t: number; assets: ArchiveAssets }) => {
  const groups = useMemo(() => {
    const list = cards();
    const by = new Map<string, { type: CardType; variant: number; idx: number[] }>();
    list.forEach((c, i) => {
      const key = `${c.type}:${c.variant}`;
      if (!by.has(key)) by.set(key, { type: c.type, variant: c.variant, idx: [] });
      by.get(key)!.idx.push(i);
    });
    return [...by.values()].map((g) => {
      const tex = assets.cards[g.type][g.variant];
      const geom = new THREE.BoxGeometry(1, 1, 0.012);
      const glow = new THREE.InstancedBufferAttribute(new Float32Array(g.idx.length * 3), 3);
      glow.setUsage(THREE.DynamicDrawUsage);
      geom.setAttribute('aGlow', glow);
      const mesh = new THREE.InstancedMesh(geom, glowMaterial(canvasTex(tex.canvas)), g.idx.length);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.setColorAt(0, WHITE);
      mesh.frustumCulled = false;
      return { ...g, mesh, glow, aspect: tex.aspect };
    });
  }, [assets]);

  useLayoutEffect(() => {
    const list = cards();
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    const st = { pos: new THREE.Vector3(), rot: new THREE.Euler(), bright: 1, glow: new THREE.Vector3() };
    for (const g of groups) {
      g.idx.forEach((ci, n) => {
        const c = list[ci];
        cardState(c, t, st);
        dummy.position.copy(st.pos);
        dummy.rotation.copy(st.rot);
        dummy.scale.set(c.scale, c.scale * g.aspect, 1);
        dummy.updateMatrix();
        g.mesh.setMatrixAt(n, dummy.matrix);
        g.mesh.setColorAt(n, col.setScalar(st.bright));
        g.glow.setXYZ(n, st.glow.x, st.glow.y, st.glow.z);
      });
      g.mesh.instanceMatrix.needsUpdate = true;
      if (g.mesh.instanceColor) g.mesh.instanceColor.needsUpdate = true;
      g.glow.needsUpdate = true;
    }
  }, [t, groups]);

  return (
    <>
      {groups.map((g) => (
        <primitive key={`${g.type}:${g.variant}`} object={g.mesh} />
      ))}
    </>
  );
};

/** 开场：与 DOM 完全对齐的 64 格向量条，随后收拢成探针。 */
const QueryCells = ({ t }: { t: number }) => {
  const { mesh, base, center, quat } = useMemo(() => {
    const { pitch, cell } = strip3D();
    const m = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: roundedTex(64, 64, 16), transparent: true, toneMapped: false, fog: false, depthWrite: false }),
      STRIP.cells,
    );
    m.setColorAt(0, WHITE);
    m.frustumCulled = false;
    const b = Array.from({ length: STRIP.cells }, (_, j) => camLocal(RV.cut, (j - (STRIP.cells - 1) / 2) * pitch, 0, STRIP_D));
    return { mesh: m, base: b, center: camLocal(RV.cut, 0, 0, STRIP_D), quat: camAtT(RV.cut).quaternion.clone(), cellSize: cell };
  }, []);
  const { cell } = strip3D();

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    const hot = new THREE.Color(0.62, 0.78, 1.0);
    for (let j = 0; j < STRIP.cells; j++) {
      const off = Math.abs(j - (STRIP.cells - 1) / 2) / ((STRIP.cells - 1) / 2);
      const k = prog(t, RV.cut + 0.02 + off * 0.07, RV.probe, ease.inCubic);
      const glowK = prog(t, RV.cut + 0.01, RV.cut + 0.12);
      dummy.position.copy(base[j]).lerp(center, k);
      dummy.position.y += Math.sin(k * Math.PI) * (j % 2 ? 0.05 : -0.05) * (1 - off * 0.5);
      dummy.quaternion.copy(quat);
      const s = cell * (1 - 0.75 * k);
      dummy.scale.set(s, s, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(j, dummy.matrix);
      const [r, g, b] = cellRGB(cellValue(j));
      col.setRGB(r, g, b, THREE.SRGBColorSpace).lerp(hot, Math.max(k, glowK * 0.08));
      mesh.setColorAt(j, col);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.visible = t < RV.probe + 0.01;
  }, [t, mesh, base, center, quat, cell]);
  return <primitive object={mesh} />;
};

/** 探针：一颗实心小点 + 一道细尾迹（不发光，与收尾地形的制图线条同一语言）。 */
const TRAIL_N = 40;
const PROBE_CORE = new THREE.Color(0.86, 0.92, 1.0);
const PROBE_TRAIL = new THREE.Color(0.62, 0.76, 1.0);
const Probe = ({ t }: { t: number }) => {
  const parts = useMemo(() => {
    const group = new THREE.Group();
    const core = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), new THREE.MeshBasicMaterial({ color: PROBE_CORE, toneMapped: false, fog: false }));
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.55, 1.75, 64),
      new THREE.MeshBasicMaterial({ color: PROBE_TRAIL, transparent: true, depthWrite: false, toneMapped: false, fog: false, side: THREE.DoubleSide }),
    );
    const geom = new LineGeometry();
    geom.setPositions(new Array(TRAIL_N * 3).fill(0));
    geom.setColors(new Array(TRAIL_N * 3).fill(1));
    const mat = new LineMaterial({ vertexColors: true, linewidth: 2, transparent: true, depthWrite: false, toneMapped: false });
    mat.resolution.set(WIDTH, HEIGHT);
    const trail = new Line2(geom, mat);
    trail.frustumCulled = false;
    const light = new THREE.PointLight(new THREE.Color('#5b9bff'), 0, 14, 1.2);
    group.add(core, ring, trail, light);
    return { group, core, ring, trail, geom, mat, light };
  }, []);

  useLayoutEffect(() => {
    const on = t >= RV.probe - 0.005 && t < RV.reveal;
    parts.group.visible = on;
    if (!on) return;
    const p = probePos(t);
    const birth = Math.exp(-Math.max(0, t - RV.probe) * PACE * 6);
    const fade = 1 - prog(t, 8.18, 8.38);
    const selectPulse = Math.exp(-Math.max(0, t - RV.select) * PACE * 4) * (t >= RV.select ? 1 : 0);
    parts.core.position.copy(p);
    parts.core.scale.setScalar(0.04 * fade * (1 + birth * 0.8));
    // 选中那一下：一圈细环从点上弹开
    parts.ring.position.copy(p);
    parts.ring.quaternion.copy(camAtT(t).quaternion);
    parts.ring.scale.setScalar(0.04 * (1 + (1 - selectPulse) * 5) * fade);
    (parts.ring.material as THREE.MeshBasicMaterial).opacity = selectPulse * 0.7 * fade;
    const bg = WHITE.clone().lerp(DUSK, mood(t));
    const cam = camPose(t).pos;
    const pos: number[] = [];
    const cols: number[] = [];
    const c = new THREE.Color();
    for (let i = 0; i < TRAIL_N; i++) {
      const tp = probePos(t - i * 0.0035);
      pos.push(tp.x, tp.y, tp.z);
      // 尾迹越旧越接近底色（等于淡出）；离镜头太近的一段也隐去，免得横穿画面
      const k = (1 - i / TRAIL_N) ** 1.6 * prog(cam.distanceTo(tp), 1.2, 2.6) * prog(t - i * 0.0035, RV.probe, RV.probe + 0.06);
      c.copy(bg).lerp(PROBE_TRAIL, k * fade);
      cols.push(c.r, c.g, c.b);
    }
    parts.geom.setPositions(pos);
    parts.geom.setColors(cols);
    parts.light.position.copy(p);
    parts.light.intensity = (18 + birth * 24 + selectPulse * 16) * fade;
  }, [t, parts]);
  return <primitive object={parts.group} />;
};

/** 相似度波前：从探针荡开的一圈圈细线圆环（像声呐，而不是发光的气泡）。 */
const Pulses = ({ t }: { t: number }) => {
  const rings = useMemo(
    () =>
      PULSES.map(() => {
        const geom = new LineGeometry();
        const pts: number[] = [];
        for (let i = 0; i <= 128; i++) {
          const a = (i / 128) * Math.PI * 2;
          pts.push(Math.cos(a), Math.sin(a), 0);
        }
        geom.setPositions(pts);
        const mat = new LineMaterial({ color: PROBE_TRAIL, linewidth: 1.4, transparent: true, depthWrite: false, toneMapped: false });
        mat.resolution.set(WIDTH, HEIGHT);
        const line = new Line2(geom, mat);
        line.frustumCulled = false;
        return line;
      }),
    [],
  );
  useLayoutEffect(() => {
    const q = camAtT(t).quaternion;
    rings.forEach((m, k) => {
      const age = t - PULSES[k];
      m.visible = age > 0 && age < 1.2;
      if (!m.visible) return;
      m.position.copy(pulseOrigin(k));
      m.quaternion.copy(q);
      m.scale.setScalar(Math.max(0.01, age * PULSE_SPEED));
      (m.material as LineMaterial).opacity = 0.6 * Math.exp(-age * 2.6) * prog(age, 0, 0.04);
    });
  }, [t, rings]);
  return (
    <>
      {rings.map((m, k) => (
        <primitive key={k} object={m} />
      ))}
    </>
  );
};

const hitPose = (t: number, i: number) => {
  const k = extractK(t, i);
  const sway = t * PACE;
  const base = HIT_BASE[i].clone().add(new THREE.Vector3(Math.sin(sway * 0.5 + i) * 0.05, Math.cos(sway * 0.43 + i) * 0.05, 0));
  const slot = camLocal(t, HIT_SLOT_X[i], HIT_SLOT_Y, HIT_D);
  const pos = base.lerp(slot, clamp(k, 0, 1.2));
  const q0 = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.06 * (i - 1), -0.12 * (i - 1), 0.04 * (1 - i)));
  const q = q0.slerp(camAtT(t).quaternion, clamp(k));
  return { pos, q, k };
};

const HitCards = ({ t, assets }: { t: number; assets: ArchiveAssets }) => {
  const parts = useMemo(
    () =>
      HITS.map((_, i) => {
        const card = new THREE.Mesh(
          new THREE.BoxGeometry(HIT_W, HIT_H, 0.014),
          // 受雾影响：开场时藏在雾里；抽离后离镜头 4.6 < fog.near，退场合拢的雾也盖不到它们
          new THREE.MeshBasicMaterial({ map: canvasTex(assets.hits[i].canvas), toneMapped: false }),
        );
        return { card };
      }),
    [assets],
  );

  useLayoutEffect(() => {
    parts.forEach(({ card }, i) => {
      card.visible = t < RV.reveal;
      if (!card.visible) return;
      const { pos, q, k } = hitPose(t, i);
      card.position.copy(pos);
      card.quaternion.copy(q);
      card.scale.setScalar(i === 1 ? 1 + 0.08 * clamp(k) : 1);
      const flash = pulseFlash(HIT_BASE[i], t);
      // 选中前与周围受光纸片同亮度（随场景压暗），选中后点亮
      const lit = prog(t, RV.select, RV.select + 0.12);
      const pre = 0.88 - 0.42 * mood(t);
      (card.material as THREE.MeshBasicMaterial).color.setScalar(pre + (1 - pre) * lit + flash * 0.2);
    });
  }, [t, parts]);
  return (
    <>
      {parts.map((p, i) => (
        <primitive key={i} object={p.card} />
      ))}
    </>
  );
};

/** top-k 连线：探针 → 三张命中，线上有光点流动。 */
const Links = ({ t }: { t: number }) => {
  const parts = useMemo(() => {
    const glow = radialTex();
    return HITS.map(() => {
      const geom = new LineGeometry();
      geom.setPositions([0, 0, 0, 0, 0, 1]);
      const mat = new LineMaterial({ color: new THREE.Color(0.46, 0.66, 1.0), linewidth: 2, transparent: true, depthWrite: false, toneMapped: false });
      mat.resolution.set(WIDTH, HEIGHT);
      const line = new Line2(geom, mat);
      line.frustumCulled = false;
      const dot = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: glow, color: new THREE.Color(0.5, 0.75, 1.3), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, transparent: true }),
      );
      return { line, geom, mat, dot };
    });
  }, []);
  useLayoutEffect(() => {
    parts.forEach(({ line, geom, mat, dot }, i) => {
      const grow = prog(t, RV.select + i * 0.035, RV.select + 0.14 + i * 0.035, ease.outCubic);
      const fade = 1 - prog(t, 8.12, 8.3);
      line.visible = grow > 0 && fade > 0;
      dot.visible = line.visible;
      if (!line.visible) return;
      const a = probePos(t);
      const b = hitPose(t, i).pos;
      const end = a.clone().lerp(b, grow);
      geom.setPositions([a.x, a.y, a.z, end.x, end.y, end.z]);
      line.computeLineDistances();
      mat.opacity = 0.9 * fade;
      const f = ((t - RV.select) * PACE * 1.8 + i * 0.3) % 1;
      dot.position.copy(a).lerp(end, f);
      dot.scale.setScalar(0.22 * fade);
    });
  }, [t, parts]);
  return (
    <>
      {parts.map((p, i) => (
        <group key={i}>
          <primitive object={p.line} />
          <primitive object={p.dot} />
        </group>
      ))}
    </>
  );
};

type Fx = { bokehScale: number; target: THREE.Vector3 | null };
type Intensity = { intensity: number };
type Dark = { darkness: number };

const Post = ({ t }: { t: number }) => {
  const dof = useRef<Fx>(null);
  const bloom = useRef<Intensity>(null);
  const vig = useRef<Dark>(null);
  const target0 = useMemo<[number, number, number]>(() => [0, 0, 0], []);
  useLayoutEffect(() => {
    if (dof.current) {
      dof.current.bokehScale = bokeh(t);
      const focusHits = prog(t, RV.extract, RV.extract + 0.25, ease.inOutCubic);
      const f = probePos(t).lerp(camLocal(t, 0, 0, HIT_D), focusHits);
      dof.current.target?.copy(f);
    }
    if (bloom.current) bloom.current.intensity = bloomI(t);
    if (vig.current) vig.current.darkness = vignette(t);
  }, [t]);
  return (
    <EffectComposer multisampling={4}>
      <DepthOfField ref={dof as never} target={target0} worldFocusRange={5} bokehScale={0} />
      <Bloom ref={bloom as never} mipmapBlur luminanceThreshold={1.0} luminanceSmoothing={0.25} intensity={0} radius={0.78} />
      <Vignette ref={vig as never} offset={0.3} darkness={0} />
    </EffectComposer>
  );
};

const Lights = ({ t }: { t: number }) => {
  const m = mood(t);
  return (
    <>
      <hemisphereLight args={[0xffffff, 0xc9d2e0, 1.5 - 0.95 * m]} />
      <directionalLight position={[-4, 6, 9]} intensity={1.9 - 0.7 * m} />
    </>
  );
};

// ── DOM 叠层：相似度读数 / HUD / 命中标签 ─────────────
const CANDIDATES = (() => {
  const list = cards()
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => c.sim > 0.3 && Math.abs(c.pos.x) < 7.5 && Math.abs(c.pos.y) < 4.2 && c.pos.z < -10 && c.pos.z > -58);
  return list.filter((_, n) => n % Math.max(1, Math.floor(list.length / 16)) === 0).slice(0, 16);
})();
const REVEALS = cards()
  .map((c) => c.reveal)
  .sort((a, b) => a - b);
const TOTAL = REVEALS.length + HITS.length;
const scannedAt = (t: number) => {
  let lo = 0;
  let hi = REVEALS.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (REVEALS[mid] <= t) lo = mid + 1;
    else hi = mid;
  }
  const sweep = Math.round(TOTAL * ease.inOutCubic(prog(t, RV.scan + 0.04, RV.select)));
  return Math.min(TOTAL, Math.max(lo, sweep));
};

const Overlay = ({ t }: { t: number }) => {
  const hud = prog(t, 7.16, 7.3, ease.brand) * (1 - prog(t, 8.2, 8.34));
  const n = scannedAt(t);
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', fontFamily: font.ui }}>
      {CANDIDATES.map(({ c, i }) => {
        const k = prog(t, c.reveal, c.reveal + 0.08, ease.brand) * (1 - prog(t, c.reveal + 0.42, c.reveal + 0.56));
        if (k <= 0) return null;
        const s = toScreen(t, c.pos.clone().add(new THREE.Vector3(0, c.scale * 0.62, 0)));
        if (s.behind || s.x < 40 || s.x > WIDTH - 120 || s.y < 40 || s.y > HEIGHT - 40) return null;
        const val = c.sim * prog(t, c.reveal, c.reveal + 0.12, ease.outCubic);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: s.x,
              top: s.y,
              transform: `translate(-50%, -100%) translateY(${(1 - k) * 6}px)`,
              opacity: k,
              padding: '3px 8px',
              borderRadius: 5,
              background: 'hsl(220 10% 11%)',
              border: '1px solid hsl(0 0% 100% / 0.1)',
              fontFamily: font.mono,
              fontSize: 13,
              color: 'hsl(0 0% 94%)',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span style={{ width: 5, height: 5, borderRadius: 3, background: `hsl(215 72% ${70 - c.sim * 35}%)` }} />
            cos {val.toFixed(2)}
          </div>
        );
      })}

      {hud > 0 ? (
        <div
          style={{
            position: 'absolute',
            right: 96,
            top: 76,
            width: 300,
            padding: '14px 18px',
            borderRadius: 10,
            background: 'hsl(220 10% 10%)',
            border: '1px solid hsl(0 0% 100% / 0.09)',
            boxShadow: '0 18px 40px -24px #000',
            opacity: hud,
            transform: `translateY(${(1 - hud) * -8}px)`,
            color: 'hsl(0 0% 96%)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'hsl(214 30% 76%)' }}>
            <span>{S.unifiedSearch} · {S.memorySearch}</span>
            <span style={{ fontFamily: font.mono }}>top-k 3</span>
          </div>
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'baseline', gap: 8, fontFamily: font.mono }}>
            <span style={{ fontSize: 26, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{n.toLocaleString('en-US')}</span>
            <span style={{ fontSize: 13, color: 'hsl(214 20% 70%)' }}>/ {TOTAL.toLocaleString('en-US')} 份资料已比对</span>
          </div>
          <div style={{ marginTop: 10, height: 3, borderRadius: 2, background: 'hsl(0 0% 100% / 0.12)', overflow: 'hidden' }}>
            <div style={{ width: `${(n / TOTAL) * 100}%`, height: '100%', background: 'hsl(214 80% 66%)' }} />
          </div>
        </div>
      ) : null}

      {HITS.map((h, i) => {
        const k = prog(t, RV.extract + 0.16 + i * 0.05, RV.extract + 0.3 + i * 0.05, ease.brand) * (1 - prog(t, RV.reveal - 0.06, RV.reveal));
        if (k <= 0) return null;
        const r = hitScreenRect(i, t);
        return (
          <div
            key={h.title}
            style={{
              position: 'absolute',
              left: r.x + r.w / 2,
              top: r.y + r.h + 18,
              transform: `translateX(-50%) translateY(${(1 - k) * 8}px)`,
              opacity: k,
              textAlign: 'center',
              whiteSpace: 'nowrap',
              padding: '10px 16px',
              borderRadius: 8,
              background: 'hsl(220 10% 10%)',
              border: '1px solid hsl(0 0% 100% / 0.09)',
            }}
          >
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'hsl(214 30% 76%)' }}>
              <span style={{ padding: '2px 8px', borderRadius: 999, background: h.tag === 'memory' ? 'hsl(152 56% 52% / 0.18)' : 'hsl(214 80% 66% / 0.18)', color: h.tag === 'memory' ? 'hsl(152 56% 66%)' : 'hsl(214 80% 78%)' }}>
                {h.tag === 'memory' ? S.memorySearch : S.unifiedSearch}
              </span>
              <span style={{ fontFamily: font.mono, color: 'hsl(0 0% 96%)', fontWeight: 600 }}>cos {h.score.toFixed(2)}</span>
            </div>
            <div style={{ marginTop: 6, fontSize: 17, fontWeight: 500, color: 'hsl(0 0% 96%)' }}>{h.title}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export const Archive3D = ({ t }: { t: number }) => {
  const assets = useArchiveAssets();
  const fade = 1 - prog(t, RV.reveal, RV.reveal + 0.14);
  if (fade <= 0) return null;
  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <ThreeCanvas
        width={WIDTH}
        height={HEIGHT}
        flat
        dpr={1}
        gl={{ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
        camera={{ fov: FOV, near: 0.05, far: 400, position: camPose(RV.cut).pos.toArray() }}
      >
        <Rig t={t} />
        <Lights t={t} />
        {assets ? (
          <>
            <CardField t={t} assets={assets} />
            <HitCards t={t} assets={assets} />
          </>
        ) : null}
        <QueryCells t={t} />
        <Pulses t={t} />
        <Probe t={t} />
        <Links t={t} />
        <Post t={t} />
      </ThreeCanvas>
      <Overlay t={t} />
    </AbsoluteFill>
  );
};
