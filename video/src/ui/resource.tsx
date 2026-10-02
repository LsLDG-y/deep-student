import { ArrowClockwise, ClockCounterClockwise, GearSix, MagnifyingGlass, Plus, Rows, type Icon } from '@phosphor-icons/react';
import type { CSSProperties, ReactNode } from 'react';
import { S } from '../strings';
import type { Tokens } from '../theme';

/**
 * 作文批改 / 翻译共用的 ResourceAppWorkspace 外壳：左栏资源列表 + 「选择一个项目」空态。
 * 几何取自真机 DOM 取证（video/out/cap/probe-x*.txt、probe-y*.txt，窗口坐标，含 1px 边框与 38px 标题栏）。
 */
export const MAIN_X = 273;
export const MAIN_W = 606;

/** 窗口坐标 → 内容区坐标（1px 边框 + 38px 标题栏）。 */
export const at = (x: number, y: number): CSSProperties => ({ position: 'absolute', left: x - 1, top: y - 39 });
export const mix = (c: string, pct: number) => `color-mix(in srgb, ${c} ${pct}%, transparent)`;
/** 按钮悬停底（DsButton ghost hover） */
export const HOVER_BG = 'hsl(0 0% 91%)';

export const Btn = ({ style, children }: { style: CSSProperties; children?: ReactNode }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', boxSizing: 'border-box', whiteSpace: 'nowrap', ...style }}>{children}</span>
);

export const ResourceSidebar = ({
  tk,
  winH,
  icon: AppIcon,
  title,
  items,
  fresh,
  settings,
}: {
  tk: Tokens;
  winH: number;
  icon: Icon;
  title: string;
  items: string[];
  /** 第一行是刚新建、处于选中态的项目 */
  fresh: boolean;
  settings: string;
}) => {
  const foot = winH - 23;
  const setTop = fresh ? winH - 66 : winH - 83.4;
  return (
    <>
      <span style={{ ...at(11, 46), width: 26, height: 26, boxSizing: 'border-box', borderRadius: 6, background: 'rgba(255,255,255,0.72)', border: '1px solid rgba(224,224,224,0.7)' }} />
      <AppIcon size={18} weight="duotone" color={tk.mutedFg} style={{ ...at(15, 50) }} />
      <span style={{ ...at(44, 50.6), fontSize: 12, fontWeight: 600, lineHeight: '16.8px', color: tk.foreground }}>{title}</span>
      <Plus size={14} color={tk.mutedFg} style={{ ...at(245.5, 52) }} />
      <Btn style={{ ...at(9, 79), width: 255, height: 30, borderRadius: 5, background: mix(tk.foreground, 5), border: '1px solid rgba(224,224,224,0.6)', padding: '0 0 0 7px', gap: 7, fontSize: 13, color: mix(tk.mutedFg, 70) }}>
        <MagnifyingGlass size={14} color={tk.mutedFg} />
        {S.res.search}
      </Btn>
      <Btn style={{ ...at(7, 116), width: 259, height: 32, borderRadius: 14, background: mix(tk.foreground, 10), padding: '0 9.8px', gap: 8.7, fontSize: 14, color: tk.foreground }}>
        <Rows size={14} />
        <span style={{ flex: 1 }}>{S.res.all}</span>
        <span style={{ fontSize: 12 }}>{items.length}</span>
      </Btn>
      <Btn style={{ ...at(7, 150), width: 259, height: 32, borderRadius: 14, padding: '0 9.8px', gap: 8.7, fontSize: 14, color: tk.foreground }}>
        <ClockCounterClockwise size={14} />
        {S.res.recent}
      </Btn>
      <span style={{ ...at(1, 187), width: 271, height: 1, background: mix(tk.border, 70) }} />
      {items.length === 0 ? (
        <span style={{ ...at(1, 244.6), width: 271, textAlign: 'center', fontSize: 12, lineHeight: '16.8px', color: tk.mutedFg }}>{S.res.empty}</span>
      ) : null}
      {items.map((name, i) => (
        <Btn key={`${name}-${i}`} style={{ ...at(1, 188 + 32 * i), width: 271, height: 32, borderRadius: 14, background: fresh && i === 0 ? mix(tk.foreground, 10) : 'transparent', padding: '0 0 0 9.3px', gap: 8.2, fontSize: 14, color: tk.foreground }}>
          <AppIcon size={15} weight="duotone" />
          {name}
        </Btn>
      ))}
      <span style={{ ...at(1, setTop), width: 271, height: 1, background: 'rgba(224,224,224,0.7)' }} />
      <Btn style={{ ...at(7, setTop + 6), width: 259, height: 32, borderRadius: 14, padding: '0 9.8px', gap: 8.7, fontSize: 14, color: tk.foreground, opacity: fresh ? 1 : 0.5 }}>
        <GearSix size={14} />
        {settings}
      </Btn>
      {!fresh ? <span style={{ ...at(15, setTop + 38), fontSize: 11, lineHeight: '17.4px', color: tk.mutedFg }}>{S.res.needSelection}</span> : null}
      <span style={{ ...at(1, foot), width: 271, height: 22, boxSizing: 'border-box', background: 'rgba(240,240,240,0.24)', borderTop: `1px solid ${tk.border}` }} />
      <span style={{ ...at(10, foot + 4.5), fontSize: 10, lineHeight: '14px', color: tk.mutedFg }}>{S.res.itemCount(items.length)}</span>
      <ArrowClockwise size={13} color={tk.mutedFg} style={{ ...at(250.5, foot + 5) }} />
      <span style={{ ...at(272, 39), width: 1, height: winH - 40, background: tk.border }} />
    </>
  );
};

/** 「选择一个项目」空态：图标（thin）+ 标题 + 说明 +「＋ 新建…」。 */
export const ResourceHome = ({
  tk,
  icon: AppIcon,
  label,
  btn,
  hover,
  press,
}: {
  tk: Tokens;
  icon: Icon;
  label: string;
  /** 新建按钮的 x 与宽（随文案长度变化） */
  btn: { x: number; w: number };
  hover: boolean;
  press: number;
}) => (
  <>
    <AppIcon size={38} weight="thin" color={tk.mutedFg} style={{ ...at(557, 267.4) }} />
    <span style={{ ...at(MAIN_X, 313.4), width: MAIN_W, textAlign: 'center', fontSize: 13, fontWeight: 500, lineHeight: '18.2px', color: tk.foreground }}>{S.res.selectTitle}</span>
    <span style={{ ...at(MAIN_X, 339.6), width: MAIN_W, textAlign: 'center', fontSize: 12, lineHeight: '16.8px', color: tk.mutedFg }}>{S.res.selectHint}</span>
    <Btn
      style={{
        ...at(btn.x, 364.4),
        width: btn.w,
        height: 26.3,
        borderRadius: 9,
        padding: '0 0 0 11.5px',
        gap: 6,
        fontSize: 11,
        fontWeight: 500,
        color: hover ? tk.foreground : tk.mutedFg,
        background: hover ? HOVER_BG : 'transparent',
        transform: `scale(${1 - 0.03 * (hover ? press : 0)})`,
      }}
    >
      <Plus size={15} />
      {label}
    </Btn>
  </>
);

/** 「＋ 新建…」按钮中心（窗口坐标）：两种文案宽度下都居中在主区。 */
export const RESOURCE_NEW_PT = { x: MAIN_X + MAIN_W / 2, y: 377.6 } as const;
