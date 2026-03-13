// ===================================================
// Vite Configuration — Webview UI Bundler
// ===================================================
// בונה את קוד ה-React (Webview) שרץ בתוך VS Code
// Vite מהיר יותר מ-webpack ותומך ב-HMR
// ===================================================

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  // תוסף React — תומך ב-JSX ו-Fast Refresh
  plugins: [react()],

  // הגדרות בנייה
  build: {
    // תיקיית פלט — שם VS Code מחפש את ה-webview
    outDir: 'dist/webview',

    // ביטול ניקוי אוטומטי — כי esbuild כבר שם קבצים ב-dist
    emptyOutDir: false,

    rollupOptions: {
      // קובץ הכניסה של ה-React app
      input: resolve(__dirname, 'src/webview/index.html'),

      output: {
        // שם קובץ הפלט — בלי hash כי VS Code צריך נתיב קבוע
        entryFileNames: 'index.js',
        assetFileNames: 'assets/[name].[ext]',
        // --- ביטול code splitting ---
        // VS Code webview + CSP חוסם dynamic imports
        // הכל בקובץ אחד = לא צריך chunks ולא strict-dynamic
        manualChunks: undefined,
        inlineDynamicImports: true,
      },
    },

    // מינימיזציה
    minify: 'esbuild',

    // Source maps לדיבאג
    sourcemap: true,
  },

  // קיצורי נתיבים — תואם ל-tsconfig
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@webview': resolve(__dirname, 'src/webview'),
    },
  },
});
