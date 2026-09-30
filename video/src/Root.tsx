import { Composition } from 'remotion';
import { DURATION_S, FPS, HEIGHT, WIDTH } from './lib/time';
import { PV } from './PV';

export const Root = () => (
  <Composition id="DeepStudentPV" component={PV} durationInFrames={DURATION_S * FPS} fps={FPS} width={WIDTH} height={HEIGHT} />
);
