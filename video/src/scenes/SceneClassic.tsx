import logoUrl from '@app-public/logo-black.svg';
import { AbsoluteFill } from 'remotion';
import { camAt, CameraView, project, type Cam, type CamKey } from '../lib/camera';
import { DUR, userBubbleSpring } from '../lib/motion';
import { clamp, ease, keys, PACE, prog, springAt } from '../lib/time';
import { S } from '../strings';
import { font, light, type Tokens } from '../theme';
import { Pupil, pathAt } from '../ui/brand';
import {
  CitationBadge,
  CLASSIC_ASSISTANT_TOP,
  CLASSIC_USER_TOP,
  Composer,
  composerHeight,
  COMPOSER_W,
  CP,
  PdfBadge,
  RefChip,
  ThinkLine,
  TL_PITCH,
  ToolLine,
  UserMessage,
} from '../ui/chat';
import {
  ClassicWindow,
  CW,
  OLD_SESSIONS,
  SEL_ADD_CX,
  SEL_ADD_TO_CHAT,
  SEL_TOOLBAR_W,
  HighlightMenu,
  PAGE_ORIGIN,
  pageShadow,
  PdfPanel,
  SelectionToolbar,
  Toast,
} from '../ui/classic';
import { CARD_OPEN_BTN, MindmapCard } from '../ui/mindmap';
import type { SidebarRow } from '../ui/research';
import { PAGE_H, SELECTION_BOX, TextbookPage, THEOREM_CHARS } from '../ui/TextbookPage';
import { Tex } from '../ui/tex';
import { AnkiStackBlock, ankiActionCenter, ANKI_BLOCK } from '../ui/anki';
import { MindmapPanel, mindPanelK, MM, ORGANIZE_CLICKS, ORGANIZE_PUPIL, organizePupilOpacity } from './organize/MindmapView';
import { CHAT_SCROLL, PR } from './practice/beats';
import { CUT_ZOOM, POST, RV, STRIP, STRIP_WORLD } from './retrieval/beats';
import { Handoff } from './retrieval/Handoff';
import { Vectorize } from './retrieval/Vectorize';

/** 选区引用显示名 = 资源标题 + 「第 N 页」（selectionRef.buildSelectionDisplayName，locator page:132）。 */
export const REF_LABEL = '高等数学（第七版）上册 第 132 页';
export const PHOTOS = ['错题-中值定理.jpg', '错题-辅助函数.jpg'];
export const PROMPT = '讲透这一节：画导图、出卡片';
export const SESSION_TITLE = '讲透拉格朗日中值定理';
const SENT_AT = 4.5;

const THREAD_X = CW.chatX + 32;
const chatY = (localY: number) => CW.title + localY;

/** 空态布局：logo + 标题 + 居中输入框（chat-empty-composer-layout）。 */
const EMPTY = { logoTop: 360, titleTop: 432, composerTop: 500 };
/** 空态输入框：引用行 + 两张照片附件行；发出后贴底只剩文本框 + 底栏。 */
const COMPOSER_H_FULL = composerHeight(1, PHOTOS.length);
const COMPOSER_H_DOCKED = composerHeight(0, 0);
const DOCK_TOP = CW.h - CW.title - 16 - COMPOSER_H_DOCKED;

const SEL = {
  x: PAGE_ORIGIN.x + SELECTION_BOX.x,
  y: PAGE_ORIGIN.y + SELECTION_BOX.y,
  w: SELECTION_BOX.w,
  h: SELECTION_BOX.h,
};
const TOOLBAR_Y = SEL.y + SEL.h + 8;
const TOOLBAR_X = SEL.x + SEL.w / 2 - SEL_TOOLBAR_W / 2;
const QUOTE_BTN = { x: TOOLBAR_X + SEL_ADD_CX, y: TOOLBAR_Y + 14.5 };
const CHIP_SLOT = { x: THREAD_X + CP.padL + 7, y: chatY(EMPTY.composerTop) + CP.padY + (CP.refRow - 23.5) / 2 };
const SEND_BTN = { x: THREAD_X + COMPOSER_W - CP.padR - 14, y: chatY(EMPTY.composerTop) + COMPOSER_H_FULL - CP.padY - 14 };
const TEXT_POS = { x: THREAD_X + CP.padL + 110, y: chatY(EMPTY.composerTop) + CP.padY + CP.refRow + CP.attRow + CP.gap + 7.8 + 12 };

