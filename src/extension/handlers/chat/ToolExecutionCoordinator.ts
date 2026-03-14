// ===================================================
// ToolExecutionCoordinator — tool use handling
// ===================================================
// Extracted from ChatHandler to coordinate tool
// approval, execution, and result reporting.
// Includes rate limiting to prevent abuse.
// ===================================================

import * as vscode from 'vscode';
import { exec } from 'child_process';
import type { ExtensionToWebviewMessage } from '../../../shared/messages';
import type { ToolUse } from '../../../shared/types';
import { SettingsService } from '../../services/SettingsService';
import { validatePathSecurity } from '../../../shared/utils/pathValidation';

// -------------------------------------------------
// Rate limiter — tracks tool calls per minute
// -------------------------------------------------
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_CALLS = 30;     // max 30 tool calls per minute

interface RateLimitEntry {
  timestamps: number[];
}

export class ToolExecutionCoordinator {
  // Pending tool approvals — toolUseId -> { resolve, toolUse }
  private pendingToolApprovals: Map<string, {
    resolve: (approved: boolean) => void;
    toolUse: ToolUse;
  }> = new Map();

  // Rate limiter state
  private rateLimitState: RateLimitEntry = { timestamps: [] };

  constructor(
    private readonly settingsService: SettingsService,
    private readonly postMessage: (msg: ExtensionToWebviewMessage) => void,
  ) {}

  // -------------------------------------------------
  // handleToolUse — handle a tool use request from Claude
  // -------------------------------------------------
  public handleToolUse(toolUse: ToolUse, messageId: string): void {
    const settings = this.settingsService.getSettings();
    const permission = settings.permissionPreset;

    // Update the message with tool info
    this.postMessage({
      type: 'updateMessage',
      payload: { id: messageId, updates: { toolUses: [toolUse] } },
    });

    const needsApproval = this.checkNeedsApproval(toolUse.name, permission);

    if (needsApproval) {
      toolUse.status = 'pending';
      this.postMessage({
        type: 'toolPermissionRequest',
        payload: { toolUseId: toolUse.id, toolName: toolUse.name, input: toolUse.input },
      });

      new Promise<boolean>((resolve) => {
        this.pendingToolApprovals.set(toolUse.id, { resolve, toolUse });
      }).then((approved) => {
        if (approved) {
          this.executeToolAndReport(toolUse);
        } else {
          this.postMessage({
            type: 'toolResult',
            payload: { toolUseId: toolUse.id, output: 'Tool use denied by user', status: 'failed' },
          });
        }
      }).catch((err) => {
        console.error('[ToolExecutionCoordinator] Tool approval error:', err);
      });
    } else {
      this.executeToolAndReport(toolUse);
    }
  }

  // -------------------------------------------------
  // checkNeedsApproval — check if a tool requires approval
  // -------------------------------------------------
  private checkNeedsApproval(
    toolName: string,
    permission: 'conservative' | 'normal' | 'full',
  ): boolean {
    if (permission === 'full') return false;
    if (permission === 'conservative') return true;

    const readOnlyTools = ['read_file', 'search_files', 'search_content', 'list_files'];
    return !readOnlyTools.includes(toolName);
  }

  // -------------------------------------------------
  // checkRateLimit — enforce rate limiting
  // -------------------------------------------------
  private checkRateLimit(): boolean {
    const now = Date.now();
    // Prune old entries
    this.rateLimitState.timestamps = this.rateLimitState.timestamps.filter(
      (ts) => now - ts < RATE_LIMIT_WINDOW_MS,
    );

    if (this.rateLimitState.timestamps.length >= RATE_LIMIT_MAX_CALLS) {
      return false; // rate limited
    }

    this.rateLimitState.timestamps.push(now);
    return true;
  }

  // -------------------------------------------------
  // executeToolAndReport — execute tool and report result
  // -------------------------------------------------
  private async executeToolAndReport(toolUse: ToolUse): Promise<void> {
    // Check rate limit before executing
    if (!this.checkRateLimit()) {
      this.postMessage({
        type: 'toolResult',
        payload: {
          toolUseId: toolUse.id,
          output: `Rate limit exceeded: maximum ${RATE_LIMIT_MAX_CALLS} tool calls per minute. Please wait before trying again.`,
          status: 'failed',
        },
      });
      return;
    }

    try {
      const output = await this.executeTool(toolUse);

      this.postMessage({
        type: 'toolResult',
        payload: { toolUseId: toolUse.id, output, status: 'completed' },
      });
    } catch (error) {
      const toolName = toolUse.name;
      const inputSummary = JSON.stringify(toolUse.input).substring(0, 100);
      const errMsg = error instanceof Error ? error.message : 'Tool execution failed';
      this.postMessage({
        type: 'toolResult',
        payload: {
          toolUseId: toolUse.id,
          output: `Error executing tool "${toolName}" (input: ${inputSummary}): ${errMsg}`,
          status: 'failed',
        },
      });
    }
  }

