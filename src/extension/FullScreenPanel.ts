// ===================================================
// FullScreenPanel — פתיחת התוסף כטאב מלא בעורך
// ===================================================
// WebviewPanel — נפתח כטאב רגיל באזור העורך
// משתמש באותו HTML ואותם Handlers כמו ה-Sidebar
// אפשר לפתוח כמה פאנלים במקביל (Split View!)
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
import { ClaudeService } from './services/ClaudeService';
import { ExportService } from './services/ExportService';
import { FileTreeService } from './services/FileTreeService';

export class FullScreenPanel {
  // Singleton-ish — שומרים רשימה של כל הפאנלים הפתוחים
  private static panels: FullScreenPanel[] = [];

  // ה-WebviewPanel עצמו — מייצג טאב בעורך
  private panel: vscode.WebviewPanel;

  // שירות Claude משותף — instance אחד לכל ה-Handlers בפאנל זה
  private claudeService: ClaudeService;

  // Handlers — אותם שירותים כמו ב-Sidebar, אבל עם postMessage נפרד
  private chatHandler: ChatHandler;
  private projectHandler: ProjectHandler;
  private agentHandler: AgentHandler;
  private gitHandler: GitHandler;
  private settingsHandler: SettingsHandler;
  private slashCommandHandler: SlashCommandHandler;
  private exportService: ExportService;
  private fileTreeService: FileTreeService;

  // -------------------------------------------------
  // createOrShow — יצירת פאנל חדש או הצגת קיים
  // -------------------------------------------------
  // viewColumn מאפשר לבחור באיזה צד של המסך לפתוח
  // אם כבר פתוח באותו עמודה — מציג את הקיים
  // -------------------------------------------------
  public static createOrShow(
    context: vscode.ExtensionContext,
    projectManager: ProjectManager,
    conversationStore: ConversationStore,
    settingsService: SettingsService,
    gitService: GitService,
    notificationService: NotificationService,
    viewColumn?: vscode.ViewColumn,
  ): FullScreenPanel {
    // בדיקה אם כבר יש פאנל פתוח בעמודה המבוקשת
    const column = viewColumn || vscode.ViewColumn.One;
    const existing = FullScreenPanel.panels.find(
      (p) => p.panel.viewColumn === column,
    );

    if (existing) {
      // כבר פתוח — מביאים לפוקוס
      existing.panel.reveal(column);
      return existing;
    }

    // יצירת פאנל חדש
    return new FullScreenPanel(
      context,
      projectManager,
      conversationStore,
      settingsService,
      gitService,
      notificationService,
      column,
    );
  }