/** 助手块顶比原版（150）下移的量：用户消息改成「气泡 + 下方附件方块 + 复制 / 时间」后变高。 */
const SHIFT = CLASSIC_ASSISTANT_TOP - 150;
const MSG = { user: CLASSIC_USER_TOP, assistant: CLASSIC_ASSISTANT_TOP, answer: CLASSIC_ASSISTANT_TOP + 122, card: CLASSIC_ASSISTANT_TOP + 350 };
/** 卡片块上滚距离：内容整体下移 SHIFT，贴底输入框高了（88 → 98），都要多滚。 */
const SCROLL = CHAT_SCROLL + SHIFT + (COMPOSER_H_DOCKED - 88);
const ANSWER_LINES = {
  l1: MSG.answer,
  l2: MSG.answer + 24,
  formula: MSG.answer + 56,
  l3: MSG.answer + 120,
  l4: MSG.answer + 144,
  l5: MSG.answer + 180,
};
export const PDF_BADGE = { x: THREAD_X + 7 * 16 + 8 + 30, y: chatY(ANSWER_LINES.l5) + 12 };
export const CARD = { x: THREAD_X, y: chatY(MSG.card), w: COMPOSER_W, h: 280 };
export const OPEN_BTN = { x: CARD.x + CARD.w - CARD_OPEN_BTN.right, y: CARD.y + CARD_OPEN_BTN.top };
/** 点「打开」的时刻：导图随后在右侧面板打开（MM.open）。 */
const OPEN_CLICK = 10.5 + POST;

/** 导图卡之后：一句引导语 + Anki 卡片块（聊天区局部坐标，上滚前）。 */
const LEAD = '这一节的 12 张复习卡也备好了，已加入卡片库：';
const LEAD_Y = MSG.card + 280 + 16;
const ANKI_Y = LEAD_Y + 24 + 12;
/** 卡片块上滚到位后在世界坐标里的原点。 */
const ANKI_WORLD = { x: THREAD_X, y: chatY(ANKI_Y - SCROLL) };
const REVIEW_BTN = { x: ANKI_WORLD.x + ankiActionCenter('review').x, y: ANKI_WORLD.y + ankiActionCenter('review').y };

