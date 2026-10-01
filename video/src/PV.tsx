import { AbsoluteFill } from 'remotion';
import './global.css';
import { useTime } from './lib/time';
import { Supers } from './overlays/Supers';
import { RV } from './scenes/retrieval/beats';
import { Archive3D } from './scenes/retrieval/Archive3D';
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
      {t < 12 ? <SceneClassic t={t} /> : null}
      {t >= RV.cut && t < RV.reveal + 0.16 ? <Archive3D t={t} /> : null}
      <Supers t={t} />
    </AbsoluteFill>
  );
};
