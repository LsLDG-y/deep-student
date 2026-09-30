import logoUrl from '@app-public/logo-black.svg';
import { AbsoluteFill } from 'remotion';
import { camAt, CameraView, project, type Cam, type CamKey } from '../lib/camera';
import { DUR, userBubbleSpring } from '../lib/motion';
import { clamp, ease, keys, prog, springAt } from '../lib/time';
import { S } from '../strings';
import { font, light, type Tokens } from '../theme';
import { Pupil, pathAt } from '../ui/brand';
import {
  CitationBadge,
  Composer,
  COMPOSER_W,
  PdfBadge,
  RefChip,
  TimelineRow,
  UserMessage,
} from '../ui/chat';
import {
  ClassicWindow,
  CW,
  HighlightMenu,
  PAGE_ORIGIN,
  PdfPanel,
  SelectionToolbar,
  Toast,
} from '../ui/classic';
import { MindmapCard } from '../ui/mindmap';
import { PAGE_H, SELECTION_BOX, TextbookPage, THEOREM_CHARS } from '../ui/TextbookPage';
import { Tex } from '../ui/tex';

export const REF_LABEL = '高等数学（第七版）上册 page:132';
export const PHOTOS = ['错题-中值定理.jpg', '错题-辅助函数.jpg'];
export const PROMPT = '讲透这一节：画导图、出卡片';
export const SESSION_TITLE = '讲透拉格朗日中值定理';

const THREAD_X = CW.chatX + 32;
const chatY = (localY: number) => CW.title + localY;

/** 空态布局：logo + 标题 + 居中输入框（chat-empty-composer-layout）。 */
const EMPTY = { logoTop: 360, titleTop: 432, composerTop: 500 };
const COMPOSER_H_FULL = 12 + 32 + 8 + 24 + 8 + 24 + 8 + 32 + 12;
const COMPOSER_H_DOCKED = 12 + 24 + 8 + 32 + 12;
const DOCK_TOP = CW.h - CW.title - 16 - COMPOSER_H_DOCKED;

const SEL = {
  x: PAGE_ORIGIN.x + SELECTION_BOX.x,
  y: PAGE_ORIGIN.y + SELECTION_BOX.y,
  w: SELECTION_BOX.w,
  h: SELECTION_BOX.h,
};
const TOOLBAR_Y = SEL.y + SEL.h + 8;
const TOOLBAR_W = 572;
const TOOLBAR_X = SEL.x + SEL.w / 2 - TOOLBAR_W / 2;
const QUOTE_BTN = { x: TOOLBAR_X + TOOLBAR_W - 44, y: TOOLBAR_Y + 14 };
const CHIP_SLOT = { x: THREAD_X + 16, y: chatY(EMPTY.composerTop) + 12 + 32 + 8 };
const SEND_BTN = { x: THREAD_X + COMPOSER_W - 12 - 16, y: chatY(EMPTY.composerTop) + COMPOSER_H_FULL - 12 - 16 };
const TEXT_POS = { x: THREAD_X + 120, y: chatY(EMPTY.composerTop) + 12 + 32 + 8 + 24 + 8 + 12 };

const MSG = { user: 24, assistant: 150, answer: 272, card: 500 };
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
export const OPEN_BTN = { x: CARD.x + CARD.w - 12 - 14, y: CARD.y + 6 + 14 };