export const CLASSIC_CAM: CamKey[] = [
  [0, { x: 1085, y: 560, zoom: 0.9 }],
  [2.0, { x: 1160, y: 530, zoom: 1.02 }, ease.inOutCubic],
  [2.5, { x: SEL.x + SEL.w / 2, y: SEL.y + 90, zoom: 1.85 }, ease.inOutCubic],
  [3.0, { x: SEL.x + SEL.w / 2 + 10, y: SEL.y + 104, zoom: 1.8 }, ease.linear],
  [3.6, { x: CW.w / 2, y: CW.h / 2, zoom: 1.0 }, ease.outCubic],
  [4.0, { x: CW.w / 2 - 6, y: CW.h / 2 + 4, zoom: 1.015 }, ease.linear],
  [4.35, { x: THREAD_X + COMPOSER_W / 2, y: chatY(EMPTY.composerTop) + COMPOSER_H_FULL / 2, zoom: 1.6 }, ease.inOutCubic],
  [4.55, { x: THREAD_X + COMPOSER_W / 2, y: chatY(EMPTY.composerTop) + COMPOSER_H_FULL / 2, zoom: 1.62 }, ease.linear],
  [5.2, { x: THREAD_X + COMPOSER_W / 2, y: chatY(170 + SHIFT), zoom: 1.6 }, ease.inOutCubic],
  [5.98, { x: THREAD_X + COMPOSER_W / 2, y: chatY(196 + SHIFT), zoom: 1.65 }, ease.linear],
  // 02 看清：推向气泡看向量化（取气泡与向量条的中点），再顺着向量条匹配剪辑进 3D
  [6.32, { x: THREAD_X + COMPOSER_W / 2 + 10, y: chatY((MSG.user + 23.7 + STRIP.cy) / 2), zoom: 2.1 }, ease.inOutCubic],
  [6.62, { x: STRIP_WORLD.x, y: 262 + SHIFT, zoom: 2.28 }, ease.inOutCubic],
  [RV.cut, { x: STRIP_WORLD.x, y: STRIP_WORLD.y, zoom: CUT_ZOOM }, ease.inCubic],
  // 3D 期间相机跳到全窗机位，3D 淡出时界面已就位
  [RV.cut + 0.005, { x: CW.w / 2, y: CW.h / 2, zoom: 0.93 }, ease.linear],
  [RV.reveal, { x: CW.w / 2, y: CW.h / 2, zoom: 0.93 }, ease.linear],
  [9.0, { x: CW.w / 2, y: CW.h / 2, zoom: 1.0 }, ease.outCubic],
  [8.5 + POST - 0.2, { x: THREAD_X + COMPOSER_W / 2, y: chatY(360 + SHIFT), zoom: 1.5 }, ease.inOutCubic],
  [8.9 + POST, { x: THREAD_X + COMPOSER_W / 2, y: chatY(372 + SHIFT), zoom: 1.52 }, ease.linear],
  [9.45 + POST, { x: CW.panelX + CW.panel / 2, y: 470, zoom: 1.25 }, ease.inOutCubic],
  [9.85 + POST, { x: CW.panelX + CW.panel / 2 + 6, y: 476, zoom: 1.27 }, ease.linear],
  [10.2 + POST, { x: CARD.x + CARD.w / 2, y: CARD.y + CARD.h / 2 - 10, zoom: 1.6 }, ease.inOutQuint],
  [OPEN_CLICK, { x: CARD.x + CARD.w / 2, y: CARD.y + CARD.h / 2 - 10, zoom: 1.64 }, ease.linear],
  // 03 整理（后半）：点「打开」后导图在右侧面板打开，镜头横移过去（窗口右缘留在画内）；切结构、背诵都在面板里，逐步推近
  [MM.open + 0.5, { x: 1100, y: 372, zoom: 1.45 }, ease.inOutCubic],
  [MM.structClicks[0] - 0.1, { x: 1104, y: 370, zoom: 1.47 }, ease.linear],
  [MM.picks[1] + 0.2, { x: 1110, y: 368, zoom: 1.49 }, ease.linear],
  [MM.reciteClick + 0.16, { x: 1120, y: 386, zoom: 1.51 }, ease.inOutCubic],
  [MM.close0, { x: 1130, y: 390, zoom: 1.53 }, ease.linear],
  [MM.close1, { x: CARD.x + CARD.w / 2, y: CARD.y + CARD.h / 2 + 40, zoom: 1.45 }, ease.inOutCubic],
  // 04 练习：跟住上滚的卡片块，最后推向「复习这批」
  [PR.scroll1, { x: THREAD_X + COMPOSER_W / 2, y: ANKI_WORLD.y + 170, zoom: 1.42 }, ease.inOutCubic],
  [PR.done, { x: THREAD_X + COMPOSER_W / 2 + 4, y: ANKI_WORLD.y + 180, zoom: 1.46 }, ease.linear],
  [PR.reviewClick, { x: REVIEW_BTN.x + 40, y: CW.h - 540 / 1.62, zoom: 1.62 }, ease.inOutCubic],
];

