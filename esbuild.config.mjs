// ===================================================
// esbuild Configuration — Extension Host Bundler
// ===================================================
// בונה את קוד ה-Extension (Node.js) לקובץ אחד
// זה רץ בצד של VS Code, לא בצד של ה-Webview
// ===================================================

import * as esbuild from 'esbuild';

// בדיקה אם אנחנו במצב watch (פיתוח)
const isWatch = process.argv.includes('--watch');

/** @type {esbuild.BuildOptions} */
const buildOptions = {
  // קובץ הכניסה — נקודת ההתחלה של התוסף
  entryPoints: ['src/extension/extension.ts'],

  // קובץ הפלט — מה ש-VS Code טוען
  outfile: 'dist/extension.js',

  // חבילה אחת (bundle) במקום הרבה קבצים
  bundle: true,

  // פורמט CommonJS — VS Code דורש את זה
  format: 'cjs',

  // Node.js platform — לא דפדפן
  platform: 'node',

  // גרסת Node שתואמת ל-VS Code
  target: 'node18',

  // מודולים חיצוניים — לא לארוז אותם (VS Code מספק)
  external: ['vscode'],

  // Source maps לדיבאג
  sourcemap: true,

  // מינימיזציה רק ב-production
  minify: !isWatch,

  // ניקוי הפלט
  legalComments: 'none',
};

async function main() {
  if (isWatch) {
    // מצב פיתוח — מאזין לשינויים ובונה מחדש
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
    console.log('👀 Extension: watching for changes...');
  } else {
    // בנייה חד-פעמית
    await esbuild.build(buildOptions);
    console.log('✅ Extension: build complete');
  }
}

main().catch((err) => {
  console.error('❌ Extension build failed:', err);
  process.exit(1);
});
