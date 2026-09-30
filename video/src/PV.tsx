import { AbsoluteFill } from 'remotion';
import './global.css';
import { useTime } from './lib/time';
import { Supers } from './overlays/Supers';
import { KnowledgeSea } from './scenes/KnowledgeSea';
import { SceneClassic } from './scenes/SceneClassic';
import { brand } from './theme';
import { PaperGrid } from './ui/brand';
import { useFontsReady } from './ui/tex';

export const PV = () => {
  useFontsReady();
  const t = useTime();
  return (
    <AbsoluteFill style={{ background: brand.paper, overflow: 'hidden' }}>
      <PaperGrid />
      {t < 11 ? <SceneClassic t={t} /> : null}
      {t >= 6.4 && t < 8.35 ? <KnowledgeSea t={t} /> : null}
      <Supers t={t} />
    </AbsoluteFill>
  );
};
