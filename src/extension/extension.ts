// ===================================================
// Extension Entry Point — נקודת הכניסה הראשית
// ===================================================
// זהו הקובץ הראשון ש-VS Code מריץ כשהתוסף נטען
// הוא רושם את כל הפקודות, ה-Views, וה-Services
// ===================================================

import * as vscode from 'vscode';
import { SidebarProvider } from './SidebarProvider';
import { FullScreenPanel } from './FullScreenPanel';
import { ProjectManager } from './services/ProjectManager';
import { ConversationStore } from './services/ConversationStore';
import { SettingsService } from './services/SettingsService';
import { GitService } from './services/GitService';
import { NotificationService } from './services/NotificationService';

// -------------------------------------------------
// activate — נקרא פעם אחת כשהתוסף נטען
// -------------------------------------------------
export function activate(context: vscode.ExtensionContext): void {
  console.log('🚀 TS_AiTool is activating...');

  // --- אתחול שירותים ---
  // כל שירות אחראי על תחום ספציפי
  const settingsService = new SettingsService();
  const conversationStore = new ConversationStore(context);
  const projectManager = new ProjectManager(context, settingsService);
  const gitService = new GitService();
  const notificationService = new NotificationService();

  // --- יצירת ה-Sidebar Provider ---
  // זהו הגשר בין VS Code לבין ה-Webview (React)
  const sidebarProvider = new SidebarProvider(
    context,
    projectManager,
    conversationStore,
    settingsService,
    gitService,
    notificationService,
  );

  // --- רישום ה-Webview View ---
  // מחבר את ה-Sidebar ל-Activity Bar של VS Code
  const sidebarDisposable = vscode.window.registerWebviewViewProvider(
    'tsAiTool.mainView',
    sidebarProvider,
    {
      // שמירת ה-Webview ברקע — לא נהרס כשעוברים טאב
      webviewOptions: { retainContextWhenHidden: true },
    },
  );
  context.subscriptions.push(sidebarDisposable);

  // --- רישום פקודות ---
  // כל פקודה מחוברת לפונקציה ב-SidebarProvider
  const commands: Array<[string, (...args: unknown[]) => void]> = [
    ['tsAiTool.togglePanel', () => {
      // פתיחה/סגירה של הפאנל
      vscode.commands.executeCommand('workbench.view.extension.tsAiTool');
    }],
    ['tsAiTool.newChat', () => sidebarProvider.handleCommand('newChat')],
    ['tsAiTool.cancel', () => sidebarProvider.handleCommand('cancel')],
    ['tsAiTool.clearChat', () => sidebarProvider.handleCommand('clearChat')],
    // --- מסך מלא — פותח טאב חדש בעורך ---
    ['tsAiTool.fullScreen', () => {
      FullScreenPanel.createOrShow(
        context,
        projectManager,
        conversationStore,
        settingsService,
        gitService,
        notificationService,
        vscode.ViewColumn.One,
      );
    }],
    ['tsAiTool.newProject', () => sidebarProvider.handleCommand('newProject')],
    ['tsAiTool.switchProject', () => sidebarProvider.handleCommand('switchProject')],
    ['tsAiTool.switchAgent', () => sidebarProvider.handleCommand('switchAgent')],
    ['tsAiTool.runWorkflow', () => sidebarProvider.handleCommand('runWorkflow')],
    ['tsAiTool.gitPush', () => sidebarProvider.handleCommand('gitPush')],
    ['tsAiTool.createPR', () => sidebarProvider.handleCommand('createPR')],
    ['tsAiTool.showIssues', () => sidebarProvider.handleCommand('showIssues')],
    ['tsAiTool.openPreview', () => sidebarProvider.handleCommand('openPreview')],
    ['tsAiTool.runProject', () => sidebarProvider.handleCommand('runProject')],
    ['tsAiTool.openSettings', () => sidebarProvider.handleCommand('openSettings')],
    ['tsAiTool.openSkillMarketplace', () => sidebarProvider.handleCommand('openSkillMarketplace')],
    ['tsAiTool.toggleQuickActions', () => sidebarProvider.handleCommand('toggleQuickActions')],
    ['tsAiTool.openTerminal', () => sidebarProvider.handleCommand('openTerminal')],
    ['tsAiTool.screenshotToCode', () => sidebarProvider.handleCommand('screenshotToCode')],
    // --- Split View — פותח שני פאנלים זה לצד זה ---
    ['tsAiTool.splitView', () => {
      FullScreenPanel.createOrShow(
        context, projectManager, conversationStore, settingsService, gitService, notificationService,
        vscode.ViewColumn.One,
      );
      FullScreenPanel.createOrShow(
        context, projectManager, conversationStore, settingsService, gitService, notificationService,
        vscode.ViewColumn.Two,
      );
    }],
    ['tsAiTool.voiceInput', () => sidebarProvider.handleCommand('voiceInput')],
    ['tsAiTool.scanDependencies', () => sidebarProvider.handleCommand('scanDependencies')],
    ['tsAiTool.projectTimeline', () => sidebarProvider.handleCommand('projectTimeline')],
  ];

  // רישום כל הפקודות ב-VS Code
  for (const [id, handler] of commands) {
    const disposable = vscode.commands.registerCommand(id, handler);
    context.subscriptions.push(disposable);
  }

  // --- האזנה לאירועי VS Code ---

  // כשקובץ נפתח — עדכון Active File ב-Webview
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        sidebarProvider.notifyActiveFileChanged(editor.document.uri.fsPath);
      }
    }),
  );

  // כשהגדרות משתנות — עדכון
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('tsAiTool')) {
        sidebarProvider.handleCommand('settingsChanged');
      }
    }),
  );

  // כש-workspace משתנה — עדכון פרויקטים
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      sidebarProvider.handleCommand('workspaceChanged');
    }),
  );

  console.log('✅ TS_AiTool activated successfully!');
}

// -------------------------------------------------
// deactivate — נקרא כשהתוסף נסגר
// -------------------------------------------------
export function deactivate(): void {
  console.log('👋 TS_AiTool deactivated');
}
