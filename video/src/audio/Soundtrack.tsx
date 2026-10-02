import { Audio, Sequence, staticFile } from 'remotion';
import { FPS, PACE } from '../lib/time';
import { FN } from '../scenes/finale/beats';
import { GROW, majorRingTimes } from '../scenes/finale/terrain';
import { MM } from '../scenes/organize/MindmapView';
import { PR } from '../scenes/practice/beats';
import { POST, RV } from '../scenes/retrieval/beats';
import { CURVES, hitAt } from '../scenes/review/MemoryCurves';
import { WK } from '../scenes/review/SceneReview';

/**
 * 配乐 + 音效。样本由 scripts/synth-score.mjs 生成（public/audio/）；
 * 音效时刻全部引用各段节拍常量，改节拍时声音跟着走。
 */
type Sfx = 'click' | 'tick' | 'whoosh-up' | 'whoosh-down' | 'pop' | 'flip' | 'boom' | 'ping' | 'note-low' | 'note-mid' | 'note-high' | 'note-top' | 'chime' | 'swell';
type Cue = [time: number, sfx: Sfx, volume: number];

const PROMPT_LEN = [...'讲透这一节：画导图、出卡片'].length;
const RATING_NOTE: Record<number, Sfx> = { 1: 'note-low', 2: 'note-mid', 3: 'note-mid', 4: 'note-high' };
const REVEAL_NOTES: Sfx[] = ['note-low', 'note-mid', 'note-high', 'note-top'];
const CURVE_NOTES: Sfx[] = ['note-low', 'note-mid', 'note-high'];

const CUES: Cue[] = [
  // 01 读懂：划选 → 引用芯片 → 打字 → 发送
  [2.0, 'whoosh-up', 0.18],
  [3.0, 'click', 0.35],
  [3.5, 'pop', 0.28],
  ...Array.from({ length: PROMPT_LEN }, (_, i): Cue => [3.98 + (i * 0.46) / PROMPT_LEN, 'tick', 0.12]),
  [4.5, 'click', 0.35],
  [4.52, 'whoosh-up', 0.22],
  // 02 看清：匹配剪辑进 3D → 扫描 → 命中 → 回到界面
  [RV.cut, 'boom', 0.62],
  ...Array.from({ length: 8 }, (_, k): Cue => [RV.scan + k * 0.085, 'ping', 0.22 * (1 - k * 0.09)]),
  [RV.select, 'note-high', 0.3],
  [RV.extract, 'whoosh-up', 0.3],
  [RV.reveal, 'whoosh-down', 0.3],
  [RV.land1, 'pop', 0.3],
  [RV.land2, 'tick', 0.22],
  [RV.land3, 'tick', 0.22],
  [9.1 + POST, 'click', 0.35],
  [9.5 + POST, 'pop', 0.22],
  [10.5 + POST, 'click', 0.35],
  // 03 整理：展开 → 切结构 → 背诵逐个揭示（上行琶音）→ 收回
  [MM.open0, 'whoosh-up', 0.3],
  [MM.structClick, 'click', 0.33],
  ...MM.steps.flatMap((s): Cue[] => [
    [s, 'click', 0.33],
    [s + 0.02, 'flip', 0.16],
  ]),
  [MM.reciteClick, 'click', 0.33],
  ...MM.reveals.map((r, i): Cue => [r, REVEAL_NOTES[i], 0.32]),
  [MM.close0, 'whoosh-down', 0.26],
  // 04 练习：卡片逐张落入 → 点「复习这批」→ 缩进 Dock → 闪卡窗口弹开 → 翻面 / 评分
  ...Array.from({ length: 12 }, (_, i): Cue => [PR.cards0 + i * PR.cardGap, 'tick', 0.1 + (i % 3) * 0.02]),
  [PR.done, 'note-mid', 0.22],
  [PR.reviewClick, 'click', 0.35],
  [PR.reviewClick + 0.04, 'whoosh-down', 0.32],
  [WK.bounce, 'pop', 0.24],
  [WK.open0, 'whoosh-up', 0.26],
  [WK.open0 + 0.04, 'pop', 0.3],
  ...WK.cards.flatMap((c): Cue[] => [
    [c.show, 'click', 0.33],
    [c.show + 0.02, 'flip', 0.32],
    [c.rate, 'click', 0.33],
    [c.rate + 0.02, RATING_NOTE[c.rating], 0.32],
  ]),
  // 05 记住：曲线越过 90% 依次点亮（最薄弱的最先）→ 切到统计页
  ...CURVES.map((_, i): Cue => [hitAt(WK.curves, i), CURVE_NOTES[i], 0.3]),
  [WK.stats, 'tick', 0.24],
  // 收尾：夜色退去 → 纸面隆起，山顶每长过一根计曲线轻响一下 → 镜头抬起看见整片地形
  [WK.out0 - 0.06, 'swell', 0.42],
  [GROW.t0 + 0.04, 'whoosh-up', 0.16],
  ...majorRingTimes().map((t, i): Cue => [t, 'ping', 0.15 - i * 0.025]),
  [FN.pull0 + 0.72, 'whoosh-up', 0.2],
  // 片尾：瞳点出现 → 飞入 Logo → 钟声 → 眨眼
  [FN.pupil0, 'tick', 0.16],
  [FN.pupilLand - 0.02, 'pop', 0.26],
  [FN.reveal0, 'chime', 0.55],
  [FN.blink, 'tick', 0.1],
];

const frameOf = (t: number) => Math.max(0, Math.round(t * PACE * FPS));

/** 整体响度目标约 −17 LUFS（网页视频常用），峰值留 ~2dB 余量。 */
const SCORE_GAIN = 0.75;
const SFX_GAIN = 1.3;

export const Soundtrack = () => (
  <>
    <Audio src={staticFile('audio/score.wav')} volume={SCORE_GAIN} />
    {CUES.map(([t, name, v], i) => (
      <Sequence key={i} from={frameOf(t)} layout="none">
        <Audio src={staticFile(`audio/${name}.wav`)} volume={Math.min(1, v * SFX_GAIN)} />
      </Sequence>
    ))}
  </>
);