  // -------------------------------------------------
  // getWorkspaceRoots — helper to get workspace root paths
  // -------------------------------------------------
  private getWorkspaceRoots(): string[] {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) return [];
    return folders.map((f) => f.uri.fsPath);
  }

  // -------------------------------------------------
  // executeTool — execute a tool by type
  // -------------------------------------------------
  private async executeTool(toolUse: ToolUse): Promise<string> {
    const input = toolUse.input;
    const workspaceRoots = this.getWorkspaceRoots();

    switch (toolUse.name) {
      case 'read_file': {
        const filePath = input.path as string;
        if (!filePath) return 'Error: No file path provided';
        try {
          const safePath = validatePathSecurity(filePath, workspaceRoots);
          const uri = vscode.Uri.file(safePath);
          const data = await vscode.workspace.fs.readFile(uri);
          return new TextDecoder().decode(data);
        } catch (err) {
          const msg = err instanceof Error ? err.message : `Could not read file "${filePath}"`;
          return `Error reading file "${filePath}": ${msg}`;
        }
      }

      case 'write_file': {
        const filePath = input.path as string;
        const content = input.content as string;
        if (!filePath || content === undefined) return 'Error: Missing path or content for write_file';
        try {
          const safePath = validatePathSecurity(filePath, workspaceRoots);
          const uri = vscode.Uri.file(safePath);
          await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(content));
          return `File written: ${safePath}`;
        } catch (err) {
          const msg = err instanceof Error ? err.message : `Could not write file "${filePath}"`;
          return `Error writing file "${filePath}": ${msg}`;
        }
      }

      case 'edit_file': {
        const filePath = input.path as string;
        const oldText = input.old_text as string;
        const newText = input.new_text as string;
        if (!filePath || !oldText) return 'Error: Missing path or old_text for edit_file';
        try {
          const safePath = validatePathSecurity(filePath, workspaceRoots);
          const uri = vscode.Uri.file(safePath);
          const data = await vscode.workspace.fs.readFile(uri);
          const currentContent = new TextDecoder().decode(data);
          if (!currentContent.includes(oldText)) {
            return `Error editing file "${filePath}": old_text not found in file`;
          }
          const updated = currentContent.replace(oldText, newText);
          await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(updated));
          return `File edited: ${safePath}`;
        } catch (err) {
          const msg = err instanceof Error ? err.message : `Could not edit file "${filePath}"`;
          return `Error editing file "${filePath}": ${msg}`;
        }
      }

      case 'list_files': {
        const dirPath = (input.path as string) || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!dirPath) return 'Error: No directory path for list_files';
        try {
          const safePath = validatePathSecurity(dirPath, workspaceRoots);
          const uri = vscode.Uri.file(safePath);
          const entries = await vscode.workspace.fs.readDirectory(uri);
          return entries
            .map(([name, type]) => `${type === vscode.FileType.Directory ? '\u{1F4C1}' : '\u{1F4C4}'} ${name}`)
            .join('\n');
        } catch (err) {
          const msg = err instanceof Error ? err.message : `Could not list directory "${dirPath}"`;
          return `Error listing directory "${dirPath}": ${msg}`;
        }
      }

      case 'search_files': {
        const pattern = input.pattern as string;
        if (!pattern) return 'Error: No search pattern for search_files';
        try {
          const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**', 50);
          return files.map((f) => f.fsPath).join('\n') || 'No files found';
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'unknown error';
          return `Error searching files with pattern "${pattern}": ${msg}`;
        }
      }

      case 'search_content': {
        const query = input.query as string;
        if (!query) return 'Error: No search query for search_content';
        try {
          const files = await vscode.workspace.findFiles('**/*', '**/node_modules/**', 100);
          const results: string[] = [];
          for (const file of files.slice(0, 20)) {
            try {
              const data = await vscode.workspace.fs.readFile(file);
              const content = new TextDecoder().decode(data);
              if (content.includes(query)) {
                const lines = content.split('\n');
                const matchLines = lines
                  .map((line, i) => ({ line, num: i + 1 }))
                  .filter((l) => l.line.includes(query));
                results.push(
                  `\u{1F4C4} ${file.fsPath}:\n` +
                  matchLines.slice(0, 3).map((m) => `  L${m.num}: ${m.line.trim()}`).join('\n'),
                );
              }
            } catch {
              // binary file — skip
            }
          }
          return results.join('\n\n') || 'No matches found';
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'unknown error';
          return `Error searching content for query "${query}": ${msg}`;
        }
      }

      case 'run_command': {
        const command = input.command as string;
        if (!command) return 'Error: No command provided for run_command';
        const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        return new Promise((resolve) => {
          exec(command, { cwd, timeout: 30000 }, (error: Error | null, stdout: string, stderr: string) => {
            if (error) {
              resolve(`Error running command "${command}" (exit ${(error as NodeJS.ErrnoException).code}): ${stderr || error.message}`);
            } else {
              resolve(stdout || stderr || '(no output)');
            }
          });
        });
      }

      default:
        return `Tool "${toolUse.name}" is not implemented`;
    }
  }

  // -------------------------------------------------
  // approveToolUse — approve a pending tool use
  // -------------------------------------------------
  public approveToolUse(toolUseId: string): void {
    const pending = this.pendingToolApprovals.get(toolUseId);
    if (pending) {
      pending.toolUse.status = 'approved';
      pending.resolve(true);
      this.pendingToolApprovals.delete(toolUseId);
    }
  }

  // -------------------------------------------------
  // denyToolUse — deny a pending tool use
  // -------------------------------------------------
  public denyToolUse(toolUseId: string): void {
    const pending = this.pendingToolApprovals.get(toolUseId);
    if (pending) {
      pending.toolUse.status = 'denied';
      pending.resolve(false);
      this.pendingToolApprovals.delete(toolUseId);
    }
  }

  // -------------------------------------------------
  // rejectAllPending — reject all pending approvals
  // -------------------------------------------------
  public rejectAllPending(): void {
    for (const [, pending] of this.pendingToolApprovals) {
      pending.resolve(false);
    }
    this.pendingToolApprovals.clear();
  }
}
