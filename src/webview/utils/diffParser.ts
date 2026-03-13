// ===================================================
// Diff Parser — מנתח פלט Git Diff
// ===================================================
// ממיר פלט unified diff גולמי למבנה נתונים מאורגן
// תומך בקבצים בינאריים, שינוי שם, קבצים חדשים/מחוקים
// ===================================================

import type { DiffFile, DiffHunk, DiffLine } from '../../shared/types';

// -------------------------------------------------
// ParsedDiffStats — סטטיסטיקות מסוכמות
// -------------------------------------------------
export interface ParsedDiffStats {
  /** סה"כ קבצים ששונו */
  filesChanged: number;
  /** סה"כ שורות שנוספו */
  totalAdditions: number;
  /** סה"כ שורות שנמחקו */
  totalDeletions: number;
  /** קבצים חדשים */
  newFiles: number;
  /** קבצים שנמחקו */
  deletedFiles: number;
  /** קבצים ששונה שמם */
  renamedFiles: number;
  /** קבצים בינאריים */
  binaryFiles: number;
}

// -------------------------------------------------
// parseDiffOutput — פענוח פלט git diff גולמי
// -------------------------------------------------
/**
 * מנתח פלט git diff בפורמט unified ומחזיר מערך של DiffFile.
 * זהה ללוגיקה ב-GitService.parseDiffOutput אבל זמין בצד ה-webview
 * לשימוש במקרה שה-diff מגיע כטקסט גולמי.
 */
export function parseDiffOutput(rawDiff: string): DiffFile[] {
  if (!rawDiff.trim()) return [];

  const files: DiffFile[] = [];
  const fileSections = rawDiff.split(/^diff --git /m).filter(Boolean);

  for (const section of fileSections) {
    const lines = section.split('\n');
    if (lines.length === 0) continue;

    // חילוץ שם קובץ מהשורה הראשונה: a/path b/path
    const headerMatch = lines[0].match(/a\/(.+?)\s+b\/(.+)/);
    if (!headerMatch) continue;

    const oldFilename = headerMatch[1];
    const filename = headerMatch[2];

    // בדיקה אם זה קובץ בינארי
    const isBinary = section.includes('Binary files') ||
                     section.includes('GIT binary patch');
    if (isBinary) {
      let status: DiffFile['status'] = 'modified';
      if (section.includes('new file mode')) status = 'added';
      else if (section.includes('deleted file mode')) status = 'deleted';
      else if (oldFilename !== filename) status = 'renamed';

      files.push({
        filename,
        oldFilename: status === 'renamed' ? oldFilename : undefined,
        status,
        additions: 0,
        deletions: 0,
        hunks: [],
        // @ts-expect-error — extending DiffFile with binary flag
        isBinary: true,
      });
      continue;
    }

    // זיהוי סטטוס
    let status: DiffFile['status'] = 'modified';
    if (section.includes('new file mode')) status = 'added';
    else if (section.includes('deleted file mode')) status = 'deleted';
    else if (oldFilename !== filename) status = 'renamed';

    // פענוח hunks
    const hunks: DiffHunk[] = [];
    let additions = 0;
    let deletions = 0;

    const hunkRegex = /^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@(.*)$/gm;
    let hunkMatch: RegExpExecArray | null;
    const hunkPositions: Array<{
      index: number;
      header: string;
      oldStart: number;
      oldCount: number;
      newStart: number;
      newCount: number;
      context: string;
    }> = [];

    while ((hunkMatch = hunkRegex.exec(section)) !== null) {
      hunkPositions.push({
        index: hunkMatch.index,
        header: hunkMatch[0],
        oldStart: parseInt(hunkMatch[1]) || 1,
        oldCount: parseInt(hunkMatch[2]) ?? 0,
        newStart: parseInt(hunkMatch[3]) || 1,
        newCount: parseInt(hunkMatch[4]) ?? 0,
        context: (hunkMatch[5] || '').trim(),
      });
    }

    for (let h = 0; h < hunkPositions.length; h++) {
      const hunkPos = hunkPositions[h];
      const startIdx = section.indexOf('\n', hunkPos.index) + 1;
      const endIdx = h + 1 < hunkPositions.length
        ? hunkPositions[h + 1].index
        : section.length;

      const hunkContent = section.slice(startIdx, endIdx);
      const hunkLines = hunkContent.split('\n');
      const diffLines: DiffLine[] = [];

      let oldLine = hunkPos.oldStart;
      let newLine = hunkPos.newStart;

      for (const line of hunkLines) {
        if (line.startsWith('+')) {
          diffLines.push({
            type: 'added',
            content: line.slice(1),
            newLineNumber: newLine++,
          });
          additions++;
        } else if (line.startsWith('-')) {
          diffLines.push({
            type: 'removed',
            content: line.slice(1),
            oldLineNumber: oldLine++,
          });
          deletions++;
        } else if (line.startsWith(' ')) {
          diffLines.push({
            type: 'unchanged',
            content: line.slice(1),
            oldLineNumber: oldLine++,
            newLineNumber: newLine++,
          });
        } else if (line.startsWith('\\')) {
          // "\ No newline at end of file" — skip
        } else if (line === '' && diffLines.length > 0) {
          // Empty line within a hunk — treat as unchanged
          if (diffLines[diffLines.length - 1].type !== 'header') {
            diffLines.push({
              type: 'unchanged',
              content: '',
              oldLineNumber: oldLine++,
              newLineNumber: newLine++,
            });
          }
        }
      }

      hunks.push({
        header: hunkPos.header,
        oldStart: hunkPos.oldStart,
        oldCount: hunkPos.oldCount,
        newStart: hunkPos.newStart,
        newCount: hunkPos.newCount,
        lines: diffLines,
      });
    }

    files.push({
      filename,
      oldFilename: status === 'renamed' ? oldFilename : undefined,
      status,
      additions,
      deletions,
      hunks,
    });
  }

  return files;
}