export const CLASSIC_CAM: CamKey[] = [
  [0, { x: 1085, y: 560, zoom: 0.9 }],
  [2.0, { x: 1160, y: 530, zoom: 1.02 }, ease.inOutCubic],
  [2.5, { x: SEL.x + SEL.w / 2, y: SEL.y + 90, zoom: 1.85 }, ease.inOutCubic],
  [3.0, { x: SEL.x + SEL.w / 2 + 10, y: SEL.y + 104, zoom: 1.8 }, ease.linear],
  [3.6, { x: CW.w / 2, y: CW.h / 2, zoom: 1.0 }, ease.outCubic],
  [4.0, { x: CW.w / 2 - 6, y: CW.h / 2 + 4, zoom: 1.015 }, ease.linear],
  [4.35, { x: THREAD_X + COMPOSER_W / 2, y: chatY(EMPTY.composerTop) + 80, zoom: 1.6 }, ease.inOutCubic],
  [4.55, { x: THREAD_X + COMPOSER_W / 2, y: chatY(EMPTY.composerTop) + 80, zoom: 1.62 }, ease.linear],
  [5.2, { x: THREAD_X + COMPOSER_W / 2, y: chatY(170), zoom: 1.6 }, ease.inOutCubic],
  [6.3, { x: THREAD_X + COMPOSER_W / 2, y: chatY(200), zoom: 1.66 }, ease.linear],
  [6.75, { x: THREAD_X + COMPOSER_W / 2, y: chatY(230), zoom: 5.2, rx: 72 }, ease.inCubic],
  [8.0, { x: THREAD_X + COMPOSER_W / 2, y: chatY(360), zoom: 3.4, rx: -40 }, ease.linear],
  [8.5, { x: THREAD_X + COMPOSER_W / 2, y: chatY(360), zoom: 1.5, rx: 0 }, ease.outCubic],
  [8.9, { x: THREAD_X + COMPOSER_W / 2, y: chatY(372), zoom: 1.52 }, ease.linear],
  [9.45, { x: CW.panelX + CW.panel / 2, y: 470, zoom: 1.25 }, ease.inOutCubic],
  [9.85, { x: CW.panelX + CW.panel / 2 + 6, y: 476, zoom: 1.27 }, ease.linear],
  [10.2, { x: CARD.x + CARD.w / 2, y: CARD.y + CARD.h / 2 - 10, zoom: 1.6 }, ease.inOutQuint],
  [10.5, { x: CARD.x + CARD.w / 2, y: CARD.y + CARD.h / 2 - 10, zoom: 1.64 }, ease.linear],
  [11, { x: CARD.x + CARD.w / 2, y: CARD.y + CARD.h / 2 - 10, zoom: 1.9 }, ease.inCubic],
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
  const s1 = 8.05;
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
        {t >= s5 + 0.06 ? <PdfBadge page={134} tk={tk} press={Math.max(0, 1 - Math.abs(t - 9.1) / 0.1)} /> : null}
      </div>
    </div>
  );
};

