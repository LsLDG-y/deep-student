import { clamp, ease, lerp, prog } from '../../lib/time';
import type { Tokens } from '../../theme';
import { CW } from '../../ui/classic';
import {
  blankAnchor,
  MindmapCardChrome,
  MindmapGraph,
  MindmapToolbar,
  mindmapScreenScale,
  POPOVER,
  popoverRowY,
  ReciteStatusBar,
  StructurePopover,
  tbSlotRight,
  VIEW_TB_H,
  type LayoutId,
} from '../../ui/mindmap';

export type Rect = { x: number; y: number; w: number; h: number };

/** 03 整理（后半）的节拍表，单位为脚本秒。 */
export const MM = {
  open0: 12.0, // 匹配剪辑：对话里的导图卡展开成全窗视图
  open1: 12.42,
  structClick: 12.56, // 点「切换结构」
  steps: [12.8, 13.1, 13.4, 13.7], // 逻辑图 → 组织结构图 → 时间轴 → 思维导图(平衡)
  popClose: 13.86,
  reciteClick: 14.06, // 点「背诵模式」
  reveals: [14.3, 14.44, 14.66, 14.8],
  close0: 14.96, // 收回对话里的卡片
  close1: 15.3,
} as const;

/** 全窗导图视图占据经典窗口的主内容区（侧栏右侧、标题栏下方）。 */
export const VIEW: Rect = { x: CW.nav, y: CW.title, w: CW.w - CW.nav, h: CW.h - CW.title };
export const CANVAS: Rect = { x: VIEW.x, y: VIEW.y + VIEW_TB_H, w: VIEW.w, h: VIEW.h - VIEW_TB_H };

const FIT = 0.84;
const CARD_FIT = 0.8;
/** 全窗时图的中心放在画布 43% 高度处，给顶部的背诵状态栏与弹层留出视线。 */
const GRAPH_H = 0.86;
const MAX_SCALE = 1.28;
const MORPH = 0.24;
const SEQ: LayoutId[] = ['balanced', 'logic', 'org', 'timeline', 'balanced'];
/** 每次切换对应弹层里的预设行（STRUCTURE_STEPS 下标）。 */
const STEP_ROW = [1, 2, 3, 0];
/** 揭示顺序：右上 → 右下 → 左下 → 左上，瞳点路径最短。 */
const REVEAL_ORDER = ['rolle1', 'lag2', 'taylor1', 'cauchy1'];

const pressAt = (t: number, at: number, w = 0.1) => Math.max(0, 1 - Math.abs(t - at) / w);

export const layoutAt = (t: number) => {
  let i = 0;
  while (i < MM.steps.length && t >= MM.steps[i]) i++;
  if (i === 0) return { from: SEQ[0], to: SEQ[0], k: 0, step: 0 };
  return { from: SEQ[i - 1], to: SEQ[i], k: prog(t, MM.steps[i - 1], MM.steps[i - 1] + MORPH, ease.brand), step: STEP_ROW[i - 1] };
};

/** 展开度：0 = 对话里的卡片，1 = 全窗视图。 */
export const openAt = (t: number) => prog(t, MM.open0, MM.open1, ease.wbOut) * (1 - prog(t, MM.close0, MM.close1, ease.inOutCubic));

const viewRect = (card: Rect, e: number): Rect => ({
  x: lerp(card.x, VIEW.x, e),
  y: lerp(card.y, VIEW.y, e),
  w: lerp(card.w, VIEW.w, e),
  h: lerp(card.h, VIEW.h, e),
});

// ── 交互落点（世界坐标） ──────────────────────────────
export const STRUCT_BTN = { x: VIEW.x + VIEW.w - tbSlotRight('structure'), y: VIEW.y + VIEW_TB_H / 2 };
export const RECITE_BTN = { x: VIEW.x + VIEW.w - tbSlotRight('recite'), y: VIEW.y + VIEW_TB_H / 2 };
const POP = { x: STRUCT_BTN.x + 36 - POPOVER.w, y: VIEW.y + VIEW_TB_H + 6 };
const presetRow = (i: number) => ({ x: POP.x + 92, y: POP.y + popoverRowY(i) });

const blankWorld = (id: string) => {
  const h = CANVAS.h * GRAPH_H;
  const s = mindmapScreenScale('balanced', 'balanced', 0, CANVAS.w, h, FIT);
  const a = blankAnchor('balanced', id);
  return { x: CANVAS.x + CANVAS.w / 2 + a.x * s, y: CANVAS.y + h / 2 + a.y * s };
};

