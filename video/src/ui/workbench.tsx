import { ChartBar, GearSix, MagnifyingGlass, SquaresFour, Stack, Timer } from '@phosphor-icons/react';
import chatIcon from '@app/features/workbench/icons/app-icons/chat.svg';
import essayIcon from '@app/features/workbench/icons/app-icons/essay.svg';
import examIcon from '@app/features/workbench/icons/app-icons/exam.svg';
import filesIcon from '@app/features/workbench/icons/app-icons/files.svg';
import flashcardsIcon from '@app/features/workbench/icons/app-icons/flashcards.svg';
import mindmapIcon from '@app/features/workbench/icons/app-icons/mindmap.svg';
import notesIcon from '@app/features/workbench/icons/app-icons/notes.svg';
import pomodoroIcon from '@app/features/workbench/icons/app-icons/pomodoro.svg';
import settingsIcon from '@app/features/workbench/icons/app-icons/settings.svg';
import textbookIcon from '@app/features/workbench/icons/app-icons/textbook.svg';
import todoIcon from '@app/features/workbench/icons/app-icons/todo.svg';
import translationIcon from '@app/features/workbench/icons/app-icons/translation.svg';
import mountainMist from '@app-public/wallpapers/study-os/mountain-mist.webp';
import type { CSSProperties, ReactNode } from 'react';
import { Img } from 'remotion';
import { S } from '../strings';
import { font, TRAFFIC, type Tokens } from '../theme';
import { LogoMark } from './brand';
import { HEIGHT, WIDTH } from '../lib/time';

/**
 * 工作台（OS 模式）外壳的转写，来源：
 * src/features/workbench/styles/workbench.tokens.css（Liquid Glass token，暗色档）、
 * workbench.css（.wb-window / .wb-titlebar / .wb-dock）、Dock.css、StatusBar.css、icons/appIcons.tsx。
 */
export const WB = { menubar: 40, titlebar: 38, radius: 20, dockItem: 44, dockGap: 4, dockPadX: 8, dockPadY: 4, dockBottom: 10 } as const;

const glass = (tk: Tokens, strong = false) => ({
  bg: tk.dark ? `hsl(0 0% 12% / ${strong ? 0.42 : 0.32})` : `hsl(0 0% 99% / ${strong ? 0.28 : 0.2})`,
  blur: tk.dark ? `blur(${strong ? 24 : 18}px) saturate(1.8) brightness(0.92)` : `blur(${strong ? 24 : 18}px) saturate(1.8) brightness(1.08)`,
  border: tk.dark ? 'hsl(0 0% 18% / 0.7)' : 'hsl(0 0% 88% / 0.52)',
  highlight: tk.dark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.55)',
  sheen: tk.dark
    ? 'linear-gradient(118deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.035) 34%, rgba(255,255,255,0) 58%), radial-gradient(130% 70% at 50% 102%, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0) 48%)'
    : 'linear-gradient(118deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.06) 34%, rgba(255,255,255,0) 58%), radial-gradient(130% 70% at 50% 102%, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 48%)',
});

/**
 * 壁纸：产品默认预设 mountain-mist（CC0 实拍，见 public/wallpapers/study-os/ATTRIBUTION.md）。
 * night = 1 是晚上 21:30：压暗、降饱和、冷色；night = 0 是白天原片。
 * 其上叠产品对应明暗档的 scrim、压暗层（imageDim 0.06）与暗角（WallpaperLayer.css）。
 */
