import type { ReactNode } from 'react';
import { AbsoluteFill } from 'remotion';
import './global.css';
import { Soundtrack } from './audio/Soundtrack';
import { prog, useTime } from './lib/time';
import { Supers } from './overlays/Supers';
import { FN } from './scenes/finale/beats';
import { EndCard } from './scenes/finale/EndCard';
import { KnowledgeTerrain } from './scenes/finale/KnowledgeTerrain';
import { RV } from './scenes/retrieval/beats';
import { Archive3D } from './scenes/retrieval/Archive3D';
import { FREEZE, MIN0, MIN1, minimizeAt } from './scenes/review/handoff';
import { WK, SceneReview } from './scenes/review/SceneReview';
import { SceneClassic } from './scenes/SceneClassic';
import { brand } from './theme';
import { PaperGrid } from './ui/brand';
import { useFontsReady } from './ui/tex';

const Minimize = ({ t, children }: { t: number; children: ReactNode }) => {
  if (t <= MIN0) return <>{children}</>;
  const m = minimizeAt(t);
  return (
    <AbsoluteFill
      style={{
        transform: `translate(${m.x - m.c0.x}px, ${m.y - m.c0.y}px) scale(${m.sx}, ${m.sy})`,
        transformOrigin: `${m.c0.x}px ${m.c0.y}px`,
        opacity: 1 - prog(m.k, 0.8, 1),
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

export const PV = () => {
  useFontsReady();
  const t = useTime();
  return (
    <AbsoluteFill style={{ background: brand.paper, overflow: 'hidden' }}>
      <PaperGrid />
      {t >= FN.kb0 && t < FN.fade1 ? <KnowledgeTerrain t={t} /> : null}
      {t >= WK.night0 && t < WK.out1 ? <SceneReview t={t} /> : null}
      {t < MIN1 ? (
        <Minimize t={t}>
          <SceneClassic t={Math.min(t, FREEZE)} hidePupil={t > MIN0} />
        </Minimize>
      ) : null}
      {t >= RV.cut && t < RV.reveal + 0.16 ? <Archive3D t={t} /> : null}
      <EndCard t={t} />
      <Supers t={t} />
      <Soundtrack />
    </AbsoluteFill>
  );
};
