import { project, type Cam } from '../../lib/camera';
import { clamp, ease, prog } from '../../lib/time';
import { TL_PITCH } from '../../ui/chat';
import { CW, PAGE_ORIGIN } from '../../ui/classic';
import { PAGE_W } from '../../ui/TextbookPage';
import { hitScreenRect } from './archive';
import { useArchiveAssets } from './assets';
import { HITS, RV } from './beats';

const ASPECT = 1.33;
/** 检索行在世界坐标中的落点（assistant 块 top=150，时间线行距 TL_PITCH；x 落在工具图标上）。 */
export const ROW_Y = [CW.title + 150 + TL_PITCH, CW.title + 150 + 2 * TL_PITCH];
const ROW_X = CW.chatX + 32 + 12;

const FLIGHTS = [
  { t0: RV.reveal + 0.06, t1: RV.land2, to: 'row0' as const },
  { t0: RV.reveal + 0.02, t1: RV.land1, to: 'page' as const },
  { t0: RV.reveal + 0.1, t1: RV.land3, to: 'row1' as const },
];

/**
 * 3D → 界面的交接替身（屏幕坐标）：命中纸片从 3D 最后一帧的位置接手，
 * 教材页飞进右侧 PDF 面板（面板同时弹到第 134 页），另两张收进对应的检索行。
 */
export const Handoff = ({ t, cam }: { t: number; cam: Cam }) => {
  const assets = useArchiveAssets();
  if (!assets || t < RV.reveal || t > RV.land3 + 0.02) return null;
  return (
    <>
      {HITS.map((h, i) => {
        const f = FLIGHTS[i];
        const a = hitScreenRect(i);
        let b: { x: number; y: number; w: number; h: number };
        if (f.to === 'page') {
          const p = project(cam, PAGE_ORIGIN.x, PAGE_ORIGIN.y);
          const w = PAGE_W * cam.zoom;
          b = { x: p.x, y: p.y, w, h: w * ASPECT };
        } else {
          const p = project(cam, ROW_X, ROW_Y[f.to === 'row0' ? 0 : 1] + 2);
          const hh = 24 * cam.zoom;
          b = { x: p.x, y: p.y, w: hh / ASPECT, h: hh };
        }
        const k = prog(t, f.t0, f.t1, f.to === 'page' ? ease.inOutQuint : ease.inOutCubic);
        const lift = Math.sin(k * Math.PI) * (f.to === 'page' ? 30 : 70);
        const x = a.x + (b.x - a.x) * k;
        const y = a.y + (b.y - a.y) * k - lift;
        const w = a.w + (b.w - a.w) * k;
        const hgt = a.h + (b.h - a.h) * k;
        const opacity = f.to === 'page' ? clamp((1 - k) / 0.18) : clamp((1 - k) / 0.3);
        const mid = Math.sin(k * Math.PI);
        return (
          <img
            key={h.title}
            src={assets.hitUrls[i]}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: w,
              height: hgt,
              borderRadius: 4 + 6 * mid,
              opacity,
              transform: `rotate(${mid * (i - 1) * -3}deg)`,
              boxShadow: `0 ${8 + 30 * mid}px ${24 + 50 * mid}px hsl(220 30% 12% / ${0.12 + 0.14 * mid}), 0 0 0 1px hsl(220 12% 16% / 0.06)`,
            }}
          />
        );
      })}
    </>
  );
};
