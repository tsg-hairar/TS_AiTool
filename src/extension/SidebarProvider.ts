// ===================================================
// SidebarProvider — הגשר המרכזי בין VS Code ל-React
// ===================================================
// WebviewViewProvider — מנהל את ה-Webview (React) שרץ בתוך VS Code
// מקבל הודעות מה-Webview ומעביר אותן לשירותים המתאימים
// ===================================================

import * as vscode from 'vscode';
import type { WebviewToExtensionMessage, ExtensionToWebviewMessage } from '../shared/messages';
import { ProjectManager } from './services/ProjectManager';
import { ConversationStore } from './services/ConversationStore';
import { SettingsService } from './services/SettingsService';
import { GitService } from './services/GitService';
import { NotificationService } from './services/NotificationService';
import { ChatHandler } from './handlers/ChatHandler';
import { ProjectHandler } from './handlers/ProjectHandler';
import { AgentHandler } from './handlers/AgentHandler';
import { GitHandler } from './handlers/GitHandler';
import { SettingsHandler } from './handlers/SettingsHandler';
import { SlashCommandHandler } from './handlers/SlashCommandHandler';

export class SidebarProvider implements vscode.WebviewViewProvider {
  // ה-Webview View — מייצג את הפאנל ב-VS Code
  private _view?: vscode.WebviewView;

