// ===================================================
// GitService — אינטגרציית Git
// ===================================================
// מבצע פעולות Git באמצעות child_process
// ===================================================

import { exec } from 'child_process';
import * as vscode from 'vscode';
import type { GitInfo, FileDiff } from '../../shared/types';

export class GitService {
  // -------------------------------------------------
  // getInfo — מידע על הריפו
  // -------------------------------------------------
  public async getInfo(cwd?: string): Promise<GitInfo> {
    const workDir = cwd ?? this.getWorkDir();
    if (!workDir) throw new Error('No workspace folder open');

    const [branch, lastCommit, status, remote] = await Promise.all([
      this.run('git branch --show-current', workDir),
      this.run('git log -1 --format="%H|%s|%aI|%an"', workDir),
      this.run('git status --porcelain', workDir),
      this.run('git remote get-url origin', workDir).catch(() => ''),
    ]);

    const [hash, message, date, author] = lastCommit.split('|');

    return {
      branch: branch.trim(),
      uncommittedChanges: status.trim().split('\n').filter(Boolean).length,
      remoteUrl: remote.trim() || undefined,
      lastCommit: hash
        ? { hash: hash.trim(), message, date, author }
        : undefined,
    };
  }

  // -------------------------------------------------
  // getDiff — קבלת שינויים
  // -------------------------------------------------
  public async getDiff(cwd?: string): Promise<FileDiff[]> {
    const workDir = cwd ?? this.getWorkDir();
    if (!workDir) throw new Error('No workspace folder open');

    const diffOutput = await this.run('git diff --stat --numstat', workDir);
    const lines = diffOutput.trim().split('\n').filter(Boolean);

    return lines.map((line) => {
      const [additions, deletions, filePath] = line.split('\t');
      return {
        filePath: filePath ?? line,
        status: 'modified' as const,
        additions: parseInt(additions) || 0,
        deletions: parseInt(deletions) || 0,
      };
    });
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

    await this.run('git add -A', workDir);
    const result = await this.run(`git commit -m "${message.replace(/"/g, '\\"')}"`, workDir);
    return result;
  }

  // -------------------------------------------------
  // push — דחיפה ל-remote
  // -------------------------------------------------
  public async push(cwd?: string): Promise<string> {
    const workDir = cwd ?? this.getWorkDir();
    if (!workDir) throw new Error('No workspace folder open');

    return this.run('git push', workDir);
  }

  // -------------------------------------------------
  // scanForSecrets — סריקת סודות בקבצים staged
  // -------------------------------------------------
  public async scanForSecrets(cwd: string): Promise<string[]> {
    const warnings: string[] = [];

    try {
      const staged = await this.run('git diff --cached --name-only', cwd);
      const files = staged.trim().split('\n').filter(Boolean);

      // קבצים שלא צריכים להיכנס ל-Git
      const sensitivePatterns = [
        '.env', '.env.local', '.env.production',
        'credentials.json', '.pem', '.key', '.p12',
        'id_rsa', 'id_ed25519',
      ];

      for (const file of files) {
        for (const pattern of sensitivePatterns) {
          if (file.endsWith(pattern) || file.includes(pattern)) {
            warnings.push(`⚠️ ${file} — potentially sensitive file`);
          }
        }
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

  private run(command: string, cwd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      exec(command, { cwd, timeout: 15000 }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || error.message));
        } else {
          resolve(stdout);
        }
      });
    });
  }
}
