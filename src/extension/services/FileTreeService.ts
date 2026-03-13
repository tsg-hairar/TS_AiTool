// ===================================================
// FileTreeService — סריקת עץ קבצים של פרויקט
// ===================================================
// סורק תיקיית פרויקט ומחזיר מבנה עץ קבצים
// עם סינון תיקיות לא רלוונטיות ומגבלת פריטים
// ===================================================

import * as fs from 'fs';
import * as path from 'path';
import type { FileTreeNode } from '../../shared/messages';

// תיקיות וקבצים שיש להתעלם מהם
const IGNORED_NAMES = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  '.vscode',
  '.idea',
  '__pycache__',
  '.DS_Store',
  '.next',
  '.nuxt',
  '.cache',
  '.parcel-cache',
  'coverage',
  '.nyc_output',
  '.turbo',
  '.svelte-kit',
  'Thumbs.db',
  '.env',
  '.env.local',
  '.env.production',
]);

// מגבלת פריטים למניעת בעיות ביצועים
const MAX_ITEMS = 500;

export class FileTreeService {
  // -------------------------------------------------
  // getFileTree — סריקת תיקייה וייצור עץ קבצים
  // -------------------------------------------------
  // rootPath: נתיב שורש לסריקה
  // depth: עומק מירבי לרקורסיה (ברירת מחדל: 3)
  // -------------------------------------------------
  public async getFileTree(rootPath: string, depth: number = 3): Promise<FileTreeNode[]> {
    try {
      // בדיקה שהנתיב קיים
      const stat = await fs.promises.stat(rootPath);
      if (!stat.isDirectory()) {
        return [];
      }

      const counter = { count: 0 };
      const tree = await this.scanDirectory(rootPath, depth, counter);
      return tree;
    } catch {
      // נתיב לא קיים או שגיאת הרשאה
      return [];
    }
  }

  // -------------------------------------------------
  // scanDirectory — סריקה רקורסיבית
  // -------------------------------------------------
  private async scanDirectory(
    dirPath: string,
    remainingDepth: number,
    counter: { count: number },
  ): Promise<FileTreeNode[]> {
    if (remainingDepth <= 0 || counter.count >= MAX_ITEMS) {
      return [];
    }

    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    } catch {
      // אין הרשאות קריאה — מדלגים
      return [];
    }

    // סינון תיקיות/קבצים שיש להתעלם מהם
    const filtered = entries.filter((entry) => !IGNORED_NAMES.has(entry.name));

    // מיון: תיקיות קודם, אחר כך קבצים, אלפביתית בתוך כל קבוצה
    filtered.sort((a, b) => {
      const aIsDir = a.isDirectory();
      const bIsDir = b.isDirectory();
      if (aIsDir !== bIsDir) return aIsDir ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });

    const result: FileTreeNode[] = [];

    for (const entry of filtered) {
      if (counter.count >= MAX_ITEMS) break;

      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        counter.count++;

        // סריקה רקורסיבית של תיקיות
        const children = await this.scanDirectory(fullPath, remainingDepth - 1, counter);

        result.push({
          name: entry.name,
          path: fullPath,
          type: 'folder',
          children,
        });
      } else if (entry.isFile()) {
        counter.count++;

        // קבלת גודל קובץ
        let size: number | undefined;
        try {
          const stat = await fs.promises.stat(fullPath);
          size = stat.size;
        } catch {
          // לא הצלחנו לקרוא — ממשיכים בלי גודל
        }

        // סיומת קובץ
        const ext = path.extname(entry.name);
        const extension = ext ? ext.slice(1).toLowerCase() : undefined;

        result.push({
          name: entry.name,
          path: fullPath,
          type: 'file',
          size,
          extension,
        });
      }
    }

    return result;
  }
}