  // Handlers — כל אחד אחראי על תחום
  private chatHandler: ChatHandler;
  private projectHandler: ProjectHandler;
  private agentHandler: AgentHandler;
  private gitHandler: GitHandler;
  private settingsHandler: SettingsHandler;
  private slashCommandHandler: SlashCommandHandler;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly projectManager: ProjectManager,
    private readonly conversationStore: ConversationStore,
    private readonly settingsService: SettingsService,
    private readonly gitService: GitService,
    private readonly notificationService: NotificationService,
  ) {
    // אתחול כל ה-Handlers עם הפונקציה לשליחת הודעות ל-Webview
    const postMessage = (msg: ExtensionToWebviewMessage) => this.postMessage(msg);

    this.chatHandler = new ChatHandler(
      context, settingsService, conversationStore, postMessage,
    );
    this.projectHandler = new ProjectHandler(
      projectManager, postMessage,
    );
    this.agentHandler = new AgentHandler(
      context, settingsService, conversationStore, postMessage,
    );
    this.gitHandler = new GitHandler(
      gitService, postMessage,
    );
    this.settingsHandler = new SettingsHandler(
      settingsService, postMessage,
    );
    this.slashCommandHandler = new SlashCommandHandler(
      this.chatHandler, this.gitHandler, postMessage,
    );
  }

  // -------------------------------------------------
  // resolveWebviewView — VS Code קורא לזה כשצריך ליצור את הפאנל
  // -------------------------------------------------
  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _resolveContext: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this._view = webviewView;

    // הגדרות ה-Webview
    webviewView.webview.options = {
      // מאפשר הרצת JavaScript ב-Webview
      enableScripts: true,
      // מגביל גישה לקבצים רק לתיקיית dist
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview'),
        vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'assets'),
        vscode.Uri.joinPath(this.context.extensionUri, 'media'),
      ],
    };

    // הגדרת ה-HTML של ה-Webview
    webviewView.webview.html = this.getWebviewContent(webviewView.webview);

    // --- האזנה להודעות מה-Webview ---
    webviewView.webview.onDidReceiveMessage(
      (message: WebviewToExtensionMessage) => {
        this.handleWebviewMessage(message);
      },
      undefined,
      this.context.subscriptions,
    );

    // כשה-Webview מתגלה — שולחים מידע התחלתי
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this.sendInitialData();
      }
    });
  }

  // -------------------------------------------------
  // handleWebviewMessage — ניתוב הודעות מה-Webview לטיפול
  // -------------------------------------------------
  private async handleWebviewMessage(message: WebviewToExtensionMessage): Promise<void> {
    try {
      switch (message.type) {
        // --- צ'אט ---
        case 'sendMessage':
          await this.chatHandler.sendMessage(message.payload.content, message.payload.images);
          break;
        case 'cancelRequest':
          this.chatHandler.cancelRequest();
          break;
        case 'clearChat':
          this.chatHandler.clearChat();
          break;
        case 'newChat':
          this.chatHandler.newChat();
          break;
        case 'loadConversation':
          await this.chatHandler.loadConversation(message.payload.conversationId);
          break;
        case 'deleteConversation':
          this.chatHandler.deleteConversation(message.payload.conversationId);
          break;
        case 'toggleBookmark':
          this.chatHandler.toggleBookmark(message.payload.messageId);
          break;
        case 'togglePin':
          this.chatHandler.togglePin(message.payload.messageId);
          break;

        // --- פרויקטים ---
        case 'createProject':
          await this.projectHandler.createProject(message.payload);
          break;
        case 'openProject':
          // פתיחת פרויקט + עדכון ה-ChatHandler עם הפרויקט הנוכחי
          await this.projectHandler.openProject(message.payload.projectId);
          this.chatHandler.setContext(
            message.payload.projectId,
            this.agentHandler.getCurrentAgent(),
          );
          break;
        case 'deleteProject':
          await this.projectHandler.deleteProject(message.payload.projectId);
          break;
        case 'refreshProject':
          await this.projectHandler.refreshProject(message.payload.projectId);
          break;
        case 'importProject':
          await this.projectHandler.importProject();
          break;
        case 'getProjects':
          await this.projectHandler.getProjects();
          break;
        case 'getProjectHealth':
          await this.projectHandler.getProjectHealth(message.payload.projectId);
          break;

        // --- סוכנים ---
        case 'switchAgent':
          await this.agentHandler.switchAgent(message.payload.agentId);
          // עדכון הסוכן הנוכחי ב-ChatHandler
          this.chatHandler.setContext(
            this.chatHandler.getCurrentProjectId() ?? '',
            message.payload.agentId,
          );
          break;
        case 'runWorkflow':
          await this.agentHandler.runWorkflow(message.payload.workflowId, message.payload.input);
          break;
        case 'cancelWorkflow':
          this.agentHandler.cancelWorkflow();
          break;

        // --- הגדרות ---
        case 'getSettings':
          this.settingsHandler.getSettings();
          break;
        case 'updateSettings':
          await this.settingsHandler.updateSettings(message.payload);
          break;
        case 'switchModel':
          await this.settingsHandler.switchModel(message.payload.model);
          break;

        // --- Git ---
        case 'getGitInfo':
          await this.gitHandler.getGitInfo();
          break;
        case 'getGitDiff':
          await this.gitHandler.getGitDiff();
          break;
        case 'gitCommit':
          await this.gitHandler.commit(message.payload.message);
          break;
        case 'gitPush':
          await this.gitHandler.push();
          break;

        // --- Slash Commands ---
        case 'slashCommand':
          await this.slashCommandHandler.execute(message.payload.command, message.payload.args);
          break;

        // --- כלים ---
        case 'approveToolUse':
          this.chatHandler.approveToolUse(message.payload.toolUseId);
          break;
        case 'denyToolUse':
          this.chatHandler.denyToolUse(message.payload.toolUseId);
          break;

        // --- Terminal ---
        case 'runTerminalCommand':
          await this.handleTerminalCommand(message.payload.command);
          break;

        // --- Webview מוכן ---
        case 'webviewReady':
          await this.sendInitialData();
          break;

        default:
          console.warn('Unknown message type:', (message as { type: string }).type);
      }
    } catch (error) {
      // שגיאה כללית — שולחים הודעת שגיאה ל-Webview
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      this.postMessage({
        type: 'error',
        payload: { message: errMsg },
      });
    }
  }

  // -------------------------------------------------
  // handleCommand — פקודות שמגיעות מ-VS Code (לא מה-Webview)
  // -------------------------------------------------
  public handleCommand(command: string): void {
    switch (command) {
      case 'newChat':
        this.chatHandler.newChat();
        break;
      case 'cancel':
        this.chatHandler.cancelRequest();
        break;
      case 'clearChat':
        this.chatHandler.clearChat();
        break;
      case 'newProject':
        this.projectHandler.importProject();
        break;
      case 'settingsChanged':
        this.settingsHandler.getSettings();
        break;
      case 'workspaceChanged':
        this.projectHandler.getProjects();
        break;
      default:
        // פקודות שעדיין לא מימשנו — שולחים ל-Webview
        this.postMessage({
          type: 'notification',
          payload: {
            id: Date.now().toString(),
            type: 'info',
            category: 'system',
            title: 'פקודה',
            message: `${command} — בקרוב!`,
            priority: 'low',
            timestamp: new Date().toISOString(),
          },
        });
    }
  }

  // -------------------------------------------------
  // notifyActiveFileChanged — עדכון קובץ פעיל
  // -------------------------------------------------
  public notifyActiveFileChanged(filePath: string): void {
    this.postMessage({
      type: 'activeFileChanged',
      payload: { filePath },
    });
  }

  // -------------------------------------------------
  // postMessage — שליחת הודעה ל-Webview
  // -------------------------------------------------
  private postMessage(message: ExtensionToWebviewMessage): void {
    this._view?.webview.postMessage(message);
  }

  // -------------------------------------------------
  // sendInitialData — שליחת מידע ראשוני כשה-Webview נפתח
  // -------------------------------------------------
  private async sendInitialData(): Promise<void> {
    // שולחים הגדרות
    this.settingsHandler.getSettings();

    // שולחים רשימת פרויקטים
    await this.projectHandler.getProjects();

    // --- ייבוא אוטומטי של ה-workspace הפתוח ---
    // אם יש תיקייה פתוחה ב-VS Code ואין פרויקטים — מייבאים אוטומטית
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      const existing = this.projectManager.getProjects();
      const alreadyImported = existing.some(
        (p) => p.path === workspaceFolder.uri.fsPath,
      );

      if (!alreadyImported) {
        // ייבוא אוטומטי של ה-workspace כפרויקט
        const folderName = workspaceFolder.name;
        try {
          const project = await this.projectManager.createProject(
            folderName,
            workspaceFolder.uri.fsPath,
          );
          this.postMessage({ type: 'projectCreated', payload: project });
          // פתיחה אוטומטית
          this.postMessage({ type: 'projectOpened', payload: project });
          this.chatHandler.setContext(project.id, this.agentHandler.getCurrentAgent());
          // רענון רשימה
          await this.projectHandler.getProjects();
        } catch {
          // שקט — לא קריטי
        }
      } else {
        // אם הפרויקט כבר קיים — פותחים אותו אוטומטית
        const project = existing.find((p) => p.path === workspaceFolder.uri.fsPath);
        if (project) {
          this.postMessage({ type: 'projectOpened', payload: project });
          this.chatHandler.setContext(project.id, this.agentHandler.getCurrentAgent());
        }
      }
    }

    // שולחים רשימת סוכנים
    this.agentHandler.sendAgentList();

    // שולחים רשימת workflows
    this.agentHandler.sendWorkflowList();
  }

  // -------------------------------------------------
  // handleTerminalCommand — הרצת פקודה בטרמינל
  // -------------------------------------------------
  private async handleTerminalCommand(command: string): Promise<void> {
    const { exec } = await import('child_process');
    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    exec(command, { cwd, timeout: 30000 }, (error, stdout, stderr) => {
      this.postMessage({
        type: 'terminalOutput',
        payload: {
          output: stdout || stderr || error?.message || '',
          exitCode: error ? error.code ?? 1 : 0,
        },
      });
    });
  }

  // -------------------------------------------------
  // getWebviewContent — בניית ה-HTML של ה-Webview
  // -------------------------------------------------
  private getWebviewContent(webview: vscode.Webview): string {
    // נתיב לקבצי ה-Webview (React build output)
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'index.js'),
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'assets', 'index.css'),
    );

    // Nonce לאבטחת CSP — מונע הזרקת סקריפטים זדוניים
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="
    default-src 'none';
    style-src ${webview.cspSource} 'unsafe-inline';
    script-src 'nonce-${nonce}';
    img-src ${webview.cspSource} data: https:;
    font-src ${webview.cspSource} https://fonts.gstatic.com;
    connect-src https://api.anthropic.com https://fonts.googleapis.com;
  ">
  <link rel="stylesheet" href="${styleUri}">
  <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <title>TS AiTool</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

// -------------------------------------------------
// getNonce — יצירת מחרוזת אקראית לאבטחת CSP
// -------------------------------------------------
function getNonce(): string {
  let text = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}
