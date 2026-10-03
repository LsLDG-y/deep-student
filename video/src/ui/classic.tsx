import {
  ArrowSquareOut,
  CaretLeft,
  CaretRight,
  ChatDots,
  Cards,
  Copy,
  FileText,
  FunnelSimple,
  MagnifyingGlass,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
  NotePencil,
  Quotes,
  Sparkle,
  Terminal,
  Translate,
  X,
} from '@phosphor-icons/react';
import {
  StudyBlocksIcon,
  StudyBooksIcon,
  StudyCardsIcon,
  StudyChatIcon,
  StudyComposeIcon,
  StudyMagicWandIcon,
  StudySettingsIcon,
  StudyStackIcon,
  StudyTodoIcon,
} from '@app/components/icons/StudySidebarIcons';
import type { CSSProperties, ReactNode } from 'react';
import { font, TRAFFIC, type Tokens } from '../theme';
import { S } from '../strings';
import { PAGE_H, TextbookPage } from './TextbookPage';

export const CW = { w: 1760, h: 990, nav: 320, title: 40, panel: 720, chatX: 320, chatW: 720, panelX: 1040 } as const;
export const PANEL_HEADER = 44;
export const PDF_TOOLBAR = 36;
/** 面板里第一页纸左上角（面板左侧有 1px 边框，内容从边框内侧算起）。 */
export const PAGE_ORIGIN = { x: CW.panelX + 1 + 16, y: CW.title + PANEL_HEADER + 16 };
/** PDF 面板里每页纸的投影；k 用于漂浮页落定时渐变成同一道投影。 */
export const pageShadow = (k = 1) => `0 2px 8px hsl(214 62% 50% / ${0.1 * k})`;

export const TrafficLights = ({ gap = 8, size = 12 }: { gap?: number; size?: number }) => (
  <div style={{ display: 'flex', gap }}>
    {[TRAFFIC.close, TRAFFIC.min, TRAFFIC.zoom].map((c) => (
      <span
        key={c}
        style={{ width: size, height: size, borderRadius: '50%', background: c, boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.12)' }}
      />
    ))}
  </div>
);

const SidebarFrameIcon = ({ color }: { color: string }) => (
  <svg width={16} height={16} viewBox="0 0 16 16" fill="none">
    <rect x={1.5} y={2.5} width={13} height={11} rx={2.5} stroke={color} strokeWidth={1.3} />
    <path d="M6 2.5v11" stroke={color} strokeWidth={1.3} />
  </svg>
);

const NAV: Array<{ label: string; Icon: (p: { className?: string }) => JSX.Element }> = [
  { label: S.nav.newChat, Icon: StudyChatIcon },
  { label: S.nav.learningHub, Icon: StudyBooksIcon },
  { label: S.nav.todo, Icon: StudyTodoIcon },
  { label: S.nav.skills, Icon: StudyMagicWandIcon },
  { label: S.nav.anki, Icon: StudyStackIcon },
  { label: S.nav.flashcards, Icon: StudyCardsIcon },
  { label: S.nav.templates, Icon: StudyBlocksIcon },
  { label: S.nav.settings, Icon: StudySettingsIcon },
];

export const SESSIONS = {
  pinned: ['高数期末复习计划'],
  recent: ['线性代数：特征值的直觉', '英语作文批改 · Task 2', '有机化学反应机理整理', '概率论错题复盘', '机器学习系统 · 第 3 章'],
};

const Row = ({ tk, active, children, style }: { tk: Tokens; active?: boolean; children: ReactNode; style?: CSSProperties }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '6px 10px',
      borderRadius: 10,
      background: active ? tk.selected : 'transparent',
      fontSize: 14,
      lineHeight: '20px',
      color: tk.foreground,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      ...style,
    }}
  >
    {children}
  </div>
);