// -------------------------------------------------
// getDiffStats — סטטיסטיקות מסוכמות
// -------------------------------------------------
/**
 * מחשב סטטיסטיקות מסוכמות ממערך של DiffFile.
 */
export function getDiffStats(files: DiffFile[]): ParsedDiffStats {
  let totalAdditions = 0;
  let totalDeletions = 0;
  let newFiles = 0;
  let deletedFiles = 0;
  let renamedFiles = 0;
  let binaryFiles = 0;

  for (const file of files) {
    totalAdditions += file.additions;
    totalDeletions += file.deletions;

    switch (file.status) {
      case 'added':
        newFiles++;
        break;
      case 'deleted':
        deletedFiles++;
        break;
      case 'renamed':
        renamedFiles++;
        break;
    }

    // Check for binary flag (extended DiffFile)
    if ((file as DiffFile & { isBinary?: boolean }).isBinary) {
      binaryFiles++;
    }
  }

  return {
    filesChanged: files.length,
    totalAdditions,
    totalDeletions,
    newFiles,
    deletedFiles,
    renamedFiles,
    binaryFiles,
  };
}

// -------------------------------------------------
// getFileExtension — חילוץ סיומת קובץ
// -------------------------------------------------
export function getFileExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  if (dot === -1) return '';
  return filename.slice(dot + 1).toLowerCase();
}

// -------------------------------------------------
// getFileLanguage — זיהוי שפת תכנות לפי סיומת
// -------------------------------------------------
const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  go: 'go',
  java: 'java',
  kt: 'kotlin',
  cs: 'csharp',
  cpp: 'cpp',
  c: 'c',
  h: 'c',
  hpp: 'cpp',
  swift: 'swift',
  php: 'php',
  html: 'html',
  css: 'css',
  scss: 'scss',
  less: 'less',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  xml: 'xml',
  md: 'markdown',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  sql: 'sql',
  vue: 'vue',
  svelte: 'svelte',
  dart: 'dart',
  lua: 'lua',
  r: 'r',
  toml: 'toml',
  ini: 'ini',
  dockerfile: 'dockerfile',
};

export function getFileLanguage(filename: string): string | undefined {
  const ext = getFileExtension(filename);
  return EXTENSION_LANGUAGE_MAP[ext];
}

// -------------------------------------------------
// buildSideBySidePairs — בניית זוגות לתצוגה מפוצלת
// -------------------------------------------------
export interface SideBySidePair {
  left: DiffLine | null;
  right: DiffLine | null;
  type: 'unchanged' | 'changed';
}

/**
 * ממיר hunks לזוגות שורות side-by-side.
 * שורות שנמחקו מופיעות בצד שמאל, שורות שנוספו בצד ימין.
 */
export function buildSideBySidePairs(hunks: DiffHunk[]): SideBySidePair[] {
  const pairs: SideBySidePair[] = [];

  for (const hunk of hunks) {
    let i = 0;
    while (i < hunk.lines.length) {
      const line = hunk.lines[i];

      if (line.type === 'unchanged') {
        pairs.push({ left: line, right: line, type: 'unchanged' });
        i++;
      } else {
        // Gather consecutive removed and added lines
        const removed: DiffLine[] = [];
        const added: DiffLine[] = [];

        while (i < hunk.lines.length && hunk.lines[i].type === 'removed') {
          removed.push(hunk.lines[i]);
          i++;
        }
        while (i < hunk.lines.length && hunk.lines[i].type === 'added') {
          added.push(hunk.lines[i]);
          i++;
        }

        const maxLen = Math.max(removed.length, added.length);
        for (let j = 0; j < maxLen; j++) {
          pairs.push({
            left: j < removed.length ? removed[j] : null,
            right: j < added.length ? added[j] : null,
            type: 'changed',
          });
        }
      }
    }
  }

  return pairs;
}

// -------------------------------------------------
// getStatusLabel — תווית סטטוס קובץ
// -------------------------------------------------
export function getStatusLabel(status: DiffFile['status']): { icon: string; color: string } {
  switch (status) {
    case 'added':
      return { icon: '\u2795', color: '#4ec9b0' };
    case 'modified':
      return { icon: '\u270F\uFE0F', color: '#dcdcaa' };
    case 'deleted':
      return { icon: '\u274C', color: '#f14c4c' };
    case 'renamed':
      return { icon: '\u27A1\uFE0F', color: '#569cd6' };
    default:
      return { icon: '\uD83D\uDCC4', color: '#888' };
  }
}