const PRACTICE_PUPIL: Array<[number, number, number]> = [
  [PR.done + 0.02, ANKI_WORLD.x + 470, ANKI_WORLD.y + 150],
  [PR.reviewClick - 0.05, REVIEW_BTN.x, REVIEW_BTN.y],
  [PR.reviewClick + 0.3, REVIEW_BTN.x, REVIEW_BTN.y],
];

export const classicCam = (t: number): Cam => camAt(t, CLASSIC_CAM);

const selectedChars = (t: number) => Math.round(THEOREM_CHARS * prog(t, 1.98, 2.42, ease.inOutCubic));

const typedText = (t: number) => {
  const chars = [...PROMPT];
  const n = Math.floor(clamp((t - 3.98) / 0.46) * chars.length);
  return chars.slice(0, n).join('');
};

/** 流式输出：按 3 字一块原位生长（产品没有逐字渐显）。 */
const CPS = 150;
const Answer = ({ tk, t }: { tk: Tokens; t: number }) => {
  const reveal = (start: number, len: number) => Math.max(0, Math.min(len, Math.floor(((t - start) * CPS) / 3) * 3));
  const line = (s: string, start: number) => [...s].slice(0, reveal(start, [...s].length)).join('');
  const l1 = '拉格朗日中值定理说的是：只要 f(x) 在 [a, b] 上连续、在 (a, b)';
  const l2 = '内可导，曲线上就一定有一点的切线与两端连线平行';
  const l3 = '证明的关键是构造辅助函数 φ(x)，把问题化归为罗尔定理';
  const l4 = '你上次在 ξ 的取值上丢过分——它严格落在开区间内';
  const s1 = 8.05 + POST;
  const s2 = s1 + [...l1].length / CPS;
  const sf = s2 + [...l2].length / CPS + 0.03;
  const s3 = sf + 0.08;
  const s4 = s3 + [...l3].length / CPS + 0.03;
  const s5 = s4 + [...l4].length / CPS + 0.03;
  const badge = (n: number, at: number) =>
    t >= at ? <CitationBadge n={n} tk={tk} glow={1 - prog(t, at, at + 0.5, ease.outCubic)} /> : null;
  const base = { position: 'absolute' as const, left: 32, fontSize: 16, lineHeight: '24px', color: tk.foreground, whiteSpace: 'nowrap' as const };
  return (
    <div style={{ fontFamily: font.ui }}>
      <div style={{ ...base, top: ANSWER_LINES.l1 }}>{line(l1, s1)}</div>
      <div style={{ ...base, top: ANSWER_LINES.l2 }}>
        {line(l2, s2)}
        {badge(1, s2 + [...l2].length / CPS)}
        {t >= s2 + [...l2].length / CPS ? '。' : ''}
      </div>
      <div
        style={{
          ...base,
          top: ANSWER_LINES.formula,
          width: COMPOSER_W,
          textAlign: 'center',
          fontSize: 20,
          opacity: prog(t, sf, sf + 0.1),
        }}
      >
        <Tex tex="f(b)-f(a)=f'(\xi)(b-a),\quad \xi\in(a,b)" />
      </div>
      <div style={{ ...base, top: ANSWER_LINES.l3 }}>
        {line(l3, s3)}
        {badge(2, s3 + [...l3].length / CPS)}
        {t >= s3 + [...l3].length / CPS ? '。' : ''}
      </div>
      <div style={{ ...base, top: ANSWER_LINES.l4 }}>
        {line(l4, s4)}
        {badge(3, s4 + [...l4].length / CPS)}
        {t >= s4 + [...l4].length / CPS ? '。' : ''}
      </div>
      <div style={{ ...base, top: ANSWER_LINES.l5 }}>
        {line('完整证明见教材 ', s5)}
        {t >= s5 + 0.06 ? <PdfBadge page={134} tk={tk} press={Math.max(0, 1 - Math.abs(t - (9.1 + POST)) / 0.1)} /> : null}
      </div>
    </div>
  );
};

