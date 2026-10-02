import { AbsoluteFill } from 'remotion';
import { camAt, CameraView, type CamKey } from '../../lib/camera';
import { clamp, ease, FPS, PACE, prog } from '../../lib/time';
import { brand, light } from '../../theme';
import { MCP_H, MCP_W, McpPanel, MEM_H, MEM_W, MemoryPanel, MODELS_H, MODELS_W, ModelsPanel, SKILL_H, SKILL_W, SkillsPanel } from '../../ui/you';
import { WbWindow } from '../../ui/workbench';

/**
 * 第三幕「越用，越懂你」（成片 1:48–2:04）：纸面上一条横向铺开的面板带，
 * 镜头在四块面板之间快速平移——记忆 → 技能 → MCP → 多模型。全片节奏最快的一段。
 */
export const YOU = {
  start: 54.0,
  in0: 55.7, // 第一块面板浮现
  memory: 55.85,
  answer: 56.9,
  skills: 58.1,
  mcp: 59.35,
  models: 60.5,
  out0: 61.45,
  out1: 61.9,
} as const;

type Rect = { x: number; y: number; w: number; h: number };
const centered = (cx: number, w: number, h: number, dy = 20): Rect => ({ x: cx - w / 2, y: 540 - h / 2 + dy, w, h });
const MEM_CX = 960;
const SKILL_CX = MEM_CX + 1500;
const MCP_CX = SKILL_CX + 1350;
const MODELS_CX = MCP_CX + 1450;
const MEM_RECT = centered(MEM_CX, MEM_W, MEM_H);
const SKILL_RECT = centered(SKILL_CX, SKILL_W, SKILL_H);
const MCP_RECT = centered(MCP_CX, MCP_W, MCP_H);
const MODELS_RECT = centered(MODELS_CX, MODELS_W, MODELS_H);

const CAM: CamKey[] = [
  [YOU.in0 - 0.1, { x: MEM_CX, y: 560, zoom: 1.08 }],
  [YOU.memory + 0.5, { x: MEM_CX, y: 560, zoom: 1.24 }, ease.outCubic],
  [YOU.skills - 0.2, { x: MEM_CX + 40, y: 560, zoom: 1.3 }, ease.linear],
  [YOU.skills + 0.08, { x: SKILL_CX, y: 560, zoom: 1.2 }, ease.inOutCubic],
  [YOU.mcp - 0.2, { x: SKILL_CX + 30, y: 560, zoom: 1.25 }, ease.linear],
  [YOU.mcp + 0.06, { x: MCP_CX, y: 560, zoom: 1.34 }, ease.inOutCubic],
  [YOU.models - 0.2, { x: MCP_CX + 30, y: 560, zoom: 1.4 }, ease.linear],
  [YOU.models + 0.08, { x: MODELS_CX, y: 560, zoom: 1.1 }, ease.inOutCubic],
  [YOU.out1, { x: MODELS_CX + 30, y: 560, zoom: 1.16 }, ease.linear],
];

const rise = (t: number, at: number) => {
  const k = prog(t, at - 0.12, at + 0.22, ease.outExpo);
  return { opacity: clamp(k * 1.5), transform: `translateY(${(1 - k) * 36}px) scale(${0.97 + 0.03 * k})` };
};

/** 横移时按镜头每帧位移给一点水平运动模糊（只在快速横移的几帧里生效）。 */
const FRAME = 1 / (FPS * PACE);
const motionBlur = (t: number) => {
  const a = camAt(t - FRAME, CAM);
  const b = camAt(t, CAM);
  const v = Math.abs(b.x - a.x) * b.zoom;
  return Math.min(16, Math.max(0, (v - 6) * 0.28));
};

export const SceneYou = ({ t }: { t: number }) => {
  if (t < YOU.in0 - 0.15 || t > YOU.out1 + 0.05) return null;
  const tk = light;
  const cam = camAt(t, CAM);
  const fade = 1 - prog(t, YOU.out0, YOU.out1, ease.inOutCubic);
  const blur = motionBlur(t);
  return (
    <AbsoluteFill style={{ opacity: fade, filter: blur > 0.3 ? 'url(#you-mblur)' : undefined }}>
      {blur > 0.3 ? (
        <svg width={0} height={0} style={{ position: 'absolute' }}>
          <defs>
            <filter id="you-mblur" x="-4%" y="0%" width="108%" height="100%" colorInterpolationFilters="sRGB">
              <feGaussianBlur stdDeviation={`${blur.toFixed(2)} 0`} />
            </filter>
          </defs>
        </svg>
      ) : null}
      <CameraView cam={cam}>
        <div
          style={{
            position: 'absolute',
            left: -1200,
            top: -600,
            width: 9000,
            height: 2400,
            backgroundImage: `linear-gradient(${brand.gridLine} 1px, transparent 1px), linear-gradient(90deg, ${brand.gridLine} 1px, transparent 1px)`,
            backgroundSize: '28px 28px',
          }}
        />
        <WbWindow tk={tk} rect={MEM_RECT} title="记忆" style={rise(t, YOU.memory - 0.05)}>
          <MemoryPanel tk={tk} k={prog(t, YOU.memory, YOU.answer - 0.05)} answer={prog(t, YOU.answer, YOU.skills - 0.2)} />
        </WbWindow>
        <WbWindow tk={tk} rect={SKILL_RECT} title="技能管理" style={rise(t, YOU.skills - 0.1)}>
          <SkillsPanel tk={tk} k={prog(t, YOU.skills, YOU.mcp - 0.35)} />
        </WbWindow>
        <WbWindow tk={tk} rect={MCP_RECT} title="MCP 工具" style={rise(t, YOU.mcp - 0.1)}>
          <McpPanel tk={tk} k={prog(t, YOU.mcp, YOU.mcp + 0.3)} toggles={prog(t, YOU.mcp + 0.15, YOU.mcp + 0.6)} call={prog(t, YOU.mcp + 0.6, YOU.models - 0.2)} />
        </WbWindow>
        <WbWindow tk={tk} rect={MODELS_RECT} title="对话 · 多模型对比" style={rise(t, YOU.models - 0.1)}>
          <ModelsPanel tk={tk} k={prog(t, YOU.models, YOU.out0)} />
        </WbWindow>
      </CameraView>
    </AbsoluteFill>
  );
};
