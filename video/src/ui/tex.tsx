import katex from 'katex';
import 'katex/dist/katex.min.css';
import { useEffect, useState, type CSSProperties } from 'react';
import { continueRender, delayRender } from 'remotion';

const cache = new Map<string, string>();

export const Tex = ({ tex, display = false, style }: { tex: string; display?: boolean; style?: CSSProperties }) => {
  const key = `${display ? 'D' : 'I'}:${tex}`;
  let html = cache.get(key);
  if (!html) {
    html = katex.renderToString(tex, { displayMode: display, throwOnError: false, output: 'html' });
    cache.set(key, html);
  }
  return <span style={style} dangerouslySetInnerHTML={{ __html: html }} />;
};

const FONT_PROBES = [
  '20px KaTeX_Main',
  'italic 20px KaTeX_Math',
  'italic 20px KaTeX_Main',
  'bold 20px KaTeX_Main',
  '20px KaTeX_Size1',
  '20px KaTeX_Size2',
  '20px "PingFang SC"',
  '20px "Songti SC"',
];

/** 逐帧渲染前等 KaTeX 与系统字体就绪，避免首帧回退字体。 */
export const useFontsReady = () => {
  const [handle] = useState(() => delayRender('fonts'));
  useEffect(() => {
    Promise.all(FONT_PROBES.map((f) => document.fonts.load(f, 'fξ′中')))
      .then(() => document.fonts.ready)
      .then(() => continueRender(handle))
      .catch(() => continueRender(handle));
  }, [handle]);
};
