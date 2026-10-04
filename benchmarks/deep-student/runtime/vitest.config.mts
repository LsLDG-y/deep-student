import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import path from 'node:path';

const root = process.cwd();
export default defineConfig({
  root,
  plugins: [react()],
  cacheDir: process.env.BENCH_CACHE || '/tmp/deep-student-vite-cache',
  resolve: {
    alias: {
      '@': path.join(root, 'src'),
      '@tauri-apps/api/core': path.join(root, 'tests/ct/mocks/tauri-core-mock.ts'),
      '@tauri-apps/api/event': path.join(root, 'tests/ct/mocks/tauri-event-mock.ts'),
      '@tauri-apps/api/window': path.join(root, 'tests/ct/mocks/tauri-window-mock.ts'),
      '@tauri-apps/api/webviewWindow': path.join(root, 'tests/ct/mocks/tauri-webviewWindow-mock.ts'),
      '@tauri-apps/api/webview': path.join(root, 'tests/ct/mocks/tauri-webview-mock.ts'),
      '/src/contexts/SubjectContext.tsx': path.join(root, 'tests/ct/mocks/SubjectContext.mock.tsx'),
      'react-i18next': path.join(root, 'tests/ct/mocks/react-i18next.tsx'),
      '/src/utils/tauriApi.ts': path.join(root, 'tests/ct/mocks/tauriApi.mock.ts'),
    },
  },
  test: {
    include: ['.benchmark-tests/**/*.{test,spec}.{ts,tsx}'],
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    css: false,
    silent: true,
    pool: 'forks',
    maxWorkers: 1,
    minWorkers: 1,
    testTimeout: 15000,
    hookTimeout: 15000,
    poolOptions: { forks: { execArgv: ['--max-old-space-size=2048'] } },
  },
});