export const ClassicSidebar = ({ tk, activeTitle }: { tk: Tokens; activeTitle?: string }) => (
  <div
    style={{
      position: 'absolute',
      left: 0,
      top: 0,
      width: CW.nav,
      height: CW.h,
      background: tk.nav,
      paddingTop: CW.title + 14,
      boxSizing: 'border-box',
      fontFamily: font.ui,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', padding: '0 20px 0 22px', height: 36 }}>
      <span style={{ fontSize: 18, fontWeight: 600, color: tk.foreground, letterSpacing: '-0.01em' }}>DeepStudent</span>
      <span style={{ flex: 1 }} />
      <span style={{ display: 'flex', gap: 14, color: tk.mutedFg }}>
        <FunnelSimple size={16} />
        <MagnifyingGlass size={16} />
      </span>
    </div>
    <div style={{ padding: '10px 12px 0', display: 'flex', flexDirection: 'column', gap: 2 }}>
      {NAV.map(({ label, Icon }) => (
        <Row key={label} tk={tk}>
          <span style={{ width: 16, height: 16, display: 'inline-flex', color: tk.foreground }}>
            <Icon className="ds-icon" />
          </span>
          {label}
        </Row>
      ))}
    </div>
    <div style={{ padding: '18px 22px 6px', fontSize: 12, color: tk.mutedFg }}>{S.nav.pinned}</div>
    <div style={{ padding: '0 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
      {SESSIONS.pinned.map((s) => (
        <Row key={s} tk={tk}>
          {s}
        </Row>
      ))}
    </div>
    <div style={{ padding: '18px 22px 6px', fontSize: 12, color: tk.mutedFg }}>{S.nav.conversations}</div>
    <div style={{ padding: '0 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
      {(activeTitle ? [activeTitle, ...SESSIONS.recent] : SESSIONS.recent).map((s) => (
        <Row key={s} tk={tk} active={s === activeTitle}>
          {s}
        </Row>
      ))}
    </div>
  </div>
);

const TitleButton = ({ children, tk }: { children: ReactNode; tk: Tokens }) => (
  <span
    style={{
      width: 32,
      height: 32,
      borderRadius: 14,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: tk.mutedFg,
    }}
  >
    {children}
  </span>
);

export const ClassicTitlebar = ({ tk, title }: { tk: Tokens; title: string }) => (
  <div style={{ position: 'absolute', left: 0, top: 0, width: CW.w, height: CW.title, fontFamily: font.ui }}>
    <div style={{ position: 'absolute', left: 0, top: 0, width: CW.nav, height: CW.title, background: tk.nav }} />
    <div style={{ position: 'absolute', left: CW.nav, top: 0, right: 0, height: CW.title, background: tk.background }} />
    <div style={{ position: 'absolute', left: 20, top: 14 }}>
      <TrafficLights />
    </div>
    <div style={{ position: 'absolute', left: 68 + 12, top: 4 }}>
      <TitleButton tk={tk}>
        <SidebarFrameIcon color={tk.mutedFg} />
      </TitleButton>
    </div>
    <div style={{ position: 'absolute', left: CW.nav + 16, top: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
      <TitleButton tk={tk}>
        <CaretLeft size={16} />
      </TitleButton>
      <TitleButton tk={tk}>
        <CaretRight size={16} />
      </TitleButton>
      <TitleButton tk={tk}>
        <span style={{ width: 16, height: 16, display: 'inline-flex' }}>
          <StudyComposeIcon className="ds-icon" />
        </span>
      </TitleButton>
      <TitleButton tk={tk}>
        <Terminal size={16} />
      </TitleButton>
      <span style={{ marginLeft: 6, fontSize: 14, fontWeight: 500, color: tk.foreground }}>{title}</span>
    </div>
  </div>
);

export const PdfPanel = ({
  tk,
  scrollY = 0,
  selected = 0,
  pageLabel = 132,
  bodyHeight = CW.h - CW.title,
}: {
  tk: Tokens;
  scrollY?: number;
  selected?: number;
  pageLabel?: number;
  bodyHeight?: number;
}) => {
  const bodyH = bodyHeight - PANEL_HEADER;
  return (
    <div
      style={{
        position: 'absolute',
        left: CW.panelX,
        top: CW.title,
        width: CW.panel,
        height: bodyHeight,
        background: tk.background,
        borderLeft: `1px solid ${tk.border}`,
        boxShadow: '-12px 0 32px rgba(0,0,0,0.08)',
        fontFamily: font.ui,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          height: PANEL_HEADER,
          boxSizing: 'border-box',
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          borderBottom: `1px solid ${tk.border}`,
        }}
      >
        <FileText size={16} color={tk.mutedFg} />
        <span style={{ fontSize: 14, fontWeight: 500, color: tk.foreground }}>高等数学（第七版）上册</span>
        <span style={{ fontSize: 12, color: tk.mutedFg }}>PDF</span>
        <span style={{ flex: 1 }} />
        <span style={{ width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: tk.mutedFg }}>
          <ArrowSquareOut size={14} />
        </span>
        <span style={{ width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: tk.mutedFg }}>
          <X size={16} />
        </span>
      </div>
      <div style={{ position: 'relative', height: bodyH - PDF_TOOLBAR, overflow: 'hidden', background: tk.dark ? 'hsl(0 0% 11%)' : 'hsl(0 0% 96%)' }}>
        <div style={{ position: 'absolute', left: 16, top: 16 - scrollY }}>
          <TextbookPage page={132} selected={selected} style={{ boxShadow: pageShadow() }} />
          <FillerPage style={{ marginTop: 16 }} n={133} />
          <TextbookPage page={134} style={{ marginTop: 16, boxShadow: pageShadow() }} />
        </div>
        <div style={{ position: 'absolute', left: 0, bottom: 0, height: 3, width: `${((pageLabel - 1) / 486) * 100}%`, background: tk.primary }} />
      </div>
      <div
        style={{
          height: PDF_TOOLBAR,
          boxSizing: 'border-box',
          padding: '0 8px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          borderTop: `1px solid ${tk.border}`,
          background: tk.card,
          color: tk.mutedFg,
          fontSize: 12,
        }}
      >
        <CaretLeft size={14} />
        <span style={{ color: tk.foreground, fontVariantNumeric: 'tabular-nums' }}>{pageLabel} / 486</span>
        <CaretRight size={14} />
        <span style={{ width: 1, height: 16, background: tk.border }} />
        <MagnifyingGlassMinus size={14} />
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>100%</span>
        <MagnifyingGlassPlus size={14} />
      </div>
    </div>
  );
};

const FillerPage = ({ style, n }: { style?: CSSProperties; n: number }) => (
  <div style={{ width: 688, height: PAGE_H, background: '#fff', borderRadius: 4, position: 'relative', ...style }}>
    <div style={{ position: 'absolute', left: 64, top: 36, fontFamily: font.serif, fontSize: 13, color: '#555' }}>{n}</div>
    {Array.from({ length: 24 }, (_, i) => (
      <div
        key={i}
        style={{
          position: 'absolute',
          left: 64 + (i % 6 === 0 ? 35 : 0),
          top: 96 + i * 34,
          height: 9,
          borderRadius: 4,
          width: i % 6 === 5 ? 260 : 560 - (i % 6 === 0 ? 35 : 0),
          background: '#e6e6e6',
        }}
      />
    ))}
  </div>
);

/** 高亮色板（黄 / 绿 / 蓝 / 红 + 复制），来自 EnhancedPdfViewer HIGHLIGHT_COLORS。 */
export const HighlightMenu = ({ tk, style }: { tk: Tokens; style?: CSSProperties }) => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '6px 8px',
      background: tk.card,
      border: `1px solid ${tk.border}`,
      borderRadius: 8,
      boxShadow: '0 4px 12px hsl(214 62% 50% / 0.15)',
      ...style,
    }}
  >
    {['#fef08a', '#bbf7d0', '#bfdbfe', '#fecaca'].map((c) => (
      <span key={c} style={{ width: 24, height: 24, borderRadius: '50%', background: c, border: '2px solid transparent', boxSizing: 'border-box' }} />
    ))}
    <span style={{ width: 1, height: 18, margin: 2, background: tk.border }} />
    <span style={{ width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: tk.foreground }}>
      <Copy size={16} />
    </span>
  </div>
);

export const SELECTION_ACTIONS = [
  { label: S.sel.copy, Icon: Copy },
  { label: S.sel.explain, Icon: Sparkle },
  { label: S.sel.translate, Icon: Translate },
  { label: S.sel.saveAsNote, Icon: NotePencil },
  { label: S.sel.makeCards, Icon: Cards },
  { label: S.sel.addToChat, Icon: ChatDots },
  { label: S.sel.addAsContext, Icon: Quotes },
];

export const SelectionToolbar = ({
  tk,
  hot = -1,
  press = 0,
  style,
}: {
  tk: Tokens;
  hot?: number;
  press?: number;
  style?: CSSProperties;
}) => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      borderRadius: 8,
      border: `1px solid color-mix(in hsl, ${tk.border} 50%, transparent)`,
      background: `color-mix(in hsl, ${tk.background} ${tk.dark ? 90 : 80}%, transparent)`,
      backdropFilter: 'blur(24px)',
      boxShadow: tk.shadowFloating,
      fontFamily: font.ui,
      ...style,
    }}
  >
    {SELECTION_ACTIONS.map(({ label, Icon }, i) => (
      <span key={label} style={{ display: 'inline-flex', alignItems: 'center' }}>
        {i > 0 ? <span style={{ width: 1, height: 20, background: `color-mix(in hsl, ${tk.border} 50%, transparent)` }} /> : null}
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 10px',
            fontSize: 12,
            fontWeight: 500,
            lineHeight: '16px',
            color: `color-mix(in hsl, ${tk.foreground} 80%, transparent)`,
            background: i === hot ? `color-mix(in hsl, ${tk.accent} ${60 + press * 40}%, transparent)` : 'transparent',
            borderRadius: i === 0 ? '8px 0 0 8px' : i === SELECTION_ACTIONS.length - 1 ? '0 8px 8px 0' : 0,
          }}
        >
          <Icon size={14} />
          {label}
        </span>
      </span>
    ))}
  </div>
);

