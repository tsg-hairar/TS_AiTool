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
import { createLogger } from './utils/logger';

const log = createLogger('SidebarProvider');
import { ClaudeService } from './services/ClaudeService';
import { ExportService } from './services/ExportService';
import { FileTreeService } from './services/FileTreeService';
import { BUILT_IN_AGENTS, DEFAULT_MODEL_ID } from '../shared/constants';
import { generateId } from '../shared/utils/generateId';

export class SidebarProvider implements vscode.WebviewViewProvider {
  // ה-Webview View — מייצג את הפאנל ב-VS Code
  private _view?: vscode.WebviewView;

  // שירות Claude משותף — instance אחד לכל ה-Handlers
  private claudeService: ClaudeService;

  // Handlers — כל אחד אחראי על תחום
  private chatHandler: ChatHandler;
  private projectHandler: ProjectHandler;
  private agentHandler: AgentHandler;
  private gitHandler: GitHandler;
  private settingsHandler: SettingsHandler;
  private slashCommandHandler: SlashCommandHandler;
  private exportService: ExportService;
  private fileTreeService: FileTreeService;

  // --- Callback לעדכון טוקנים ב-Status Bar ---
  public onTokenUsageUpdate?: (tokens: number) => void;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly projectManager: ProjectManager,
    private readonly conversationStore: ConversationStore,
    private readonly settingsService: SettingsService,
    private readonly gitService: GitService,
    private readonly notificationService: NotificationService,
  ) {
    // --- יצירת ClaudeService משותף ---
    // instance אחד שמשרת את כל ה-Handlers (ChatHandler, AgentHandler, SlashCommandHandler)
    // חוסך משאבים ומאפשר שיתוף מצב (mode, CWD, API client)
    this.claudeService = new ClaudeService();
    void settingsService.getApiKey().then((apiKey) =>
      this.claudeService.initialize(apiKey || undefined),
    ).catch(err => console.error('Failed to initialize Claude service:', err));

    // הגדרת CWD מה-workspace הפתוח
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (workspaceFolder) {
      this.claudeService.setWorkingDirectory(workspaceFolder);
    }

    // אתחול כל ה-Handlers עם הפונקציה לשליחת הודעות ל-Webview
    const postMessage = (msg: ExtensionToWebviewMessage) => this.postMessage(msg);

    this.chatHandler = new ChatHandler(
      context, settingsService, conversationStore, postMessage, this.claudeService,
    );
    this.projectHandler = new ProjectHandler(
      projectManager, postMessage,
    );
    this.agentHandler = new AgentHandler(
      context, settingsService, conversationStore, postMessage, this.claudeService,
    );
    this.gitHandler = new GitHandler(
      gitService, postMessage,
    );
    this.settingsHandler = new SettingsHandler(
      settingsService, postMessage,
    );
    this.slashCommandHandler = new SlashCommandHandler(
      this.chatHandler, this.gitHandler, settingsService,
      this.claudeService, postMessage,
    );
    this.exportService = new ExportService();
    this.fileTreeService = new FileTreeService();
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
        // --- חובה! chunks נוצרים ע"י Vite code splitting ---
        // בלי זה ה-dynamic imports נחסמים וה-UI לא נטען
        vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'chunks'),
        vscode.Uri.joinPath(this.context.extensionUri, 'media'),
      ],
    };

    // הגדרת ה-HTML של ה-Webview
    webviewView.webview.html = this.getWebviewContent(webviewView.webview);

    // --- האזנה להודעות מה-Webview ---
    webviewView.webview.onDidReceiveMessage(
      (message: WebviewToExtensionMessage) => {
        void this.handleWebviewMessage(message);
      },
      undefined,
      this.context.subscriptions,
    );

    // כשה-Webview מתגלה — שולחים מידע התחלתי
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        void this.sendInitialData();
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
          // פתיחת פרויקט + עדכון ה-ChatHandler עם הפרויקט הנוכחי
          await this.projectHandler.openProject(message.payload.projectId);
          // מוצאים את הנתיב של הפרויקט כדי לעדכן את ה-CWD
          const openedProject = this.projectManager.getProjects().find(
            (p) => p.id === message.payload.projectId,
          );
          this.chatHandler.setContext(
            message.payload.projectId,
            this.agentHandler.getCurrentAgent(),
            openedProject?.path, // העברת CWD!
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
          // עדכון הסוכן הנוכחי ב-ChatHandler
          this.chatHandler.setContext(
            this.chatHandler.getCurrentProjectId() ?? '',
            message.payload.agentId,
          );
          // טעינת היסטוריית שיחות של הסוכן החדש
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
        case 'getDiffContent':
          await this.gitHandler.getDiffContent(
            message.payload?.filePath,
            message.payload?.staged,
          );
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
          this.postMessage({
            type: 'unreadCount',
            payload: { count: this.notificationService.getUnreadCount() },
          });
          break;
        case 'clearNotifications':
          this.notificationService.clearAll();
          this.postMessage({ type: 'notificationsCleared' });
          this.postMessage({
            type: 'unreadCount',
            payload: { count: 0 },
          });
          break;
        case 'getNotifications':
          this.postMessage({
            type: 'notificationList',
            payload: this.notificationService.getAll(),
          });
          this.postMessage({
            type: 'unreadCount',
            payload: { count: this.notificationService.getUnreadCount() },
          });
          break;

        // --- Terminal ---
        case 'runTerminalCommand':
          await this.handleTerminalCommand(message.payload.command);
          break;

        // --- ייצוא שיחה ---
        case 'exportChat':
          await this.handleExportChat(message.payload.format);
          break;

        // --- Pinned Messages ---
        case 'getPinnedMessages': {
          const activeConvId = this.conversationStore.getActiveId();
          if (activeConvId) {
            const pinned = this.conversationStore.getPinnedMessages(activeConvId);
            this.postMessage({ type: 'pinnedMessages', payload: pinned });
          }
          break;
        }

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
          void this.handleSaveSessionState(message.payload.scrollPosition);
          break;
        case 'requestSessionRestore':
          this.handleSessionRestore();
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

        default:
          log.warn('Unknown message type:', (message as { type: string }).type);
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
  public handleCommand(command: string, arg?: string): void {
    switch (command) {
      case 'newChat':
        void this.chatHandler.newChat();
        break;
      case 'cancel':
        this.chatHandler.cancelRequest();
        break;
      case 'clearChat':
        void this.chatHandler.clearChat();
        break;
      case 'newProject':
        void this.projectHandler.importProject();
        break;
      case 'settingsChanged':
        void this.settingsHandler.getSettings();
        break;
      case 'workspaceChanged':
        void this.projectHandler.getProjects();
        break;

      // --- חיפוש בשיחות ---
      case 'searchChats':
        // שולחים הודעה ל-Webview לפתוח את ממשק החיפוש
        this.postMessage({
          type: 'notification',
          payload: {
            id: `search-focus-${generateId()}`,
            type: 'info',
            category: 'system',
            title: 'חיפוש',
            message: 'השתמש בשורת החיפוש כדי לחפש בשיחות',
            priority: 'low',
            timestamp: new Date().toISOString(),
          },
        });
        break;

      // --- ייצוא שיחה ---
      case 'exportChat':
        if (arg) {
          void this.handleExportChat(arg as 'markdown' | 'html' | 'clipboard' | 'json');
        }
        break;

      // --- החלפת מודל ---
      case 'switchModel':
        if (arg) {
          void this.settingsHandler.switchModel(arg as import('../shared/types').ModelId);
        }
        break;

      // --- אבחון מערכת ---
      case 'runDoctor':
        void this.runDoctorDiagnostics();
        break;

      // --- בחירת סוכן (Quick Pick מ-VS Code) ---
      case 'selectAgent':
        void this.showAgentQuickPick();
        break;

      default:
        log.warn(`Unknown command: ${command}`);
    }
  }

  // -------------------------------------------------
  // sendCodeToChat — שליחת קוד מהעורך לצ'אט
  // -------------------------------------------------
  // נקרא מפקודות Context Menu של העורך וה-Explorer
  // -------------------------------------------------
  public async sendCodeToChat(code: string, prompt: string, languageId: string): Promise<void> {
    const codeBlock = `\`\`\`${languageId}\n${code}\n\`\`\``;
    const fullMessage = `${prompt}\n\n${codeBlock}`;
    await this.chatHandler.sendMessage(fullMessage);
  }

  // -------------------------------------------------
  // showAgentQuickPick — הצגת Quick Pick לבחירת סוכן
  // -------------------------------------------------
  private async showAgentQuickPick(): Promise<void> {
    const currentAgent = this.agentHandler.getCurrentAgent();
    const agentItems = Object.values(BUILT_IN_AGENTS).map((agent) => ({
      label: `${agent.icon} ${agent.name}`,
      description: agent.description,
      detail: agent.id === currentAgent ? '$(check) סוכן נוכחי' : undefined,
      value: agent.id,
    }));

    const selected = await vscode.window.showQuickPick(agentItems, {
      placeHolder: 'בחר סוכן AI',
    });

    if (selected) {
      await this.agentHandler.switchAgent(selected.value as import('../shared/types').AgentId);
      this.chatHandler.setContext(
        this.chatHandler.getCurrentProjectId() ?? '',
        selected.value,
      );
      this.chatHandler.loadLastConversation();
      void vscode.window.showInformationMessage(`סוכן שונה ל-${selected.label}`);
    }
  }

  // -------------------------------------------------
  // runDoctorDiagnostics — אבחון מערכת
  // -------------------------------------------------
  // בודק חיבור CLI, API, הגדרות, ומציג דוח
  // -------------------------------------------------
  private async runDoctorDiagnostics(): Promise<void> {
    const results: string[] = [];
    const config = vscode.workspace.getConfiguration('tsAiTool');
    const connectionMode = config.get<string>('connectionMode') || 'cli';
    const model = config.get<string>('model') || DEFAULT_MODEL_ID;
    const apiKey = await this.settingsService.getApiKey();

    results.push('=== אבחון מערכת TS AiTool ===');
    results.push('');

    // בדיקת מצב חיבור
    results.push(`מצב חיבור: ${connectionMode === 'cli' ? 'CLI (מנוי)' : 'API (תשלום לפי שימוש)'}`);
    results.push(`מודל: ${model}`);

    // בדיקת API Key (רק ב-API mode)
    if (connectionMode === 'api') {
      if (apiKey && apiKey.startsWith('sk-')) {
        results.push('מפתח API: מוגדר (תקין)');
      } else if (apiKey) {
        results.push('מפתח API: מוגדר (ייתכן שאינו תקין)');
      } else {
        results.push('מפתח API: לא מוגדר! יש להגדיר בהגדרות');
      }
    }

    // בדיקת CLI
    if (connectionMode === 'cli') {
      try {
        const { exec } = await import('child_process');
        await new Promise<void>((resolve) => {
          exec('claude --version', { timeout: 5000 }, (error, stdout) => {
            if (error) {
              results.push('Claude CLI: לא נמצא! יש להתקין');
            } else {
              results.push(`Claude CLI: ${stdout.trim()}`);
            }
            resolve();
          });
        });
      } catch {
        results.push('Claude CLI: שגיאה בבדיקה');
      }
    }

    // בדיקת Workspace
    const workspace = vscode.workspace.workspaceFolders?.[0];
    if (workspace) {
      results.push(`תיקיית עבודה: ${workspace.uri.fsPath}`);
    } else {
      results.push('תיקיית עבודה: לא פתוחה');
    }

    // בדיקת פרויקטים
    const projects = this.projectManager.getProjects();
    results.push(`פרויקטים: ${projects.length}`);

    // בדיקת שיחות שמורות
    const conversations = this.conversationStore.getAll();
    results.push(`שיחות שמורות: ${conversations.length}`);

    results.push('');
    results.push('=== סוף אבחון ===');

    // הצגת הדוח
    const report = results.join('\n');
    const action = await vscode.window.showInformationMessage(
      'אבחון מערכת הושלם',
      'הצג דוח מלא',
      'העתק ללוח',
    );

    if (action === 'הצג דוח מלא') {
      const doc = await vscode.workspace.openTextDocument({
        content: report,
        language: 'markdown',
      });
      await vscode.window.showTextDocument(doc);
    } else if (action === 'העתק ללוח') {
      await vscode.env.clipboard.writeText(report);
      void vscode.window.showInformationMessage('הדוח הועתק ללוח');
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
    void this._view?.webview.postMessage(message);
  }

  // -------------------------------------------------
  // sendInitialData — שליחת מידע ראשוני כשה-Webview נפתח
  // -------------------------------------------------
  private async sendInitialData(): Promise<void> {
    // שולחים סטטוס onboarding
    const onboardingCompleted = this.context.globalState.get<boolean>('tsAiTool.onboardingCompleted', false);
    this.postMessage({ type: 'onboardingStatus', payload: { completed: onboardingCompleted } });

    // שולחים הגדרות
    void this.settingsHandler.getSettings();

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
          // העברת CWD כדי ש-Claude CLI יעבוד מתיקיית הפרויקט!
          this.chatHandler.setContext(project.id, this.agentHandler.getCurrentAgent(), project.path);
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
          // העברת CWD כדי ש-Claude CLI יעבוד מתיקיית הפרויקט!
          this.chatHandler.setContext(project.id, this.agentHandler.getCurrentAgent(), project.path);
        }
      }
    }

    // שולחים רשימת סוכנים
    this.agentHandler.sendAgentList();

    // שולחים רשימת workflows
    this.agentHandler.sendWorkflowList();

    // --- טעינת היסטוריית שיחות ---
    // אם יש פרויקט פעיל, טוענים את השיחה האחרונה שלו
    // כדי שהמשתמש ימשיך מאיפה שהפסיק!
    this.chatHandler.loadLastConversation();

    // --- שחזור מושב אחרון (אם קיים) ---
    this.handleSessionRestore();
  }

  // -------------------------------------------------
  // handleSearchMessages — חיפוש בהודעות
  // -------------------------------------------------
  // מחפש בכל השיחות או בשיחה הנוכחית בלבד
  // מחזיר הודעות תואמות עם snippet
  // -------------------------------------------------
  private handleSearchMessages(query: string, scope?: 'current' | 'all'): void {
    if (!query.trim()) {
      this.postMessage({
        type: 'searchResults',
        payload: { matches: [], total: 0, query },
      });
      return;
    }

    const projectId = scope === 'all'
      ? undefined
      : this.chatHandler.getCurrentProjectId() ?? undefined;

    const matches = this.conversationStore.search(query, projectId);

    this.postMessage({
      type: 'searchResults',
      payload: {
        matches: matches.slice(0, 100), // מגבלה של 100 תוצאות
        total: matches.length,
        query,
      },
    });
  }

  // -------------------------------------------------
  // handleTerminalCommand — הרצת פקודה בטרמינל
  // -------------------------------------------------
  private async handleTerminalCommand(command: string): Promise<void> {
    const { spawn } = await import('child_process');
    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    // Parse command into executable + args to prevent injection
    const parts = command.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
    if (parts.length === 0) {
      this.postMessage({ type: 'terminalOutput', payload: { output: 'Error: Empty command', exitCode: 1 } });
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
      this.postMessage({
        type: 'terminalOutput',
        payload: {
          output: stdout || stderr || '(no output)',
          exitCode: code ?? 0,
        },
      });
    });

    proc.on('error', (err) => {
      this.postMessage({
        type: 'terminalOutput',
        payload: { output: `Error: ${err.message}`, exitCode: 1 },
      });
    });
  }

  // -------------------------------------------------
  // handleExportChat — ייצוא שיחה
  // -------------------------------------------------
  private async handleExportChat(format: 'markdown' | 'html' | 'clipboard' | 'json'): Promise<void> {
    const activeId = this.conversationStore.getActiveId();
    if (!activeId) {
      this.postMessage({
        type: 'error',
        payload: { message: 'אין שיחה פעילה לייצוא' },
      });
      return;
    }

    const conversation = this.conversationStore.get(activeId);
    if (!conversation || conversation.messages.length === 0) {
      this.postMessage({
        type: 'error',
        payload: { message: 'השיחה ריקה — אין מה לייצא' },
      });
      return;
    }

    // מציאת שם הפרויקט
    const project = this.projectManager.getProjects().find(
      (p) => p.id === conversation.projectId,
    );

    try {
      await this.exportService.export(conversation, format, project?.name);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'שגיאה בייצוא';
      this.postMessage({
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
      this.postMessage({ type: 'fileTree', payload: tree });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Failed to scan file tree';
      this.postMessage({ type: 'error', payload: { message: errMsg } });
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
      this.postMessage({ type: 'error', payload: { message: errMsg } });
    }
  }

  // -------------------------------------------------
  // handleSaveSessionState — שמירת מצב מושב מה-Webview
  // -------------------------------------------------
  private async handleSaveSessionState(scrollPosition: number): Promise<void> {
    const activeId = this.conversationStore.getActiveId();
    await this.conversationStore.saveSessionState({
      activeConversationId: activeId,
      activeProjectId: this.chatHandler.getCurrentProjectId(),
      activePanel: 'chat',
      activeAgentId: this.agentHandler.getCurrentAgent(),
      scrollPosition,
      savedAt: new Date().toISOString(),
      isDirty: false,
    });
  }

  // -------------------------------------------------
  // handleSessionRestore — שחזור מושב אחרון
  // -------------------------------------------------
  private handleSessionRestore(): void {
    const sessionState = this.conversationStore.loadSessionState();
    if (!sessionState) return;

    // שליחת מצב המושב ל-Webview
    this.postMessage({
      type: 'sessionRestored',
      payload: sessionState,
    });

    // הודעת טוסט על שחזור
    this.postMessage({
      type: 'notification',
      payload: {
        id: `session-restore-${generateId()}`,
        type: 'info',
        category: 'system',
        title: 'שחזור מושב',
        message: 'שיחה שוחזרה',
        priority: 'low',
        timestamp: new Date().toISOString(),
      },
    });
  }

  // -------------------------------------------------
  // saveOnWindowBlur — שמירה כשהחלון מאבד פוקוס
  // -------------------------------------------------
  // נקרא מ-extension.ts דרך onDidChangeWindowState
  // -------------------------------------------------
  public async saveOnWindowBlur(): Promise<void> {
    await this.chatHandler.autoSaveConversation();
  }

  // -------------------------------------------------
  // dispose — ניקוי משאבים בסגירה
  // -------------------------------------------------
  public dispose(): void {
    this.chatHandler.dispose();
    this.claudeService.dispose();
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
    script-src 'nonce-${nonce}' ${webview.cspSource};
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
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const crypto = require('crypto') as typeof import('crypto');
  return crypto.randomBytes(24).toString('base64');
}
