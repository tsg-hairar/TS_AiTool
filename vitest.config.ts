// ===================================================
// Vite + Vitest Configuration
// ===================================================
// Webview build config + Vitest test config
// ===================================================

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],

  build: {
    outDir: 'dist/webview',
    emptyOutDir: false,
    rollupOptions: {
      input: resolve(__dirname, 'src/webview/index.html'),
      output: {
        entryFileNames: 'index.js',
        chunkFileNames: 'chunks/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
    minify: 'esbuild',
    sourcemap: true,
  },

  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@webview': resolve(__dirname, 'src/webview'),
      // Mock vscode module for tests
      'vscode': resolve(__dirname, 'src/test/__mocks__/vscode.ts'),
    },
  },

  test: {
    globals: true,
    environment: 'node',
    include: ['src/test/**/*.test.ts'],
    // Exclude webview tests that need browser env
    exclude: ['node_modules', 'dist'],
    setupFiles: ['src/test/setup.ts'],
  },
});
