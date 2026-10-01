import { useEffect, useState } from 'react';
import { continueRender, delayRender } from 'remotion';
import { HITS } from './beats';
import { makeCardCanvas, makeHitCanvas, type CardTex, type CardType } from './textures';
import { VARIANTS } from './archive';

export type ArchiveAssets = {
  cards: Record<CardType, CardTex[]>;
  hits: CardTex[];
  hitUrls: string[];
};

const FONTS = [
  '16px "PingFang SC"',
  '500 16px "PingFang SC"',
  '600 16px "PingFang SC"',
  '16px "Songti SC"',
  '16px "Kaiti SC"',
  'italic 16px "Times New Roman"',
  '10px "SF Mono"',
];

let STORE: ArchiveAssets | null = null;
let pending: Promise<ArchiveAssets> | null = null;

/** 纸片纹理必须在字体就绪后绘制（canvas 不会回头重排），全局只画一次。 */
const load = () =>
  (pending ??= Promise.all(FONTS.map((f) => document.fonts.load(f, '中ξφ′Ag1')))
    .catch(() => undefined)
    .then(() => {
      const cards = Object.fromEntries(
        (Object.keys(VARIANTS) as CardType[]).map((type) => [
          type,
          Array.from({ length: VARIANTS[type] }, (_, v) => makeCardCanvas(type, v * 11 + type.length * 3)),
        ]),
      ) as Record<CardType, CardTex[]>;
      const hits = HITS.map((h) => makeHitCanvas(h.kind));
      STORE = { cards, hits, hitUrls: hits.map((h) => h.canvas.toDataURL('image/png')) };
      return STORE;
    }));

export const useArchiveAssets = () => {
  const [assets, setAssets] = useState<ArchiveAssets | null>(STORE);
  const [handle] = useState(() => (STORE ? null : delayRender('archive textures')));
  useEffect(() => {
    if (STORE) {
      setAssets(STORE);
      if (handle !== null) continueRender(handle);
      return;
    }
    load().then((s) => {
      setAssets(s);
      if (handle !== null) continueRender(handle);
    });
  }, [handle]);
  return assets;
};
