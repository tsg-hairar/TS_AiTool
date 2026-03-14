// ===================================================
// GitService — אינטגרציית Git
// ===================================================
// מבצע פעולות Git באמצעות child_process
// ===================================================

import { spawn } from 'child_process';
import * as vscode from 'vscode';
import type { GitInfo, FileDiff, DiffFile, DiffHunk, DiffLine } from '../../shared/types';

// -------------------------------------------------
// TimedCache — מטמון פשוט עם TTL
// -------------------------------------------------
interface TimedCacheEntry<T> {
  data: T;
  timestamp: number;
}

class TimedCache<T> {
  private cache = new Map<string, TimedCacheEntry<T>>();

  get(key: string, ttlMs: number): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.timestamp > ttlMs) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.data;
  }

  set(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }
}

export class GitService {
  // -------------------------------------------------
  // Cache instances — TTL values
  // -------------------------------------------------
  // status: 5 שניות — נקרא לעיתים קרובות
  // branches: 30 שניות — משתנה לעתים רחוקות
  // diff/fileTree: 10 שניות — משתנה בעבודה
  // -------------------------------------------------
  private static readonly STATUS_TTL = 5_000;
  private static readonly BRANCHES_TTL = 30_000;
  private static readonly DIFF_TTL = 10_000;

  private statusCache = new TimedCache<GitInfo>();
  private diffCache = new TimedCache<FileDiff[]>();

  /** ניקוי כל המטמונים — נקרא אחרי פעולות git (commit, checkout) */
  public invalidateCache(): void {
    this.statusCache.clear();
    this.diffCache.clear();
  }
  // -------------------------------------------------
  // getInfo — מידע על הריפו
  // -------------------------------------------------
  public async getInfo(cwd?: string): Promise<GitInfo> {
    const workDir = cwd ?? this.getWorkDir();
    if (!workDir) throw new Error('No workspace folder open');

    // --- בדיקת cache ---
    const cacheKey = `info:${workDir}`;
    const cached = this.statusCache.get(cacheKey, GitService.STATUS_TTL);
    if (cached) return cached;

    const [branch, lastCommit, status, remote] = await Promise.all([
      this.run(['git', 'branch', '--show-current'], workDir),
      this.run(['git', 'log', '-1', '--format=%H%x00%s%x00%aI%x00%an'], workDir),
      this.run(['git', 'status', '--porcelain'], workDir),
      this.run(['git', 'remote', 'get-url', 'origin'], workDir).catch(() => ''),
    ]);

    const commitParts = lastCommit.trim().split('\0');
    const [hash, message, date, author] = commitParts;

    const result: GitInfo = {
      branch: branch.trim(),
      uncommittedChanges: status.trim().split('\n').filter(Boolean).length,
      remoteUrl: remote.trim() || undefined,
      lastCommit: hash
        ? { hash: hash.trim(), message: message?.trim(), date: date?.trim(), author: author?.trim() }
        : undefined,
    };

    this.statusCache.set(cacheKey, result);
    return result;
  }

  // -------------------------------------------------
  // getDiff — קבלת שינויים
  // -------------------------------------------------
  public async getDiff(cwd?: string): Promise<FileDiff[]> {
    const workDir = cwd ?? this.getWorkDir();
    if (!workDir) throw new Error('No workspace folder open');

    // --- בדיקת cache ---
    const cacheKey = `diff:${workDir}`;
    const cached = this.diffCache.get(cacheKey, GitService.DIFF_TTL);
    if (cached) return cached;

    const diffOutput = await this.run(['git', 'diff', '--stat', '--numstat'], workDir);
    const lines = diffOutput.trim().split('\n').filter(Boolean);

    const result = lines.map((line) => {
      const [additions, deletions, filePath] = line.split('\t');
      return {
        filePath: filePath ?? line,
        status: 'modified' as const,
        additions: parseInt(additions) || 0,
        deletions: parseInt(deletions) || 0,
      };
    });

    this.diffCache.set(cacheKey, result);
    return result;
  }

  // -------------------------------------------------
  // commit — ביצוע commit
  // -------------------------------------------------
  public async commit(message: string, cwd?: string): Promise<string> {
    const workDir = cwd ?? this.getWorkDir();
    if (!workDir) throw new Error('No workspace folder open');

    // סריקת סודות לפני commit
    const secrets = await this.scanForSecrets(workDir);
    if (secrets.length > 0) {
      throw new Error(
        `Security: Found potential secrets in staged files:\n${secrets.join('\n')}`,
      );
    }

    await this.run(['git', 'add', '-A'], workDir);
    const result = await this.run(['git', 'commit', '-m', message], workDir);
    // ניקוי cache אחרי commit
    this.invalidateCache();
    return result;
  }

