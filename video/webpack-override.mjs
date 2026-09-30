import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * 允许从主应用源码直接导入 locale 文案、图标与静态资源（单一来源），
 * 并把 react 固定到本工程的副本，避免主仓 node_modules 里的第二份 React。
 */
export const webpackOverride = (config) => ({
  ...config,
  resolve: {
    ...config.resolve,
    alias: {
      ...(config.resolve?.alias ?? {}),
      '@app': path.resolve(here, '..', 'src'),
      '@app-public': path.resolve(here, '..', 'public'),
      react: path.resolve(here, 'node_modules/react'),
      'react-dom': path.resolve(here, 'node_modules/react-dom'),
    },
  },
});
