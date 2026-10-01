import path from 'node:path';
import { Config } from '@remotion/cli/config';
import { webpackOverride } from './webpack-override.mjs';

Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);
Config.setConcurrency(4);
// 3D 检索段走 WebGL：mac 上用 ANGLE（Metal 后端），headless 默认的 swiftshader 太慢且无 MSAA。
Config.setChromiumOpenGlRenderer('angle');
Config.setPublicDir(path.resolve(process.cwd(), 'public'));

// 渲染机上装有 Chrome 时直接复用，避免首次渲染联网下载 headless shell。
if (process.env.REMOTION_CHROME) {
  Config.setBrowserExecutable(process.env.REMOTION_CHROME);
}

Config.overrideWebpackConfig(webpackOverride);