  // -------------------------------------------------
  // push — דחיפה ל-remote
  // -------------------------------------------------
  public async push(cwd?: string): Promise<string> {
    const workDir = cwd ?? this.getWorkDir();
    if (!workDir) throw new Error('No workspace folder open');

    const result = await this.run(['git', 'push'], workDir);
    // ניקוי cache אחרי push
    this.invalidateCache();
    return result;
  }

  // -------------------------------------------------
  // getFullDiff — קבלת diff מלא עם תוכן (unified format)
  // -------------------------------------------------
  public async getFullDiff(filePath?: string, cwd?: string): Promise<DiffFile[]> {
    const workDir = cwd ?? this.getWorkDir();
    if (!workDir) throw new Error('No workspace folder open');

    const args = ['git', 'diff', '-U3'];
    if (filePath) args.push('--', filePath);

    const diffOutput = await this.run(args, workDir);
    return this.parseDiffOutput(diffOutput);
  }

  // -------------------------------------------------
  // getStagedDiff — קבלת diff של קבצים staged
  // -------------------------------------------------
  public async getStagedDiff(filePath?: string, cwd?: string): Promise<DiffFile[]> {
    const workDir = cwd ?? this.getWorkDir();
    if (!workDir) throw new Error('No workspace folder open');

    const args = ['git', 'diff', '--cached', '-U3'];
    if (filePath) args.push('--', filePath);

    const diffOutput = await this.run(args, workDir);
    return this.parseDiffOutput(diffOutput);
  }