const ChatColumn = ({ tk, t }: { tk: Tokens; t: number }) => {
  const sent = t >= SENT_AT;
  const emptyFade = 1 - prog(t, 4.5, 4.66);
  const dockK = prog(t, 4.5, 4.5 + 0.2 + 0.1, ease.brand);
  const composerTop = sent ? EMPTY.composerTop + (DOCK_TOP - EMPTY.composerTop) * dockK : EMPTY.composerTop;
  const userK = springAt(t, 4.56, userBubbleSpring);
  const asstK = prog(t, 5.5, 5.5 + DUR.messageEnter, ease.brand);
  const thinkingSec = Math.floor((Math.min(t, RV.done) - 5.5) * PACE) + 1;
  const retrievalDone = t >= RV.done;
  const row0Done = t >= RV.land2;
  const row1Done = t >= RV.land3;
  const rowFlash = (at: number) => (t >= at ? Math.exp(-(t - at) * PACE * 3) : 0);
  const sweep = (start: number) => ((t - start) % 0.8) / 0.8;
  const cardEnter = (_n: unknown, i: number) => prog(t, 9.55 + POST + i * 0.04, 9.55 + POST + i * 0.04 + DUR.mindmapNodeEnter, ease.wbOut);
  const scroll = SCROLL * prog(t, PR.scroll0, PR.scroll1, ease.inOutCubic);
  const leadChars = [...LEAD];
  const leadN = Math.max(0, Math.min(leadChars.length, Math.floor(((t - PR.lead) * CPS) / 3) * 3));
  return (
    <>
      {emptyFade > 0 ? (
        <div style={{ position: 'absolute', left: 0, width: CW.chatW, top: EMPTY.logoTop, opacity: emptyFade, fontFamily: font.ui }}>
          <div style={{ width: 56, height: 56, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src={logoUrl} width={36} height={36} style={{ filter: 'brightness(0) invert(0.55)' }} />
          </div>
          <div style={{ marginTop: 16, textAlign: 'center', fontSize: 24, fontWeight: 500, color: tk.foreground }}>{S.emptyTitle}</div>
        </div>
      ) : null}

      <div style={{ position: 'absolute', inset: 0, transform: scroll > 0 ? `translateY(${-scroll}px)` : undefined }}>
      {sent ? (
        <div
          style={{
            position: 'absolute',
            left: 32,
            width: COMPOSER_W,
            top: MSG.user,
            opacity: userK,
            transform: `scale(${0.95 + 0.05 * userK})`,
            transformOrigin: 'right top',
          }}
        >
          <UserMessage tk={tk} text={PROMPT} attachments={PHOTOS} refs={[REF_LABEL]} time="21:00" />
        </div>
      ) : null}

      {t >= 5.5 ? (
        <div style={{ position: 'absolute', left: 32, top: MSG.assistant, opacity: asstK, transform: `translateY(${(1 - asstK) * 4}px)` }}>
          <ThinkLine tk={tk} t={t} shimmer={!retrievalDone} label={retrievalDone ? S.thought(thinkingSec) : S.thinking(thinkingSec)} />
          {t >= 6.0 ? (
            <div style={{ marginTop: TL_PITCH - 27.52, opacity: prog(t, 6.0, 6.15), borderRadius: 8, background: `hsl(215 72% 42% / ${0.12 * rowFlash(RV.land2)})` }}>
              <ToolLine tk={tk} label={S.unifiedSearch} done={row0Done} ms="1.1s" sweepK={row0Done ? undefined : sweep(6.0)} />
            </div>
          ) : null}
          {t >= 6.1 ? (
            <div style={{ marginTop: TL_PITCH - 27.52, opacity: prog(t, 6.1, 6.25), borderRadius: 8, background: `hsl(152 60% 36% / ${0.12 * rowFlash(RV.land3)})` }}>
              <ToolLine tk={tk} label={S.memorySearch} done={row1Done} ms="718ms" sweepK={row1Done ? undefined : sweep(6.1)} />
            </div>
          ) : null}
        </div>
      ) : null}

      {t >= 8.0 + POST ? <Answer tk={tk} t={t} /> : null}

      {t >= 9.5 + POST ? (
        <div style={{ position: 'absolute', left: 32, top: MSG.card }}>
          <MindmapCard tk={tk} width={COMPOSER_W} enter={cardEnter} openPress={Math.max(0, 1 - Math.abs(t - OPEN_CLICK) / 0.1)} />
        </div>
      ) : null}

      {leadN > 0 ? (
        <div style={{ position: 'absolute', left: 32, top: LEAD_Y, fontFamily: font.ui, fontSize: 16, lineHeight: '24px', color: tk.foreground, whiteSpace: 'nowrap' }}>
          {leadChars.slice(0, leadN).join('')}
        </div>
      ) : null}
      <div style={{ position: 'absolute', left: 32, top: ANKI_Y }}>
        <AnkiStackBlock tk={tk} t={t} reviewHover={prog(t, PR.reviewClick - 0.08, PR.reviewClick - 0.03)} reviewPress={Math.max(0, 1 - Math.abs(t - PR.reviewClick) / 0.1)} />
      </div>
      </div>

      <div style={{ position: 'absolute', left: 32, top: composerTop }}>
        <Composer
          tk={tk}
          text={sent ? '' : typedText(t)}
          caret={!sent && t >= 3.95 && Math.floor(t * 2.2) % 2 === 0}
          attachments={sent ? [] : PHOTOS}
          refs={sent ? [] : t >= 3.48 ? [REF_LABEL] : []}
          chipIn={prog(t, 3.48, 3.58)}
          focused={t >= 3.9 && !sent}
          sendPress={Math.max(0, 1 - Math.abs(t - 4.5) / 0.1)}
        />
      </div>
    </>
  );
};

/** S1 漂浮教材页的 3D 姿态。 */
const pageTilt = (t: number) => ({
  ry: keys(t, [
    [0, 8],
    [2.0, -4, ease.inOutCubic],
    [2.4, 0, ease.outCubic],
  ]),
  rx: keys(t, [
    [0, 5],
    [2.0, 1.5],
    [2.4, 0, ease.outCubic],
  ]),
  lift: keys(t, [
    [0, 0],
    [2.4, 1],
  ]),
});

export const SceneClassic = ({ t, hidePupil = false }: { t: number; hidePupil?: boolean }) => {
  const tk = light;
  const cam = classicCam(t);
  const chrome = prog(t, 2.25, 2.7, ease.inOutCubic);
  // 面板淡入到全不透明（chrome = 1）才撤掉漂浮页，交接时下面那页已经完全一样
  const floatVisible = t < 2.7;
  const tilt = pageTilt(t);
  const selected = selectedChars(t);
  const toolbarK = prog(t, 2.55, 2.55 + 0.15, ease.brand);
  const selectionUi = t >= 2.55 && t < 3.25;
  const selUiFade = 1 - prog(t, 3.05, 3.25);
  const chipK = prog(t, 3.02, 3.5, ease.inOutCubic);
  // 教材页落进面板的瞬间，面板以硬弹簧"啪"地翻到第 134 页
  const snapK = springAt(t, RV.land1 - 0.07, { stiffness: 420, damping: 26 });
  const panelScroll = 2 * (PAGE_H + 16) * snapK;
  const pageLabel = snapK < 0.3 ? 132 : snapK < 0.75 ? 133 : 134;
  const pageFlash = Math.max(
    t >= RV.land1 ? Math.exp(-(t - RV.land1) * PACE * 1.6) : 0,
    t >= 9.15 + POST ? Math.exp(-(t - 9.15 - POST) * PACE * 1.6) : 0,
  );

  const chipPos = (() => {
    const a = { x: SEL.x + SEL.w / 2 - 120, y: SEL.y + 30 };
    const b = CHIP_SLOT;
    const k = chipK;
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k - Math.sin(k * Math.PI) * 220 };
  })();

  const pupilWorld = pathAt(t, [
    [0.3, PAGE_ORIGIN.x + 640, PAGE_ORIGIN.y + 44],
    [1.7, PAGE_ORIGIN.x + 640, PAGE_ORIGIN.y + 44],
    [1.98, SEL.x + 40, SEL.y + 14],
    [2.42, SEL.x + 300, SEL.y + 50],
    [2.9, QUOTE_BTN.x, QUOTE_BTN.y],
    [3.05, QUOTE_BTN.x, QUOTE_BTN.y],
    [3.5, CHIP_SLOT.x + 120, CHIP_SLOT.y + 12],
    [3.95, TEXT_POS.x, TEXT_POS.y],
    [4.4, SEND_BTN.x, SEND_BTN.y],
    [4.6, SEND_BTN.x, SEND_BTN.y],
    [5.3, THREAD_X + 420, chatY(360 + SHIFT)],
    [8.6 + POST, THREAD_X + 420, chatY(360 + SHIFT)],
    [9.0 + POST, PDF_BADGE.x, PDF_BADGE.y],
    [9.15 + POST, PDF_BADGE.x, PDF_BADGE.y],
    [9.9 + POST, OPEN_BTN.x - 60, OPEN_BTN.y + 40],
    [10.42 + POST, OPEN_BTN.x, OPEN_BTN.y],
  ]);
  const practice = t >= PR.scroll0;
  const organize = t > OPEN_CLICK && !practice;
  // 新会话是草稿、不进侧栏；发出后顶到「对话」最上面显示「未命名会话」+ 转圈，首轮（到卡片生成完）结束后自动起名
  const titled = t >= PR.done + 0.12;
  const sessions: SidebarRow[] =
    t < SENT_AT
      ? OLD_SESSIONS
      : [{ title: titled ? SESSION_TITLE : '未命名会话', time: '刚刚', active: true, streaming: !titled, enter: prog(t, SENT_AT + 0.01, SENT_AT + 0.085) }, ...OLD_SESSIONS];
  const trackWorld = practice ? pathAt(t, PRACTICE_PUPIL) : organize ? pathAt(t, [[OPEN_CLICK, OPEN_BTN.x, OPEN_BTN.y], ...ORGANIZE_PUPIL]) : pupilWorld;
  const pupilScreen = project(cam, trackWorld.x, trackWorld.y);
  const pupilOpacity = practice
    ? prog(t, PR.done, PR.done + 0.1)
    : organize
      ? organizePupilOpacity(t)
      : prog(t, 0.3, 0.55) * (1 - prog(t, 5.9, 6.1)) + prog(t, 8.5 + POST, 8.7 + POST);
  const mindK = mindPanelK(t);

  return (
    <AbsoluteFill>
      <CameraView cam={cam}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: CW.w, height: CW.h }}>
          <ClassicWindow
            tk={tk}
            t={t}
            title={titled ? SESSION_TITLE : undefined}
            terminal={t >= SENT_AT}
            sessions={sessions}
            chromeOpacity={chrome}
            style={{ opacity: chrome > 0 ? 1 : 0, background: chrome < 1 ? 'transparent' : tk.background, boxShadow: chrome < 1 ? 'none' : undefined }}
            chat={<ChatColumn tk={tk} t={t} />}
            panel={
              <div style={{ opacity: chrome }}>
                {mindK < 1 ? <PdfPanel tk={tk} selected={selected} scrollY={panelScroll} pageLabel={pageLabel} /> : null}
                <MindmapPanel t={t} tk={tk} />
              </div>
            }
          />
          {floatVisible ? (
            <div
              style={{
                position: 'absolute',
                left: PAGE_ORIGIN.x,
                top: PAGE_ORIGIN.y,
                // 落平之后不再走 3D 合成层：否则文字栅格化与下面面板里的同一页对不齐，交接那一帧会跳
                transform: tilt.rx === 0 && tilt.ry === 0 ? undefined : `perspective(1600px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
                transformOrigin: '50% 40%',
                // 落定时正好收成面板里那一页的投影
                boxShadow: `0 ${40 - tilt.lift * 38}px ${90 - tilt.lift * 80}px rgba(24,28,36,${0.16 * (1 - tilt.lift)}), ${pageShadow(tilt.lift)}`,
                borderRadius: 4,
              }}
            >
              <TextbookPage page={132} selected={selected} />
            </div>
          ) : null}

          {selectionUi ? (
            <>
              <div style={{ position: 'absolute', left: SEL.x + SEL.w / 2 - 76, top: SEL.y - 8 - 38, opacity: toolbarK * selUiFade, transform: `translateY(${(1 - toolbarK) * 4}px)` }}>
                <HighlightMenu tk={tk} />
              </div>
              <div style={{ position: 'absolute', left: TOOLBAR_X, top: TOOLBAR_Y, opacity: toolbarK * selUiFade, transform: `translateY(${(1 - toolbarK) * 4}px)` }}>
                <SelectionToolbar tk={tk} hot={t > 2.85 ? SEL_ADD_TO_CHAT : -1} press={Math.max(0, 1 - Math.abs(t - 3.0) / 0.1)} />
              </div>
            </>
          ) : null}

          {t >= 3.0 && t < 3.52 ? (
            <div
              style={{
                position: 'absolute',
                left: chipPos.x,
                top: chipPos.y,
                transform: `scale(${1 + Math.sin(chipK * Math.PI) * 0.35})`,
                transformOrigin: '0 50%',
                filter: `drop-shadow(0 ${10 * Math.sin(chipK * Math.PI)}px 16px hsl(220 25% 12% / ${0.22 * Math.sin(chipK * Math.PI)}))`,
              }}
            >
              <RefChip label={REF_LABEL} tk={tk} />
            </div>
          ) : null}

          {t >= 3.1 && t < 4.3 ? (
            <div
              style={{
                position: 'absolute',
                left: CW.w / 2,
                top: 54,
                transform: `translate(-50%, ${(1 - prog(t, 3.1, 3.32, ease.brand)) * -10}px) scale(${0.98 + 0.02 * prog(t, 3.1, 3.32)})`,
                opacity: prog(t, 3.1, 3.2) * (1 - prog(t, 4.1, 4.3)),
              }}
            >
              <Toast tk={tk} text={S.refAdded} sub={REF_LABEL} />
            </div>
          ) : null}

          {pageFlash > 0.01 ? (
            <div
              style={{
                position: 'absolute',
                left: PAGE_ORIGIN.x - 6,
                top: PAGE_ORIGIN.y + 2 * (PAGE_H + 16) - panelScroll + 80,
                width: 688 + 12,
                height: 400,
                borderRadius: 8,
                background: `hsl(215 80% 55% / ${0.12 * pageFlash})`,
                boxShadow: `inset 3px 0 0 hsl(215 72% 42% / ${pageFlash})`,
                clipPath: `inset(${Math.max(0, CW.title + 44 - (PAGE_ORIGIN.y + 2 * (PAGE_H + 16) - panelScroll + 80))}px 0 0 0)`,
              }}
            />
          ) : null}

          <Vectorize t={t} />
        </div>
      </CameraView>
      <Handoff t={t} cam={cam} />
      <Pupil x={pupilScreen.x} y={pupilScreen.y} t={t} opacity={hidePupil ? 0 : clamp(pupilOpacity)} clicks={[3.0, 4.5, 9.1 + POST, OPEN_CLICK, ...ORGANIZE_CLICKS, PR.reviewClick]} />
    </AbsoluteFill>
  );
};