const ChatColumn = ({ tk, t }: { tk: Tokens; t: number }) => {
  const sent = t >= 4.5;
  const emptyFade = 1 - prog(t, 4.5, 4.66);
  const dockK = prog(t, 4.5, 4.5 + 0.2 + 0.1, ease.brand);
  const composerTop = sent ? EMPTY.composerTop + (DOCK_TOP - EMPTY.composerTop) * dockK : EMPTY.composerTop;
  const userK = springAt(t, 4.56, userBubbleSpring);
  const asstK = prog(t, 5.5, 5.5 + DUR.messageEnter, ease.brand);
  const thinkingSec = Math.min(3, Math.floor(t - 5.5) + 1);
  const retrievalDone = t >= 8.0;
  const sweep = (start: number) => ((t - start) % 0.8) / 0.8;
  const cardEnter = (_n: unknown, i: number) => prog(t, 9.55 + i * 0.04, 9.55 + i * 0.04 + DUR.mindmapNodeEnter, ease.wbOut);
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
          <UserMessage tk={tk} text={PROMPT} attachments={PHOTOS} refs={[REF_LABEL]} />
        </div>
      ) : null}

      {t >= 5.5 ? (
        <div style={{ position: 'absolute', left: 32, top: MSG.assistant, opacity: asstK, transform: `translateY(${(1 - asstK) * 4}px)` }}>
          <TimelineRow
            tk={tk}
            kind="thinking"
            t={t}
            shimmer={!retrievalDone}
            label={retrievalDone ? S.thought(3) : S.thinking(thinkingSec)}
          />
          {t >= 6.0 ? (
            <div style={{ marginTop: 12, opacity: prog(t, 6.0, 6.15) }}>
              <TimelineRow
                tk={tk}
                kind="search"
                t={t}
                label={S.unifiedSearch}
                status={retrievalDone ? S.retrievalSummary(2) : S.searching}
                sweepK={retrievalDone ? undefined : sweep(6.0)}
              />
            </div>
          ) : null}
          {t >= 6.1 ? (
            <div style={{ marginTop: 12, opacity: prog(t, 6.1, 6.25) }}>
              <TimelineRow
                tk={tk}
                kind="search"
                t={t}
                label={S.memorySearch}
                status={retrievalDone ? S.retrievalSummary(1) : S.searching}
                sweepK={retrievalDone ? undefined : sweep(6.1)}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {t >= 8.0 ? <Answer tk={tk} t={t} /> : null}

      {t >= 9.5 ? (
        <div style={{ position: 'absolute', left: 32, top: MSG.card }}>
          <MindmapCard tk={tk} width={COMPOSER_W} enter={cardEnter} openPress={Math.max(0, 1 - Math.abs(t - 10.5) / 0.1)} />
        </div>
      ) : null}

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

export const SceneClassic = ({ t }: { t: number }) => {
  const tk = light;
  const cam = classicCam(t);
  const chrome = prog(t, 2.25, 2.7, ease.inOutCubic);
  const floatVisible = t < 2.62;
  const tilt = pageTilt(t);
  const selected = selectedChars(t);
  const toolbarK = prog(t, 2.55, 2.55 + 0.15, ease.brand);
  const selectionUi = t >= 2.55 && t < 3.25;
  const selUiFade = 1 - prog(t, 3.05, 3.25);
  const chipK = prog(t, 3.02, 3.5, ease.inOutCubic);
  const worldFade = 1 - prog(t, 6.45, 6.75) + prog(t, 8.0, 8.25);
  const panelScroll = keys(t, [
    [9.15, 0],
    [9.55, 2 * (PAGE_H + 16), ease.inOutCubic],
  ]);
  const pageLabel = t < 9.3 ? 132 : t < 9.42 ? 133 : 134;

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
    [5.3, THREAD_X + 420, chatY(360)],
    [8.6, THREAD_X + 420, chatY(360)],
    [9.0, PDF_BADGE.x, PDF_BADGE.y],
    [9.15, PDF_BADGE.x, PDF_BADGE.y],
    [9.9, OPEN_BTN.x - 60, OPEN_BTN.y + 40],
    [10.42, OPEN_BTN.x, OPEN_BTN.y],
  ]);
  const pupilScreen = project(cam, pupilWorld.x, pupilWorld.y);
  const pupilOpacity = prog(t, 0.3, 0.55) * (1 - prog(t, 6.3, 6.5)) + prog(t, 8.5, 8.7) - (t > 10.55 ? 1 : 0);

  return (
    <AbsoluteFill>
      <CameraView cam={cam}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: CW.w, height: CW.h, opacity: worldFade }}>
          <ClassicWindow
            tk={tk}
            title={t < 5.3 ? S.nav.newChat : SESSION_TITLE}
            activeSession={t >= 4.6 ? (t < 5.3 ? S.nav.newChat : SESSION_TITLE) : undefined}
            chromeOpacity={chrome}
            style={{ opacity: chrome > 0 ? 1 : 0, background: chrome < 1 ? 'transparent' : tk.background, boxShadow: chrome < 1 ? 'none' : undefined }}
            chat={<ChatColumn tk={tk} t={t} />}
            panel={
              <div style={{ opacity: chrome }}>
                <PdfPanel tk={tk} selected={selected} scrollY={panelScroll} pageLabel={pageLabel} />
              </div>
            }
          />
          {floatVisible ? (
            <div
              style={{
                position: 'absolute',
                left: PAGE_ORIGIN.x,
                top: PAGE_ORIGIN.y,
                transform: `perspective(1600px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
                transformOrigin: '50% 40%',
                boxShadow: `0 ${40 - tilt.lift * 38}px ${90 - tilt.lift * 80}px rgba(24,28,36,${0.16 - tilt.lift * 0.12})`,
                borderRadius: 4,
              }}
            >
              <TextbookPage page={132} selected={selected} />
              {t > 1.95 && t < 2.6 ? (
                <div
                  style={{
                    position: 'absolute',
                    left: SELECTION_BOX.x - 40,
                    top: SELECTION_BOX.y - 20,
                    width: SELECTION_BOX.w + 80,
                    height: SELECTION_BOX.h + 20,
                    overflow: 'hidden',
                    pointerEvents: 'none',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      transform: `translateX(${-130 + prog(t, 1.95, 2.5, ease.inOutCubic) * 260}%)`,
                      background: 'linear-gradient(105deg, transparent 38%, rgba(120,170,255,0.35) 50%, transparent 62%)',
                    }}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {selectionUi ? (
            <>
              <div style={{ position: 'absolute', left: SEL.x + SEL.w / 2 - 76, top: SEL.y - 8 - 38, opacity: toolbarK * selUiFade, transform: `translateY(${(1 - toolbarK) * 4}px)` }}>
                <HighlightMenu tk={tk} />
              </div>
              <div style={{ position: 'absolute', left: TOOLBAR_X, top: TOOLBAR_Y, opacity: toolbarK * selUiFade, transform: `translateY(${(1 - toolbarK) * 4}px)` }}>
                <SelectionToolbar tk={tk} hot={t > 2.85 ? 6 : -1} press={Math.max(0, 1 - Math.abs(t - 3.0) / 0.1)} />
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
                filter: `drop-shadow(0 ${10 * Math.sin(chipK * Math.PI)}px 18px rgba(190,18,60,0.25))`,
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
              <Toast tk={tk} text={S.refAdded} sub="高等数学（第七版）上册" />
            </div>
          ) : null}
        </div>
      </CameraView>
      <Pupil x={pupilScreen.x} y={pupilScreen.y} t={t} opacity={clamp(pupilOpacity)} clicks={[3.0, 4.5, 9.1, 10.5]} />
    </AbsoluteFill>
  );
};