export const Wallpaper = ({ drift = 0, night = 1, style }: { drift?: number; night?: number; style?: CSSProperties }) => {
  const mix = (day: number, nightV: number) => day + (nightV - day) * night;
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: 'hsl(220 14% 7%)', ...style }}>
      <Img
        src={mountainMist}
        style={{
          position: 'absolute',
          left: -48,
          top: -27,
          width: WIDTH + 96,
          height: HEIGHT + 54,
          objectFit: 'cover',
          objectPosition: 'center 52%',
          filter: `brightness(${mix(1, 0.42)}) saturate(${mix(1, 0.55)}) contrast(${mix(1, 1.08)})`,
          transform: `translate(${drift * -16}px, ${drift * 7}px)`,
        }}
      />
      <div style={{ position: 'absolute', inset: 0, background: 'hsl(214 46% 30% / 0.5)', mixBlendMode: 'multiply', opacity: night }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, hsl(0 0% 9% / 0.10) 0%, hsl(0 0% 9% / 0.30) 100%)', opacity: night }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, hsl(0 0% 100% / 0.06) 0%, hsl(0 0% 100% / 0.18) 100%)', opacity: 1 - night }} />
      <div style={{ position: 'absolute', inset: 0, background: 'rgb(0 0 0)', opacity: 0.06 * (1 - night) }} />
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(135% 110% at 50% 42%, transparent ${mix(58, 55)}%, hsl(0 0% 0% / ${mix(0.18, 0.34)}) 100%)` }} />
    </div>
  );
};

// ── 菜单栏 ─────────────────────────────────────────────
const MenuItem = ({ children, strong = false, tk }: { children: ReactNode; strong?: boolean; tk: Tokens }) => (
  <span
    style={{
      height: 26,
      padding: '0 7px',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      borderRadius: 6,
      fontSize: 12,
      fontWeight: strong ? 700 : 500,
      color: strong ? tk.foreground : `color-mix(in hsl, ${tk.foreground} 82%, transparent)`,
      whiteSpace: 'nowrap',
    }}
  >
    {children}
  </span>
);

export const MenuBar = ({ tk, app, due, clock, focus, style }: { tk: Tokens; app: string; due: number; clock: string; focus: string; style?: CSSProperties }) => {
  const g = glass(tk);
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: WIDTH,
        height: WB.menubar,
        boxSizing: 'border-box',
        padding: '0 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: `${g.sheen}, ${tk.dark ? 'hsl(0 0% 12% / 0.18)' : 'hsl(0 0% 99% / 0.10)'}`,
        backdropFilter: g.blur,
        borderBottom: `1px solid ${tk.dark ? 'hsl(0 0% 18% / 0.4)' : 'hsl(0 0% 88% / 0.3)'}`,
        fontFamily: font.ui,
        ...style,
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
        <MenuItem tk={tk}>
          <LogoMark id="wb-menubar" size={16} color={tk.foreground} pupilColor={tk.foreground} />
        </MenuItem>
        <MenuItem tk={tk} strong>
          {app}
        </MenuItem>
        <MenuItem tk={tk}>文件</MenuItem>
        <MenuItem tk={tk}>编辑</MenuItem>
        <MenuItem tk={tk}>窗口</MenuItem>
      </span>
      <span style={{ flex: 1 }} />
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
        <MenuItem tk={tk}>
          <MagnifyingGlass size={15} weight="bold" />
        </MenuItem>
        <MenuItem tk={tk}>
          <Timer size={14} weight="duotone" />
          <span style={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{focus}</span>
        </MenuItem>
        <MenuItem tk={tk}>
          <Stack size={14} weight="duotone" />
          <span style={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{due}</span>
        </MenuItem>
        <MenuItem tk={tk}>
          <ChartBar size={14} weight="duotone" />
          <span style={{ fontWeight: 500 }}>1</span>
        </MenuItem>
        <MenuItem tk={tk}>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{clock}</span>
        </MenuItem>
        <MenuItem tk={tk}>
          <GearSix size={15} weight="bold" />
        </MenuItem>
        <MenuItem tk={tk}>
          <SquaresFour size={14} weight="duotone" />
        </MenuItem>
      </span>
    </div>
  );
};

// ── Dock ──────────────────────────────────────────────
type DockEntry = { id: string; icon?: string; label: string } | 'sep';
export const DOCK: DockEntry[] = [
  { id: 'chat', icon: chatIcon, label: S.apps.chat },
  { id: 'notes', icon: notesIcon, label: S.apps.note },
  { id: 'textbook', icon: textbookIcon, label: S.apps.textbook },
  { id: 'mindmap', icon: mindmapIcon, label: '思维导图' },
  { id: 'flashcards', icon: flashcardsIcon, label: S.apps.flashcards },
  { id: 'exam', icon: examIcon, label: S.apps.exam },
  { id: 'translation', icon: translationIcon, label: S.apps.translation },
  { id: 'essay', icon: essayIcon, label: S.apps.essay },
  { id: 'todo', icon: todoIcon, label: S.apps.todo },
  { id: 'pomodoro', icon: pomodoroIcon, label: S.apps.pomodoro },
  'sep',
  { id: 'files', icon: filesIcon, label: S.apps.files },
  { id: 'settings', icon: settingsIcon, label: S.apps.settings },
  'sep',
  { id: 'apps', label: S.apps.sectionApps },
];

const SEP_W = 1 + 8;
const dockWidth = () =>
  WB.dockPadX * 2 + DOCK.reduce((w, e, i) => w + (e === 'sep' ? SEP_W : WB.dockItem) + (i > 0 ? WB.dockGap : 0), 0);
export const DOCK_W = dockWidth();
export const DOCK_H = WB.dockItem + WB.dockPadY * 2;
export const DOCK_TOP = HEIGHT - WB.dockBottom - DOCK_H;

/** Dock 图标中心（屏幕坐标）。 */
export const dockIconCenter = (id: string) => {
  let x = (WIDTH - DOCK_W) / 2 + WB.dockPadX;
  for (let i = 0; i < DOCK.length; i++) {
    const e = DOCK[i];
    if (i > 0) x += WB.dockGap;
    if (e === 'sep') {
      x += SEP_W;
      continue;
    }
    if (e.id === id) return { x: x + WB.dockItem / 2, y: DOCK_TOP + WB.dockPadY + WB.dockItem / 2 };
    x += WB.dockItem;
  }
  return { x: WIDTH / 2, y: DOCK_TOP };
};

export const AppIcon = ({ src, size }: { src: string; size: number }) => (
  <span
    style={{
      width: size,
      height: size,
      borderRadius: '22.5%',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(180deg, #ffffff, #eef1f5)',
      boxShadow: 'inset 0 0 0 0.5px rgba(31, 41, 55, 0.16), 0 1px 2px rgba(15, 23, 42, 0.25)',
    }}
  >
    <img src={src} style={{ width: '76%', height: '76%', objectFit: 'contain' }} />
  </span>
);

/** 悬停气泡（Dock.css .wb-dock-tip：玻璃底、带箭头，悬停 350ms 后浮现，图标本身不放大）。 */
const DockTip = ({ tk, label, k }: { tk: Tokens; label: string; k: number }) => {
  const g = glass(tk, true);
  return (
    <span
      style={{
        position: 'absolute',
        left: '50%',
        bottom: 'calc(100% + 12px)',
        padding: '4px 11px',
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 500,
        lineHeight: 1.4,
        whiteSpace: 'nowrap',
        color: tk.foreground,
        background: `${g.sheen}, ${tk.dark ? 'hsl(0 0% 14% / 0.82)' : 'hsl(0 0% 99% / 0.82)'}`,
        backdropFilter: g.blur,
        border: `1px solid ${g.border}`,
        boxShadow: `inset 0 1px 0 ${g.highlight}, 0 6px 18px hsl(0 0% 0% / 0.16)`,
        opacity: k,
        transform: `translate(-50%, ${(1 - k) * 5}px) scale(${0.94 + 0.06 * k})`,
        transformOrigin: '50% 100%',
      }}
    >
      {label}
    </span>
  );
};

export const Dock = ({
  tk,
  running = [],
  bounce = {},
  tip,
  press = {},
  style,
}: {
  tk: Tokens;
  running?: string[];
  /** 每个图标的弹跳位移（px，向上为正）。 */
  bounce?: Record<string, number>;
  /** 正在悬停的图标与气泡进度 */
  tip?: { id: string; k: number };
  /** 按压压暗（0–1） */
  press?: Record<string, number>;
  style?: CSSProperties;
}) => {
  const g = glass(tk, true);
  return (
    <div
      style={{
        position: 'absolute',
        left: (WIDTH - DOCK_W) / 2,
        top: DOCK_TOP,
        width: DOCK_W,
        height: DOCK_H,
        boxSizing: 'border-box',
        padding: `${WB.dockPadY}px ${WB.dockPadX}px`,
        display: 'flex',
        alignItems: 'center',
        gap: WB.dockGap,
        borderRadius: 22,
        background: `${g.sheen}, ${g.bg}`,
        backdropFilter: g.blur,
        border: `1px solid ${g.border}`,
        boxShadow: tk.dark
          ? `inset 0 1px 0 ${g.highlight}, 0 0 0 0.5px rgba(0,0,0,0.40), 0 20px 50px rgba(0,0,0,0.50), 0 5px 14px rgba(0,0,0,0.32)`
          : `inset 0 1px 0 ${g.highlight}, 0 0 0 0.5px rgba(0,0,0,0.08), 0 18px 44px rgba(0,0,0,0.2), 0 4px 12px rgba(0,0,0,0.1)`,
        ...style,
      }}
    >
      {DOCK.map((e, i) =>
        e === 'sep' ? (
          <span key={`sep${i}`} style={{ width: 1, height: 32, margin: '0 4px', background: tk.dark ? 'hsl(0 0% 18% / 0.8)' : 'hsl(0 0% 88% / 0.8)' }} />
        ) : (
          <span key={e.id} style={{ position: 'relative', width: WB.dockItem, height: WB.dockItem, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            {tip && tip.id === e.id && tip.k > 0.001 ? <DockTip tk={tk} label={e.label} k={tip.k} /> : null}
            <span style={{ display: 'inline-flex', transform: `translateY(${-(bounce[e.id] ?? 0)}px)`, filter: press[e.id] ? `brightness(${1 - 0.18 * press[e.id]})` : undefined }}>
              {e.icon ? (
                <AppIcon src={e.icon} size={42} />
              ) : (
                <span
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: '22.5%',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: tk.dark ? 'hsl(0 0% 100% / 0.1)' : 'hsl(0 0% 0% / 0.06)',
                    color: tk.foreground,
                  }}
                >
                  <SquaresFour size={22} weight="duotone" />
                </span>
              )}
            </span>
            {running.includes(e.id) ? (
              <span style={{ position: 'absolute', left: '50%', bottom: -5, width: 4, height: 4, marginLeft: -2, borderRadius: '50%', background: `color-mix(in hsl, ${tk.foreground} 72%, transparent)` }} />
            ) : null}
          </span>
        ),
      )}
    </div>
  );
};

// ── 窗口 ──────────────────────────────────────────────
export const Traffic = ({ idle = false }: { idle?: boolean }) => (
  <span style={{ display: 'inline-flex', gap: 8 }}>
    {[
      [TRAFFIC.close, '#e0443e'],
      [TRAFFIC.min, '#d89e24'],
      [TRAFFIC.zoom, '#1dad2c'],
    ].map(([c, b]) => (
      <span key={c} style={{ width: 12, height: 12, boxSizing: 'border-box', borderRadius: '50%', background: idle ? 'hsl(0 0% 34%)' : c, border: `1px solid ${idle ? 'hsl(0 0% 40%)' : b}` }} />
    ))}
  </span>
);

export const WbWindow = ({
  tk,
  rect,
  title,
  focused = true,
  children,
  style,
}: {
  tk: Tokens;
  rect: { x: number; y: number; w: number; h: number };
  title: string;
  focused?: boolean;
  children: ReactNode;
  style?: CSSProperties;
}) => {
  const g = glass(tk);
  const shadow = tk.dark
    ? focused
      ? 'inset 0 1px 0 rgba(255,255,255,0.10), 0 0 0 0.5px rgba(0,0,0,0.42), 0 28px 80px rgba(0,0,0,0.56), 0 9px 26px rgba(0,0,0,0.36)'
      : 'inset 0 1px 0 rgba(255,255,255,0.10), 0 0 0 0.5px rgba(0,0,0,0.34), 0 12px 32px rgba(0,0,0,0.38), 0 3px 10px rgba(0,0,0,0.26)'
    : 'inset 0 1px 0 rgba(255,255,255,0.55), 0 0 0 0.5px rgba(0,0,0,0.10), 0 26px 76px rgba(0,0,0,0.27), 0 9px 24px rgba(0,0,0,0.15)';
  return (
    <div
      style={{
        position: 'absolute',
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        boxSizing: 'border-box',
        borderRadius: WB.radius,
        background: tk.card,
        border: `1px solid ${tk.dark ? 'hsl(0 0% 18% / 0.85)' : 'hsl(0 0% 88% / 0.72)'}`,
        boxShadow: shadow,
        overflow: 'hidden',
        fontFamily: font.ui,
        ...style,
      }}
    >
      <div
        style={{
          position: 'relative',
          height: WB.titlebar,
          boxSizing: 'border-box',
          padding: '0 12px',
          display: 'flex',
          alignItems: 'center',
          background: `${g.sheen}, color-mix(in hsl, ${tk.card} ${tk.dark ? 45 : 55}%, transparent)`,
          borderBottom: `1px solid color-mix(in hsl, ${tk.border} ${tk.dark ? 60 : 45}%, transparent)`,
          fontSize: 13,
          fontWeight: 500,
          color: focused ? tk.foreground : tk.mutedFg,
        }}
      >
        <Traffic idle={!focused} />
        <span style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center', pointerEvents: 'none' }}>{title}</span>
        <span style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 1, background: `linear-gradient(90deg, transparent 0%, ${g.highlight} 16%, ${g.highlight} 84%, transparent 100%)` }} />
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: WB.titlebar, bottom: 0 }}>{children}</div>
    </div>
  );
};