  // -------------------------------------------------
  // parseDiffOutput — פענוח פלט git diff ל-DiffFile[]
  // -------------------------------------------------
  private parseDiffOutput(rawDiff: string): DiffFile[] {
    if (!rawDiff.trim()) return [];

    const files: DiffFile[] = [];
    // פיצול לפי כותרות קבצים (diff --git a/... b/...)
    const fileSections = rawDiff.split(/^diff --git /m).filter(Boolean);

    for (const section of fileSections) {
      const lines = section.split('\n');
      if (lines.length === 0) continue;

      // חילוץ שם קובץ מהשורה הראשונה: a/path b/path
      const headerMatch = lines[0].match(/a\/(.+?)\s+b\/(.+)/);
      if (!headerMatch) continue;

      const oldFilename = headerMatch[1];
      const filename = headerMatch[2];

      // זיהוי סטטוס
      let status: DiffFile['status'] = 'modified';
      if (section.includes('new file mode')) status = 'added';
      else if (section.includes('deleted file mode')) status = 'deleted';
      else if (oldFilename !== filename) status = 'renamed';

      // פענוח hunks
      const hunks: DiffHunk[] = [];
      let additions = 0;
      let deletions = 0;

      // מציאת כל ה-hunks
      const hunkRegex = /^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@(.*)$/gm;
      let hunkMatch: RegExpExecArray | null;
      const hunkPositions: Array<{ index: number; header: string; oldStart: number; oldCount: number; newStart: number; newCount: number }> = [];

      while ((hunkMatch = hunkRegex.exec(section)) !== null) {
        hunkPositions.push({
          index: hunkMatch.index,
          header: hunkMatch[0],
          oldStart: parseInt(hunkMatch[1]) || 1,
          oldCount: parseInt(hunkMatch[2]) || 0,
          newStart: parseInt(hunkMatch[3]) || 1,
          newCount: parseInt(hunkMatch[4]) || 0,
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
          } else if (line.startsWith(' ') || line === '') {
            // שורה ללא שינוי (או שורה ריקה בסוף)
            if (line.startsWith(' ') || (line === '' && diffLines.length > 0 && diffLines[diffLines.length - 1].type !== 'header')) {
              diffLines.push({
                type: 'unchanged',
                content: line.startsWith(' ') ? line.slice(1) : '',
                oldLineNumber: oldLine++,
                newLineNumber: newLine++,
              });
            }
          } else if (line.startsWith('\\')) {
            // "\ No newline at end of file" — מתעלמים
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
  // scanForSecrets — סריקת סודות בקבצים staged
  // -------------------------------------------------
  public async scanForSecrets(cwd: string): Promise<string[]> {
    const warnings: string[] = [];

    try {
      const staged = await this.run(['git', 'diff', '--cached', '--name-only'], cwd);
      const files = staged.trim().split('\n').filter(Boolean);

      // --- Phase 1: Sensitive file name patterns ---
      const sensitiveFilePatterns = [
        /\.env(\.local|\.production|\.staging|\.development)?$/,
        /credentials\.json$/i,
        /\.(pem|key|p12|pfx|jks|keystore)$/i,
        /id_(rsa|ed25519|ecdsa|dsa)(\.pub)?$/,
        /\.htpasswd$/i,
        /secret[s]?\.(json|ya?ml|toml)$/i,
        /service[-_]?account.*\.json$/i,
      ];

      for (const file of files) {
        for (const pattern of sensitiveFilePatterns) {
          if (pattern.test(file)) {
            warnings.push(`⚠️ ${file} — potentially sensitive file`);
            break;
          }
        }
      }

      // --- Phase 2: Scan staged file contents for secret patterns ---
      const secretContentPatterns: Array<{ name: string; pattern: RegExp }> = [
        // API Keys — generic
        { name: 'Generic API Key', pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"]?[A-Za-z0-9_\-]{20,}['"]?/i },
        // AWS credentials
        { name: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{16}/ },
        { name: 'AWS Secret Key', pattern: /(?:aws[_-]?secret[_-]?access[_-]?key)\s*[:=]\s*['"]?[A-Za-z0-9/+=]{40}['"]?/i },
        // Private keys
        { name: 'Private Key', pattern: /-----BEGIN\s+(RSA|EC|DSA|OPENSSH|PGP)?\s*PRIVATE KEY-----/ },
        // JWT tokens
        { name: 'JWT Token', pattern: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_\-+/=]{10,}/ },
        // OAuth / Bearer tokens
        { name: 'Bearer Token', pattern: /(?:bearer|token|authorization)\s*[:=]\s*['"]?[A-Za-z0-9_\-\.]{20,}['"]?/i },
        // Connection strings
        { name: 'Connection String', pattern: /(?:mongodb|postgres|mysql|redis|amqp|mssql):\/\/[^\s'"]{10,}/i },
        { name: 'JDBC Connection', pattern: /jdbc:[a-z]+:\/\/[^\s'"]{10,}/i },
        // GitHub / GitLab tokens
        { name: 'GitHub Token', pattern: /(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}/ },
        { name: 'GitLab Token', pattern: /glpat-[A-Za-z0-9_\-]{20,}/ },
        // Slack tokens
        { name: 'Slack Token', pattern: /xox[bpors]-[A-Za-z0-9\-]{10,}/ },
        // Google API Key
        { name: 'Google API Key', pattern: /AIza[0-9A-Za-z_\-]{35}/ },
        // Stripe keys
        { name: 'Stripe Key', pattern: /(?:sk|pk)_(?:test|live)_[A-Za-z0-9_]{20,}/ },
        // Azure
        { name: 'Azure Secret', pattern: /(?:azure[_-]?(?:client|tenant|subscription)[_-]?(?:secret|id|key))\s*[:=]\s*['"]?[A-Za-z0-9_\-]{20,}['"]?/i },
        // Generic secret/password assignment
        { name: 'Hardcoded Secret', pattern: /(?:password|secret|passwd|pwd)\s*[:=]\s*['"][^'"]{8,}['"]/i },
      ];

      // Get staged diff content for scanning
      try {
        const diffContent = await this.run(['git', 'diff', '--cached'], cwd);
        // Only scan added lines (lines starting with +, but not +++)
        const addedLines = diffContent.split('\n').filter(
          (line) => line.startsWith('+') && !line.startsWith('+++'),
        );
        const addedContent = addedLines.join('\n');

        for (const { name, pattern } of secretContentPatterns) {
          if (pattern.test(addedContent)) {
            warnings.push(`🔑 Potential ${name} detected in staged changes`);
          }
        }
      } catch {
        // Could not read diff content — continue with file-name checks only
      }
    } catch {
      // Git לא זמין — ממשיכים
    }

    return warnings;
  }

  // -------------------------------------------------
  // Helpers
  // -------------------------------------------------

  private getWorkDir(): string | undefined {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  }

  private run(args: string[], cwd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const [command, ...commandArgs] = args;
      const child = spawn(command, commandArgs, {
        cwd,
        shell: false,
        timeout: 15000,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      child.on('error', (error: Error) => {
        reject(new Error(error.message));
      });

      child.on('close', (code: number | null) => {
        if (code !== 0) {
          reject(new Error(stderr || `Process exited with code ${code}`));
        } else {
          resolve(stdout);
        }
      });
    });
  }
}
