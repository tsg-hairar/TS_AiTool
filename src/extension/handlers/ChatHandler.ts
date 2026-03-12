// ===================================================
// ChatHandler — טיפול בהודעות צ'אט
// ===================================================
// אחראי על שליחת הודעות, streaming, bookmarks, pins
// כולל טיפול בשימוש בכלים ואישור/דחייה שלהם
// ===================================================

import * as vscode from 'vscode';
import type { ExtensionToWebviewMessage } from '../../shared/messages';
import type { ChatMessage, AgentId, ToolUse } from '../../shared/types';
import { BUILT_IN_AGENTS } from '../../shared/constants';
import { ClaudeService } from '../services/ClaudeService';
import { ConversationStore } from '../services/ConversationStore';
import { SettingsService } from '../services/SettingsService';

export class ChatHandler {
  private claudeService: ClaudeService;
  private currentProjectId: string | null = null;
  private currentAgentId: AgentId = 'developer';
  // מפה של כלים שמחכים לאישור — toolUseId → { resolve, toolUse }
  private pendingToolApprovals: Map<string, {
    resolve: (approved: boolean) => void;
    toolUse: ToolUse;
  }> = new Map();

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly settingsService: SettingsService,
    private readonly conversationStore: ConversationStore,
    private readonly postMessage: (msg: ExtensionToWebviewMessage) => void,
  ) {
    this.claudeService = new ClaudeService();

    // אתחול Claude —
    // אם יש API key → API mode (משלם לפי טוקנים)
    // אם אין → CLI mode (דרך המנוי שלך!)
    const apiKey = settingsService.getApiKey();
    this.claudeService.initialize(apiKey || undefined);
  }

  // -------------------------------------------------
  // setContext — הגדרת פרויקט וסוכן נוכחיים
  // -------------------------------------------------
  public setContext(projectId: string, agentId: AgentId): void {
    this.currentProjectId = projectId;
    this.currentAgentId = agentId;
  }

  // קבלת מזהה הפרויקט הנוכחי
  public getCurrentProjectId(): string | null {
    return this.currentProjectId;
  }

  // -------------------------------------------------
  // sendMessage — שליחת הודעה ל-Claude
  // -------------------------------------------------
  public async sendMessage(content: string, images?: string[]): Promise<void> {
    // אתחול Claude אם צריך
    if (!this.claudeService.isReady()) {
      const apiKey = this.settingsService.getApiKey();
      this.claudeService.initialize(apiKey || undefined);
    }

    // יצירת שיחה אם אין פעילה
    // אם אין פרויקט — נשתמש ב-"quick-chat" כמזהה זמני
    const projectId = this.currentProjectId || 'quick-chat';
    if (!this.conversationStore.getActiveId()) {
      await this.conversationStore.create(projectId, this.currentAgentId);
    }

    const conversationId = this.conversationStore.getActiveId();
    if (!conversationId) return;

    // יצירת הודעת משתמש
    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
      images: images?.map((data, i) => ({
        id: `img-${Date.now()}-${i}`,
        name: `image-${i}.png`,
        mimeType: 'image/png',
        data,
      })),
    };

    // שמירה ושליחה ל-UI
    await this.conversationStore.addMessage(conversationId, userMessage);
    this.postMessage({ type: 'addMessage', payload: userMessage });

    // עדכון סטטוס — חושב...
    this.postMessage({
      type: 'statusUpdate',
      payload: { status: 'thinking' },
    });

    // יצירת הודעת assistant ריקה (תתמלא ב-streaming)
    const assistantMessageId = generateId();
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      agentId: this.currentAgentId,
      isStreaming: true,
      toolUses: [],
    };

    this.postMessage({ type: 'addMessage', payload: assistantMessage });

    // הכנת system prompt
    const agent = BUILT_IN_AGENTS[this.currentAgentId];
    const settings = this.settingsService.getSettings();

    let systemPrompt = agent.systemPrompt;

    // הוספת מצב למידה
    if (settings.learningMode) {
      systemPrompt += '\n\nLEARNING MODE: Add detailed Hebrew comments to ALL code you write. Explain every step.';
    }

    // הוספת שפה
    systemPrompt += `\n\nUser language: ${settings.language === 'he' ? 'Hebrew' : 'English'}. Respond in this language.`;

    // קבלת היסטוריית שיחה
    const conversation = this.conversationStore.get(conversationId);
    const messages = conversation?.messages ?? [];

    // שליחה ל-Claude עם streaming
    await this.claudeService.sendMessage(
      messages,
      systemPrompt,
      settings.model,
      settings.maxTokens,
      {
        onToken: (token) => {
          // שליחת כל טוקן ל-UI בזמן אמת
          this.postMessage({
            type: 'streamToken',
            payload: { messageId: assistantMessageId, token },
          });
        },
        onComplete: async (fullText, tokenCount) => {
          // שמירת ההודעה המלאה
          const finalMessage: ChatMessage = {
            ...assistantMessage,
            content: fullText,
            tokenCount,
            isStreaming: false,
          };

          await this.conversationStore.addMessage(conversationId, finalMessage);

          // עדכון UI
          this.postMessage({
            type: 'streamComplete',
            payload: {
              messageId: assistantMessageId,
              fullContent: fullText,
              tokenCount,
            },
          });

          // עדכון סטטוס
          this.postMessage({
            type: 'statusUpdate',
            payload: { status: 'idle' },
          });

          // עדכון עלות
          const cost = ClaudeService.estimateCost(settings.model, tokenCount * 0.3, tokenCount * 0.7);
          this.postMessage({
            type: 'costUpdate',
            payload: {
              sessionCost: cost,
              totalTokens: tokenCount,
            },
          });
        },
        onToolUse: (toolUse) => {
          // --- טיפול בשימוש בכלים ---
          // שולחים ל-UI להצגה + בקשת אישור
          this.handleToolUse(toolUse, assistantMessageId);
        },
        onError: (error) => {
          this.postMessage({
            type: 'error',
            payload: { message: error.message },
          });
          this.postMessage({
            type: 'statusUpdate',
            payload: { status: 'error', message: error.message },
          });
        },
      },
    );
  }

  // -------------------------------------------------
  // handleToolUse — טיפול בשימוש בכלי
  // -------------------------------------------------
  // כש-Claude רוצה להשתמש בכלי, בודקים את הרשאות המשתמש:
  // - conservative: תמיד מבקשים אישור
  // - normal: קריאה אוטומטית, כתיבה דורשת אישור
  // - full: הכל אוטומטי (ללא אישורים)
  // -------------------------------------------------
  private handleToolUse(toolUse: ToolUse, messageId: string): void {
    const settings = this.settingsService.getSettings();
    const permission = settings.permissionPreset;

    // עדכון ההודעה עם מידע על הכלי
    this.postMessage({
      type: 'updateMessage',
      payload: {
        id: messageId,
        updates: {
          toolUses: [toolUse],
        },
      },
    });

    // בדיקה אם צריך אישור
    const needsApproval = this.checkNeedsApproval(toolUse.name, permission);

    if (needsApproval) {
      // שולחים בקשת אישור ל-UI
      toolUse.status = 'pending';
      this.postMessage({
        type: 'toolPermissionRequest',
        payload: {
          toolUseId: toolUse.id,
          toolName: toolUse.name,
          input: toolUse.input,
        },
      });

      // שומרים את ה-promise להמשך אחרי אישור/דחייה
      new Promise<boolean>((resolve) => {
        this.pendingToolApprovals.set(toolUse.id, { resolve, toolUse });
      }).then((approved) => {
        if (approved) {
          this.executeToolAndReport(toolUse);
        } else {
          this.postMessage({
            type: 'toolResult',
            payload: {
              toolUseId: toolUse.id,
              output: 'Tool use denied by user',
              status: 'failed',
            },
          });
        }
      });
    } else {
      // אישור אוטומטי — מריצים מיד
      this.executeToolAndReport(toolUse);
    }
  }

  // -------------------------------------------------
  // checkNeedsApproval — בדיקה אם כלי דורש אישור
  // -------------------------------------------------
  private checkNeedsApproval(
    toolName: string,
    permission: 'conservative' | 'normal' | 'full',
  ): boolean {
    if (permission === 'full') return false; // הכל אוטומטי
    if (permission === 'conservative') return true; // תמיד מבקשים

    // normal — כלים קריאה-בלבד אוטומטיים, כתיבה דורשת אישור
    const readOnlyTools = ['read_file', 'search_files', 'search_content', 'list_files'];
    return !readOnlyTools.includes(toolName);
  }

  // -------------------------------------------------
  // executeToolAndReport — הרצת כלי ודיווח תוצאה
  // -------------------------------------------------
  private async executeToolAndReport(toolUse: ToolUse): Promise<void> {
    try {
      // הרצת הכלי לפי סוג
      const output = await this.executeTool(toolUse);

      this.postMessage({
        type: 'toolResult',
        payload: {
          toolUseId: toolUse.id,
          output,
          status: 'completed',
        },
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Tool execution failed';
      this.postMessage({
        type: 'toolResult',
        payload: {
          toolUseId: toolUse.id,
          output: errMsg,
          status: 'failed',
        },
      });
    }
  }

  // -------------------------------------------------
  // executeTool — הרצת כלי בפועל
  // -------------------------------------------------
  private async executeTool(toolUse: ToolUse): Promise<string> {
    const input = toolUse.input;

    switch (toolUse.name) {
      case 'read_file': {
        // קריאת קובץ
        const filePath = input.path as string;
        if (!filePath) return 'Error: No file path provided';
        try {
          const uri = vscode.Uri.file(filePath);
          const data = await vscode.workspace.fs.readFile(uri);
          return new TextDecoder().decode(data);
        } catch {
          return `Error: Could not read file ${filePath}`;
        }
      }

      case 'write_file': {
        // כתיבת קובץ
        const filePath = input.path as string;
        const content = input.content as string;
        if (!filePath || content === undefined) return 'Error: Missing path or content';
        try {
          const uri = vscode.Uri.file(filePath);
          await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(content));
          return `File written: ${filePath}`;
        } catch {
          return `Error: Could not write file ${filePath}`;
        }
      }

      case 'edit_file': {
        // עריכת קובץ — החלפת טקסט
        const filePath = input.path as string;
        const oldText = input.old_text as string;
        const newText = input.new_text as string;
        if (!filePath || !oldText) return 'Error: Missing path or old_text';
        try {
          const uri = vscode.Uri.file(filePath);
          const data = await vscode.workspace.fs.readFile(uri);
          const currentContent = new TextDecoder().decode(data);
          if (!currentContent.includes(oldText)) {
            return 'Error: old_text not found in file';
          }
          const updated = currentContent.replace(oldText, newText);
          await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(updated));
          return `File edited: ${filePath}`;
        } catch {
          return `Error: Could not edit file ${filePath}`;
        }
      }

      case 'list_files': {
        // רשימת קבצים בתיקייה
        const dirPath = (input.path as string) || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!dirPath) return 'Error: No directory path';
        try {
          const uri = vscode.Uri.file(dirPath);
          const entries = await vscode.workspace.fs.readDirectory(uri);
          return entries
            .map(([name, type]) => `${type === vscode.FileType.Directory ? '📁' : '📄'} ${name}`)
            .join('\n');
        } catch {
          return `Error: Could not list directory ${dirPath}`;
        }
      }

      case 'search_files': {
        // חיפוש קבצים לפי תבנית
        const pattern = input.pattern as string;
        if (!pattern) return 'Error: No search pattern';
        try {
          const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**', 50);
          return files.map((f) => f.fsPath).join('\n') || 'No files found';
        } catch {
          return `Error: Search failed for pattern ${pattern}`;
        }
      }

      case 'search_content': {
        // חיפוש תוכן בקבצים
        const query = input.query as string;
        if (!query) return 'Error: No search query';
        try {
          // שימוש ב-VS Code search API
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
                  `📄 ${file.fsPath}:\n` +
                  matchLines.slice(0, 3).map((m) => `  L${m.num}: ${m.line.trim()}`).join('\n'),
                );
              }
            } catch {
              // קובץ בינארי — דילוג
            }
          }
          return results.join('\n\n') || 'No matches found';
        } catch {
          return `Error: Content search failed`;
        }
      }

      case 'run_command': {
        // הרצת פקודת terminal
        const command = input.command as string;
        if (!command) return 'Error: No command provided';
        const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        return new Promise((resolve) => {
          const { exec } = require('child_process');
          exec(command, { cwd, timeout: 30000 }, (error: Error | null, stdout: string, stderr: string) => {
            if (error) {
              resolve(`Error (exit ${(error as NodeJS.ErrnoException).code}): ${stderr || error.message}`);
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
  // cancelRequest — ביטול הבקשה
  // -------------------------------------------------
  public cancelRequest(): void {
    this.claudeService.cancel();
    // ביטול כל האישורים הממתינים
    for (const [, pending] of this.pendingToolApprovals) {
      pending.resolve(false);
    }
    this.pendingToolApprovals.clear();

    this.postMessage({
      type: 'statusUpdate',
      payload: { status: 'idle' },
    });
  }

  // -------------------------------------------------
  // newChat — שיחה חדשה
  // -------------------------------------------------
  public async newChat(): Promise<void> {
    if (this.currentProjectId) {
      await this.conversationStore.create(this.currentProjectId, this.currentAgentId);
    }
    this.postMessage({ type: 'chatCleared' });
  }

  // -------------------------------------------------
  // clearChat — ניקוי שיחה
  // -------------------------------------------------
  public async clearChat(): Promise<void> {
    const activeId = this.conversationStore.getActiveId();
    if (activeId) {
      await this.conversationStore.clearMessages(activeId);
    }
    this.postMessage({ type: 'chatCleared' });
  }

  // -------------------------------------------------
  // loadConversation — טעינת שיחה
  // -------------------------------------------------
  public async loadConversation(conversationId: string): Promise<void> {
    const conversation = this.conversationStore.get(conversationId);
    if (conversation) {
      this.conversationStore.setActive(conversationId);
      this.postMessage({
        type: 'conversationLoaded',
        payload: conversation,
      });
    }
  }

  // -------------------------------------------------
  // deleteConversation — מחיקת שיחה
  // -------------------------------------------------
  public async deleteConversation(conversationId: string): Promise<void> {
    await this.conversationStore.delete(conversationId);
  }

  // -------------------------------------------------
  // toggleBookmark — סימון/ביטול סימון הודעה
  // -------------------------------------------------
  public async toggleBookmark(messageId: string): Promise<void> {
    const activeId = this.conversationStore.getActiveId();
    if (!activeId) return;

    const conversation = this.conversationStore.get(activeId);
    const message = conversation?.messages.find((m) => m.id === messageId);
    if (!message) return;

    await this.conversationStore.updateMessage(activeId, messageId, {
      isBookmarked: !message.isBookmarked,
    });

    this.postMessage({
      type: 'updateMessage',
      payload: { id: messageId, updates: { isBookmarked: !message.isBookmarked } },
    });
  }

  // -------------------------------------------------
  // togglePin — הצמדה/ביטול הצמדה
  // -------------------------------------------------
  public async togglePin(messageId: string): Promise<void> {
    const activeId = this.conversationStore.getActiveId();
    if (!activeId) return;

    const conversation = this.conversationStore.get(activeId);
    const message = conversation?.messages.find((m) => m.id === messageId);
    if (!message) return;

    await this.conversationStore.updateMessage(activeId, messageId, {
      isPinned: !message.isPinned,
    });

    this.postMessage({
      type: 'updateMessage',
      payload: { id: messageId, updates: { isPinned: !message.isPinned } },
    });
  }

  // -------------------------------------------------
  // approveToolUse — אישור שימוש בכלי
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
  // denyToolUse — דחיית שימוש בכלי
  // -------------------------------------------------
  public denyToolUse(toolUseId: string): void {
    const pending = this.pendingToolApprovals.get(toolUseId);
    if (pending) {
      pending.toolUse.status = 'denied';
      pending.resolve(false);
      this.pendingToolApprovals.delete(toolUseId);
    }
  }
}

// -------------------------------------------------
// generateId
// -------------------------------------------------
function generateId(): string {
  const bytes = new Uint8Array(16);
  require('crypto').randomFillSync(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