/** 本段瞳点路径（[到达时刻, x, y]，世界坐标）与点击时刻。 */
export const ORGANIZE_PUPIL: Array<[number, number, number]> = (() => {
  const pts: Array<[number, number, number]> = [];
  const at = (time: number, p: { x: number; y: number }) => pts.push([time, p.x, p.y]);
  at(12.3, { x: CANVAS.x + CANVAS.w * 0.62, y: CANVAS.y + CANVAS.h * 0.56 });
  at(MM.structClick - 0.05, STRUCT_BTN);
  at(MM.structClick + 0.06, STRUCT_BTN);
  MM.steps.forEach((s, i) => {
    at(s - 0.05, presetRow(STEP_ROW[i]));
    at(s + 0.07, presetRow(STEP_ROW[i]));
  });
  at(MM.reciteClick - 0.05, RECITE_BTN);
  at(MM.reciteClick + 0.08, RECITE_BTN);
  REVEAL_ORDER.forEach((id, i) => {
    const b = blankWorld(id);
    at(MM.reveals[i] - 0.03, b);
    at(MM.reveals[i] + 0.04, b);
  });
  const last = blankWorld(REVEAL_ORDER[REVEAL_ORDER.length - 1]);
  at(MM.close0, { x: last.x + 60, y: last.y + 40 });
  return pts;
})();
export const ORGANIZE_CLICKS = [MM.structClick, ...MM.steps, MM.reciteClick, ...MM.reveals];
export const organizePupilOpacity = (t: number) => prog(t, 12.28, 12.42) * (1 - prog(t, MM.close0 - 0.1, MM.close0));

// ── 场景 ──────────────────────────────────────────────
export const MindmapView = ({ t, tk, card }: { t: number; tk: Tokens; card: Rect }) => {
  if (t < MM.open0 || t > MM.close1) return null;
  const e = openAt(t);
  const R = viewRect(card, e);
  const tbH = VIEW_TB_H * e;
  const gH = (R.h - tbH) * lerp(1, GRAPH_H, e);
  const L = layoutAt(t);

  const popK = prog(t, MM.structClick, MM.structClick + 0.12, ease.brand) * (1 - prog(t, MM.popClose, MM.popClose + 0.1, ease.inCubic));
  let hot = -1;
  let rowPress = 0;
  MM.steps.forEach((s, i) => {
    if (t >= s - 0.14 && t < s + 0.12) {
      hot = STEP_ROW[i];
      rowPress = pressAt(t, s, 0.08);
    }
  });

  const reciteOn = t >= MM.reciteClick;
  const barK = prog(t, MM.reciteClick, MM.reciteClick + 0.18, ease.brand) * (1 - prog(t, MM.close0 - 0.06, MM.close0 + 0.08));
  const mask = prog(t, MM.reciteClick + 0.04, MM.reciteClick + 0.2, ease.outCubic);
  const revealed = Object.fromEntries(REVEAL_ORDER.map((id, i) => [id, prog(t, MM.reveals[i], MM.reveals[i] + 0.16, ease.outCubic)]));
  const count = MM.reveals.filter((r) => t >= r + 0.08).length;
  const fill = MM.reveals.reduce((s, r) => s + prog(t, r, r + 0.16, ease.outCubic), 0) / MM.reveals.length;
  const recite = reciteOn ? { active: true, mask, revealed, highlight: 1 - prog(t, MM.close0, MM.close0 + 0.2) } : undefined;

  // 展开 / 收回过程中整张卡浮起
  const lift = Math.sin(Math.PI * clamp(e)) * (t < MM.close0 ? 1 : 0.6);

  return (
    <div
      style={{
        position: 'absolute',
        left: R.x,
        top: R.y,
        width: R.w,
        height: R.h,
        borderRadius: lerp(8, 0, e),
        overflow: 'hidden',
        background: tk.background,
        border: `1px solid color-mix(in hsl, ${tk.border} ${50 * (1 - e)}%, transparent)`,
        boxShadow: lift > 0.01 ? `0 ${24 * lift}px ${60 * lift}px hsl(220 30% 12% / ${0.16 * lift})` : undefined,
      }}
    >
      <div style={{ position: 'absolute', left: 0, top: tbH, width: R.w, height: gH }}>
        <MindmapGraph tk={tk} from={L.from} to={L.to} k={L.k} width={R.w} height={gH} fit={lerp(CARD_FIT, FIT, e)} maxScale={MAX_SCALE} recite={recite} />
      </div>
      <div style={{ position: 'absolute', left: 0, top: 0, width: VIEW.w, opacity: clamp((e - 0.35) / 0.5), transform: `translateY(${(1 - e) * -10}px)` }}>
        <MindmapToolbar
          tk={tk}
          structureActive={popK > 0.5}
          structurePress={pressAt(t, MM.structClick)}
          recite={reciteOn}
          recitePress={pressAt(t, MM.reciteClick)}
        />
      </div>
      {barK > 0.001 ? (
        <div style={{ position: 'absolute', left: 0, top: VIEW_TB_H, width: VIEW.w }}>
          <ReciteStatusBar tk={tk} revealed={count} total={REVEAL_ORDER.length} barK={barK} fill={fill} />
        </div>
      ) : null}
      {popK > 0.001 ? (
        <StructurePopover
          tk={tk}
          step={L.step}
          hot={hot}
          press={rowPress}
          style={{
            position: 'absolute',
            left: POP.x - VIEW.x,
            top: POP.y - VIEW.y,
            opacity: popK,
            transform: `translateY(${(1 - popK) * -6}px) scale(${0.97 + 0.03 * popK})`,
            transformOrigin: '85% 0',
          }}
        />
      ) : null}
      <MindmapCardChrome tk={tk} opacity={1 - clamp(e * 3)} />
    </div>
  );
};