  // -------------------------------------------------
  // Constructor — פרטי, משתמשים דרך createOrShow
  // -------------------------------------------------
  private constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly projectManager: ProjectManager,
    private readonly conversationStore: ConversationStore,
    settingsService: SettingsService,
    gitService: GitService,
    private readonly notificationService: NotificationService,
    column: vscode.ViewColumn,
  ) {
    // יצירת ה-WebviewPanel — נפתח כטאב באזור העורך
    this.panel = vscode.window.createWebviewPanel(
      'tsAiTool.fullScreen',          // מזהה ייחודי
      'TS AiTool — Full Screen',       // כותרת הטאב
      column,                           // עמודה (שמאל/ימין/מרכז)
      {
        // מאפשר JavaScript
        enableScripts: true,
        // שמירת ה-Webview כשעוברים טאב (לא נהרס!)
        retainContextWhenHidden: true,
        // הגבלת גישה לקבצים
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview'),
          vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview', 'assets'),
          vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview', 'chunks'),
          vscode.Uri.joinPath(context.extensionUri, 'media'),
        ],
      },
    );

    // אייקון לטאב
    this.panel.iconPath = vscode.Uri.joinPath(context.extensionUri, 'media', 'icon.png');

    // --- יצירת ClaudeService משותף ---
    // instance אחד שמשרת את כל ה-Handlers בפאנל זה
    this.claudeService = new ClaudeService();
    void settingsService.getApiKey().then((apiKey) =>
      this.claudeService.initialize(apiKey || undefined),
    ).catch(err => console.error('Failed to initialize Claude service:', err));

    // הגדרת CWD מה-workspace הפתוח
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (workspaceFolder) {
      this.claudeService.setWorkingDirectory(workspaceFolder);
    }

    // --- אתחול Handlers ---
    // כל פאנל מקבל סט Handlers עצמאי עם postMessage משלו
    const postMessage = (msg: ExtensionToWebviewMessage) => {
      void this.panel.webview.postMessage(msg);
    };

    this.chatHandler = new ChatHandler(context, settingsService, conversationStore, postMessage, this.claudeService);
    this.projectHandler = new ProjectHandler(projectManager, postMessage);
    this.agentHandler = new AgentHandler(context, settingsService, conversationStore, postMessage, this.claudeService);
    this.gitHandler = new GitHandler(gitService, postMessage);
    this.settingsHandler = new SettingsHandler(settingsService, postMessage);
    this.slashCommandHandler = new SlashCommandHandler(
      this.chatHandler, this.gitHandler, settingsService,
      this.claudeService, postMessage,
    );
    this.exportService = new ExportService();
    this.fileTreeService = new FileTreeService();

    // הגדרת HTML
    this.panel.webview.html = this.getWebviewContent();

    // האזנה להודעות מה-Webview
    this.panel.webview.onDidReceiveMessage(
      (message: WebviewToExtensionMessage) => { void this.handleMessage(message); },
      undefined,
      context.subscriptions,
    );

    // כשנסגר — מסירים מהרשימה + ניקוי משאבים
    this.panel.onDidDispose(
      () => {
        this.chatHandler.dispose();
        this.claudeService.dispose();
        FullScreenPanel.panels = FullScreenPanel.panels.filter((p) => p !== this);
      },
      null,
      context.subscriptions,
    );

    // הוספה לרשימה
    FullScreenPanel.panels.push(this);
  }

  // -------------------------------------------------
  // handleMessage — ניתוב הודעות (אותו דבר כמו SidebarProvider)
  // -------------------------------------------------
  private async handleMessage(message: WebviewToExtensionMessage): Promise<void> {
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
          await this.chatHandler.clearChat();
          break;
        case 'newChat':
          await this.chatHandler.newChat();
          break;
        case 'loadConversation':
          await this.chatHandler.loadConversation(message.payload.conversationId);
          break;
        case 'deleteConversation':
          await this.chatHandler.deleteConversation(message.payload.conversationId);
          break;
        case 'toggleBookmark':
          await this.chatHandler.toggleBookmark(message.payload.messageId);
          break;
        case 'togglePin':
          await this.chatHandler.togglePin(message.payload.messageId);
          break;

        // --- פרויקטים ---
        case 'createProject':
          await this.projectHandler.createProject(message.payload);
          break;
        case 'openProject': {
          await this.projectHandler.openProject(message.payload.projectId);
          const openedProject = this.projectManager.getProjects().find(
            (p) => p.id === message.payload.projectId,
          );
          this.chatHandler.setContext(
            message.payload.projectId,
            this.agentHandler.getCurrentAgent(),
            openedProject?.path,
          );
          this.chatHandler.loadLastConversation();
          break;
        }
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
          this.chatHandler.setContext(
            this.chatHandler.getCurrentProjectId() ?? '',
            message.payload.agentId,
          );
          this.chatHandler.loadLastConversation();
          break;
        case 'runWorkflow':
          await this.agentHandler.runWorkflow(message.payload.workflowId, message.payload.input);
          break;
        case 'cancelWorkflow':
          this.agentHandler.cancelWorkflow();
          break;

        // --- הגדרות ---
        case 'getSettings':
          await this.settingsHandler.getSettings();
          break;
        case 'updateSettings':
          await this.settingsHandler.updateSettings(message.payload);
          break;
        case 'storeApiKey':
          await this.settingsHandler.storeApiKey(message.payload.apiKey);
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

        // --- File Tree ---
        case 'getFileTree':
          await this.handleGetFileTree(message.payload.projectPath);
          break;
        case 'openFile':
          await this.handleOpenFile(message.payload.filePath);
          break;

        // --- חיפוש ---
        case 'searchMessages':
          this.handleSearchMessages(message.payload.query, message.payload.scope);
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

        // --- התראות ---
        case 'dismissNotification':
          this.notificationService.dismissNotification(message.payload.notificationId);
          void this.panel.webview.postMessage({
            type: 'unreadCount',
            payload: { count: this.notificationService.getUnreadCount() },
          });
          break;
        case 'clearNotifications':
          this.notificationService.clearAll();
          void this.panel.webview.postMessage({ type: 'notificationsCleared' });
          void this.panel.webview.postMessage({
            type: 'unreadCount',
            payload: { count: 0 },
          });
          break;
        case 'getNotifications':
          void this.panel.webview.postMessage({
            type: 'notificationList',
            payload: this.notificationService.getAll(),
          });
          void this.panel.webview.postMessage({
            type: 'unreadCount',
            payload: { count: this.notificationService.getUnreadCount() },
          });
          break;

        // --- Diff Content ---
        case 'getDiffContent':
          await this.gitHandler.getDiffContent(
            message.payload?.filePath,
            message.payload?.staged,
          );
          break;

        // --- טיוטות ושחזור מושב ---
        case 'saveDraft':
          this.chatHandler.saveDraft(
            message.payload.conversationId,
            message.payload.text,
          );
          break;
        case 'loadDraft':
          this.chatHandler.loadDraft(message.payload.conversationId);
          break;
        case 'saveSessionState':
          // Full-screen panels don't persist session state
          break;
        case 'requestSessionRestore':
          // Full-screen panels don't restore session state
          break;

        // --- Pinned Messages ---
        case 'getPinnedMessages':
          // Handled client-side via state.messages.filter(m => m.isPinned)
          break;

        // --- Terminal ---
        case 'runTerminalCommand':
          await this.handleTerminalCommand(message.payload.command);
          break;

        // --- ייצוא שיחה ---
        case 'exportChat':
          await this.handleExportChat(message.payload.format);
          break;

        // --- Onboarding ---
        case 'completeOnboarding':
          await this.context.globalState.update('tsAiTool.onboardingCompleted', true);
          break;
        case 'showOnboarding':
          await this.context.globalState.update('tsAiTool.onboardingCompleted', false);
          break;

        // --- Webview מוכן ---
        case 'webviewReady':
          await this.sendInitialData();
          break;
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      void this.panel.webview.postMessage({
        type: 'error',
        payload: { message: errMsg },
      });
    }
  }

  // שליחת מידע ראשוני כשה-Webview נפתח
  private async sendInitialData(): Promise<void> {
    // שולחים סטטוס onboarding
    const onboardingCompleted = this.context.globalState.get<boolean>('tsAiTool.onboardingCompleted', false);
    void this.panel.webview.postMessage({ type: 'onboardingStatus', payload: { completed: onboardingCompleted } });

    void this.settingsHandler.getSettings();
    await this.projectHandler.getProjects();

    // ייבוא אוטומטי של workspace
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      const existing = this.projectManager.getProjects();
      const project = existing.find((p) => p.path === workspaceFolder.uri.fsPath);
      if (project) {
        void this.panel.webview.postMessage({ type: 'projectOpened', payload: project });
        this.chatHandler.setContext(project.id, this.agentHandler.getCurrentAgent(), project.path);
      } else {
        try {
          const newProject = await this.projectManager.createProject(
            workspaceFolder.name, workspaceFolder.uri.fsPath,
          );
          void this.panel.webview.postMessage({ type: 'projectCreated', payload: newProject });
          void this.panel.webview.postMessage({ type: 'projectOpened', payload: newProject });
          this.chatHandler.setContext(newProject.id, this.agentHandler.getCurrentAgent(), newProject.path);
          await this.projectHandler.getProjects();
        } catch { /* שקט */ }
      }
    }

    this.agentHandler.sendAgentList();
    this.agentHandler.sendWorkflowList();

    this.chatHandler.loadLastConversation();
  }

  // הרצת פקודת terminal — using spawn to prevent injection
  private async handleTerminalCommand(command: string): Promise<void> {
    const { spawn } = await import('child_process');
    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    const parts = command.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
    if (parts.length === 0) {
      void this.panel.webview.postMessage({ type: 'terminalOutput', payload: { output: 'Error: Empty command', exitCode: 1 } });
      return;
    }
    const executable = parts[0]!.replace(/^["']|["']$/g, '');
    const cmdArgs = parts.slice(1).map(a => a.replace(/^["']|["']$/g, ''));

    const proc = spawn(executable, cmdArgs, { cwd, timeout: 30000, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';
    proc.stdout?.on('data', (data: Buffer) => { stdout += data.toString(); });
    proc.stderr?.on('data', (data: Buffer) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      void this.panel.webview.postMessage({
        type: 'terminalOutput',
        payload: { output: stdout || stderr || '(no output)', exitCode: code ?? 0 },
      });
    });

    proc.on('error', (err) => {
      void this.panel.webview.postMessage({
        type: 'terminalOutput',
        payload: { output: `Error: ${err.message}`, exitCode: 1 },
      });
    });
  }

  // -------------------------------------------------
  // handleSearchMessages — חיפוש בהודעות
  // -------------------------------------------------
  private handleSearchMessages(query: string, scope?: 'current' | 'all'): void {
    if (!query.trim()) {
      void this.panel.webview.postMessage({
        type: 'searchResults',
        payload: { matches: [], total: 0, query },
      });
      return;
    }

    const projectId = scope === 'all'
      ? undefined
      : this.chatHandler.getCurrentProjectId() ?? undefined;

    const matches = this.conversationStore.search(query, projectId);

    void this.panel.webview.postMessage({
      type: 'searchResults',
      payload: {
        matches: matches.slice(0, 100),
        total: matches.length,
        query,
      },
    });
  }

  // -------------------------------------------------
  // handleExportChat — ייצוא שיחה
  // -------------------------------------------------
  private async handleExportChat(format: 'markdown' | 'html' | 'clipboard' | 'json'): Promise<void> {
    const activeId = this.conversationStore.getActiveId();
    if (!activeId) {
      void this.panel.webview.postMessage({
        type: 'error',
        payload: { message: 'אין שיחה פעילה לייצוא' },
      });
      return;
    }

    const conversation = this.conversationStore.get(activeId);
    if (!conversation || conversation.messages.length === 0) {
      void this.panel.webview.postMessage({
        type: 'error',
        payload: { message: 'השיחה ריקה — אין מה לייצא' },
      });
      return;
    }

    const project = this.projectManager.getProjects().find(
      (p) => p.id === conversation.projectId,
    );

    try {
      await this.exportService.export(conversation, format, project?.name);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'שגיאה בייצוא';
      void this.panel.webview.postMessage({
        type: 'error',
        payload: { message: errMsg },
      });
    }
  }

  // -------------------------------------------------
  // handleGetFileTree — סריקת עץ קבצים של פרויקט
  // -------------------------------------------------
  private async handleGetFileTree(projectPath: string): Promise<void> {
    try {
      const tree = await this.fileTreeService.getFileTree(projectPath);
      void this.panel.webview.postMessage({ type: 'fileTree', payload: tree });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Failed to scan file tree';
      void this.panel.webview.postMessage({ type: 'error', payload: { message: errMsg } });
    }
  }

  // -------------------------------------------------
  // handleOpenFile — פתיחת קובץ בעורך VS Code
  // -------------------------------------------------
  private async handleOpenFile(filePath: string): Promise<void> {
    try {
      const uri = vscode.Uri.file(filePath);
      await vscode.commands.executeCommand('vscode.open', uri);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Failed to open file';
      void this.panel.webview.postMessage({ type: 'error', payload: { message: errMsg } });
    }
  }

  // -------------------------------------------------
  // getWebviewContent — אותו HTML כמו ב-Sidebar
  // -------------------------------------------------
  private getWebviewContent(): string {
    const webview = this.panel.webview;

    // נתיב לקבצי Webview
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'index.js'),
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'assets', 'index.css'),
    );

    // Nonce לאבטחת CSP
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="
    default-src 'none';
    style-src ${webview.cspSource} 'unsafe-inline';
    script-src 'nonce-${nonce}' ${webview.cspSource};
    img-src ${webview.cspSource} data: https:;
    font-src ${webview.cspSource} https://fonts.gstatic.com;
    connect-src https://api.anthropic.com https://fonts.googleapis.com;
  ">
  <link rel="stylesheet" href="${styleUri}">
  <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <title>TS AiTool — Full Screen</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

// יצירת Nonce אקראי
function getNonce(): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const crypto = require('crypto') as typeof import('crypto');
  return crypto.randomBytes(24).toString('base64');
}
