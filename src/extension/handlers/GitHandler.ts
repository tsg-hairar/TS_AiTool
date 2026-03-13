// ===================================================
// GitHandler — טיפול בפעולות Git
// ===================================================

import type { ExtensionToWebviewMessage } from '../../shared/messages';
import { GitService } from '../services/GitService';

export class GitHandler {
  constructor(
    private readonly gitService: GitService,
    private readonly postMessage: (msg: ExtensionToWebviewMessage) => void,
  ) {}

  public async getGitInfo(): Promise<void> {
    try {
      const info = await this.gitService.getInfo();
      this.postMessage({ type: 'gitInfo', payload: info });
    } catch (error) {
      this.postMessage({
        type: 'error',
        payload: { message: error instanceof Error ? error.message : 'Git error' },
      });
    }
  }

  public async getGitDiff(): Promise<void> {
    try {
      const diffs = await this.gitService.getDiff();
      this.postMessage({ type: 'gitDiff', payload: diffs });
    } catch (error) {
      this.postMessage({
        type: 'error',
        payload: { message: error instanceof Error ? error.message : 'Git diff error' },
      });
    }
  }

  public async getDiffContent(filePath?: string, staged?: boolean): Promise<void> {
    try {
      const files = staged
        ? await this.gitService.getStagedDiff(filePath)
        : await this.gitService.getFullDiff(filePath);
      this.postMessage({
        type: 'diffContent',
        payload: { files, staged: !!staged },
      });
    } catch (error) {
      this.postMessage({
        type: 'error',
        payload: { message: error instanceof Error ? error.message : 'Diff content error' },
      });
    }
  }

  public async commit(message: string): Promise<void> {
    try {
      await this.gitService.commit(message);
      this.postMessage({
        type: 'gitResult',
        payload: { success: true, message: 'Committed successfully' },
      });
    } catch (error) {
      this.postMessage({
        type: 'gitResult',
        payload: { success: false, message: error instanceof Error ? error.message : 'Commit failed' },
      });
    }
  }

  public async push(): Promise<void> {
    try {
      await this.gitService.push();
      this.postMessage({
        type: 'gitResult',
        payload: { success: true, message: 'Pushed successfully' },
      });
    } catch (error) {
      this.postMessage({
        type: 'gitResult',
        payload: { success: false, message: error instanceof Error ? error.message : 'Push failed' },
      });
    }
  }
}