export const Toast = ({ tk, text, sub, style }: { tk: Tokens; text: string; sub?: string; style?: CSSProperties }) => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      minHeight: 28,
      padding: '4px 12px',
      borderRadius: 12,
      background: tk.card,
      border: `1px solid color-mix(in hsl, ${tk.success} 68%, transparent)`,
      boxShadow: '0 6px 14px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06)',
      fontFamily: font.ui,
      fontSize: 13,
      color: tk.foreground,
      whiteSpace: 'nowrap',
      ...style,
    }}
  >
    <span style={{ fontWeight: 500 }}>{text}</span>
    {sub ? <span style={{ color: tk.mutedFg, fontSize: 12 }}>{sub}</span> : null}
  </div>
);

export const ClassicWindow = ({
  tk,
  title,
  activeSession,
  chat,
  panel,
  chromeOpacity = 1,
  style,
}: {
  tk: Tokens;
  title: string;
  activeSession?: string;
  chat: ReactNode;
  panel?: ReactNode;
  chromeOpacity?: number;
  style?: CSSProperties;
}) => (
  <div
    style={{
      position: 'absolute',
      left: 0,
      top: 0,
      width: CW.w,
      height: CW.h,
      borderRadius: 12,
      overflow: 'hidden',
      background: tk.background,
      boxShadow: `0 0 0 0.5px ${tk.dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.14)'}, 0 30px 80px rgba(20,24,32,${tk.dark ? 0.5 : 0.18}), 0 8px 24px rgba(20,24,32,0.08)`,
      ...style,
    }}
  >
    <div style={{ opacity: chromeOpacity }}>
      <ClassicSidebar tk={tk} activeTitle={activeSession} />
      <ClassicTitlebar tk={tk} title={title} />
    </div>
    <div style={{ position: 'absolute', left: CW.chatX, top: CW.title, width: CW.chatW, height: CW.h - CW.title, overflow: 'hidden' }}>
      <div style={{ opacity: chromeOpacity, position: 'absolute', inset: 0 }}>{chat}</div>
    </div>
    {panel}
  </div>
);
