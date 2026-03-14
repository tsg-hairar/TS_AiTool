// ===================================================
// Extension Entry Point — נקודת הכניסה הראשית
// ===================================================
// זהו הקובץ הראשון ש-VS Code מריץ כשהתוסף נטען
// הוא רושם את כל הפקודות, ה-Views, וה-Services
// ===================================================
//
// TODO: Before publishing to the VS Code Marketplace, update the
// "publisher" field in package.json to your actual Marketplace
// publisher ID (see https://code.visualstudio.com/api/working-with-extensions/publishing-extension).
// Current value "ts-aitool-dev" is a placeholder.
// ===================================================

import * as vscode from 'vscode';
import { createLogger } from './utils/logger';
import { SidebarProvider } from './SidebarProvider';
import { FullScreenPanel } from './FullScreenPanel';
import { ProjectManager } from './services/ProjectManager';
import { ConversationStore } from './services/ConversationStore';
import { SettingsService } from './services/SettingsService';
import { GitService } from './services/GitService';
import { NotificationService } from './services/NotificationService';
import { MODELS, DEFAULT_MODEL_ID } from '../shared/constants';

// -------------------------------------------------
// Status Bar Items — פריטי שורת מצב גלובליים
// -------------------------------------------------
let modelStatusBarItem: vscode.StatusBarItem;
let connectionStatusBarItem: vscode.StatusBarItem;
let tokenUsageStatusBarItem: vscode.StatusBarItem;

// מונה טוקנים לסשן הנוכחי
let sessionTokenCount = 0;

const log = createLogger('Extension');

// הפניה גלובלית ל-SidebarProvider — לשימוש ב-deactivate
let activeSidebarProvider: SidebarProvider | null = null;

/**
 * Extension activation entry point -- called once when VS Code loads the extension.
 *
 * Initializes all core services (Settings, ConversationStore, ProjectManager, Git,
 * Notifications), creates the SidebarProvider webview bridge, registers all commands
 * and keybindings, sets up status bar items, and wires event listeners for active
 * file changes, configuration updates, workspace changes, and window focus events.
 *
 * @param context - The VS Code extension context, used for subscriptions and storage
 */
export function activate(context: vscode.ExtensionContext): void {
  log.info('TS_AiTool is activating...');

  // --- אתחול שירותים ---
  // כל שירות אחראי על תחום ספציפי
  const settingsService = new SettingsService(context);
  const conversationStore = new ConversationStore(context);
  const projectManager = new ProjectManager(context, settingsService);
  const gitService = new GitService();
  const notificationService = new NotificationService(context);

  // Migrate any plaintext API key from old settings to SecretStorage
  void settingsService.migrateApiKeyFromSettings();

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

  // שמירת הפניה גלובלית לשימוש ב-deactivate
  activeSidebarProvider = sidebarProvider;

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

  // --- יצירת Status Bar Items ---
  createStatusBarItems(context, settingsService);

  // --- רישום פקודות ---
  // כל פקודה מחוברת לפונקציה ב-SidebarProvider
  const commands: Array<[string, (...args: unknown[]) => void | Promise<void>]> = [
    ['tsAiTool.togglePanel', () => {
      // פתיחה/סגירה של הפאנל
      void vscode.commands.executeCommand('workbench.view.extension.tsAiTool');
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
    ['tsAiTool.switchAgent', () => sidebarProvider.handleCommand('selectAgent')],
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

    // --- פקודות חדשות ---

    // חיפוש בשיחות — פותח את הסייד-בר ומפעיל חיפוש
    ['tsAiTool.searchChats', () => {
      void vscode.commands.executeCommand('workbench.view.extension.tsAiTool');
      sidebarProvider.handleCommand('searchChats');
    }],

    // ייצוא שיחה נוכחית — בוחר פורמט ומייצא
    ['tsAiTool.exportChat', async () => {
      const format = await vscode.window.showQuickPick(
        [
          { label: 'Markdown', description: 'קובץ .md', value: 'markdown' as const },
          { label: 'HTML', description: 'קובץ .html', value: 'html' as const },
          { label: 'JSON', description: 'קובץ .json', value: 'json' as const },
          { label: 'העתק ללוח', description: 'העתקה ללוח העריכה', value: 'clipboard' as const },
        ],
        { placeHolder: 'בחר פורמט ייצוא' },
      );
      if (format) {
        sidebarProvider.handleCommand('exportChat', format.value);
      }
    }],

    // החלפת מודל Claude — Quick Pick עם כל המודלים
    ['tsAiTool.switchModel', async () => {
      const currentModel = vscode.workspace.getConfiguration('tsAiTool').get<string>('model');
      const modelItems = Object.values(MODELS).map((m) => ({
        label: m.name,
        description: m.description,
        detail: m.id === currentModel ? '$(check) בשימוש כרגע' : undefined,
        value: m.id,
      }));
      const selected = await vscode.window.showQuickPick(modelItems, {
        placeHolder: 'בחר מודל Claude',
      });
      if (selected) {
        await vscode.workspace.getConfiguration('tsAiTool').update('model', selected.value, vscode.ConfigurationTarget.Global);
        sidebarProvider.handleCommand('switchModel', selected.value);
        updateModelStatusBar(selected.value);
        void vscode.window.showInformationMessage(`מודל שונה ל-${selected.label}`);
      }
    }],

    // אבחון מערכת — בודק CLI, API, חיבורים
    ['tsAiTool.runDoctor', async () => {
      sidebarProvider.handleCommand('runDoctor');
    }],

    // בחירת סוכן — Quick Pick עם כל הסוכנים
    ['tsAiTool.selectAgent', async () => {
      sidebarProvider.handleCommand('selectAgent');
    }],

    // מעבר למסך מלא — alias ל-fullScreen
    ['tsAiTool.toggleFullscreen', () => {
      FullScreenPanel.createOrShow(
        context, projectManager, conversationStore, settingsService, gitService, notificationService,
        vscode.ViewColumn.One,
      );
    }],

    // --- Editor Context Menu Commands ---

    // שאל את Claude על הקוד הנבחר
    ['tsAiTool.askAboutCode', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) { return; }
      const selection = editor.document.getText(editor.selection);
      if (!selection) {
        void vscode.window.showWarningMessage('אנא בחר קוד קודם');
        return;
      }
      const fileName = editor.document.fileName.split(/[\\/]/).pop() || '';
      const langId = editor.document.languageId;
      void vscode.commands.executeCommand('workbench.view.extension.tsAiTool');
      void sidebarProvider.sendCodeToChat(
        selection,
        `שאל על הקוד מהקובץ ${fileName}`,
        langId,
      );
    }],

    // בדוק אבטחה בקוד הנבחר
    ['tsAiTool.securityCheckCode', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) { return; }
      const selection = editor.document.getText(editor.selection);
      if (!selection) {
        void vscode.window.showWarningMessage('אנא בחר קוד קודם');
        return;
      }
      const fileName = editor.document.fileName.split(/[\\/]/).pop() || '';
      const langId = editor.document.languageId;
      void vscode.commands.executeCommand('workbench.view.extension.tsAiTool');
      void sidebarProvider.sendCodeToChat(
        selection,
        `בצע בדיקת אבטחה מקיפה על הקוד הבא מהקובץ ${fileName}. חפש פגיעויות OWASP, סודות חשופים, בעיות הזרקה, XSS, ובעיות אבטחה נוספות.`,
        langId,
      );
    }],

    // הסבר קוד נבחר
    ['tsAiTool.explainCode', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) { return; }
      const selection = editor.document.getText(editor.selection);
      if (!selection) {
        void vscode.window.showWarningMessage('אנא בחר קוד קודם');
        return;
      }
      const fileName = editor.document.fileName.split(/[\\/]/).pop() || '';
      const langId = editor.document.languageId;
      void vscode.commands.executeCommand('workbench.view.extension.tsAiTool');
      void sidebarProvider.sendCodeToChat(
        selection,
        `הסבר בפירוט את הקוד הבא מהקובץ ${fileName}. תאר מה כל חלק עושה, את הלוגיקה, ואת דפוסי העיצוב בשימוש.`,
        langId,
      );
    }],

    // שפר/רפקטר קוד נבחר
    ['tsAiTool.improveCode', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) { return; }
      const selection = editor.document.getText(editor.selection);
      if (!selection) {
        void vscode.window.showWarningMessage('אנא בחר קוד קודם');
        return;
      }
      const fileName = editor.document.fileName.split(/[\\/]/).pop() || '';
      const langId = editor.document.languageId;
      void vscode.commands.executeCommand('workbench.view.extension.tsAiTool');
      void sidebarProvider.sendCodeToChat(
        selection,
        `שפר ובצע refactor לקוד הבא מהקובץ ${fileName}. הצע שיפורים בנושאי קריאות, ביצועים, תחזוקה, וקוד נקי.`,
        langId,
      );
    }],

    // --- Explorer Context Menu Commands ---

    // נתח קובץ עם Claude
    ['tsAiTool.analyzeFile', async (uri: unknown) => {
      if (!uri || !(uri instanceof vscode.Uri)) { return; }
      const filePath = uri.fsPath;
      const fileName = filePath.split(/[\\/]/).pop() || '';
      // קוראים את תוכן הקובץ
      try {
        const fileContent = (await vscode.workspace.fs.readFile(uri)).toString();
        const langId = fileName.split('.').pop() || '';
        void vscode.commands.executeCommand('workbench.view.extension.tsAiTool');
        void sidebarProvider.sendCodeToChat(
          fileContent,
          `נתח את הקובץ ${fileName} באופן מקיף. תאר את המבנה, הפונקציות, הבעיות הפוטנציאליות, והצע שיפורים.`,
          langId,
        );
      } catch {
        void vscode.window.showErrorMessage(`לא ניתן לקרוא את הקובץ ${fileName}`);
      }
    }],

    // בדוק אבטחה בקובץ
    ['tsAiTool.securityScanFile', async (uri: unknown) => {
      if (!uri || !(uri instanceof vscode.Uri)) { return; }
      const filePath = uri.fsPath;
      const fileName = filePath.split(/[\\/]/).pop() || '';
      try {
        const fileContent = (await vscode.workspace.fs.readFile(uri)).toString();
        const langId = fileName.split('.').pop() || '';
        void vscode.commands.executeCommand('workbench.view.extension.tsAiTool');
        void sidebarProvider.sendCodeToChat(
          fileContent,
          `בצע סריקת אבטחה מקיפה על הקובץ ${fileName}. בדוק OWASP Top 10, סודות חשופים, הרשאות, הזרקות, ובעיות אבטחה נוספות.`,
          langId,
        );
      } catch {
        void vscode.window.showErrorMessage(`לא ניתן לקרוא את הקובץ ${fileName}`);
      }
    }],
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
        // עדכון Status Bar כשהגדרות משתנות
        const newModel = vscode.workspace.getConfiguration('tsAiTool').get<string>('model') || DEFAULT_MODEL_ID;
        updateModelStatusBar(newModel);
        const newMode = vscode.workspace.getConfiguration('tsAiTool').get<string>('connectionMode') || 'cli';
        updateConnectionStatusBar(newMode);
      }
    }),
  );

  // כש-workspace משתנה — עדכון פרויקטים
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      sidebarProvider.handleCommand('workspaceChanged');
    }),
  );

  // --- שמירה אוטומטית כשהחלון מאבד פוקוס ---
  // onDidChangeWindowState נורה כשהחלון מקבל/מאבד פוקוס
  context.subscriptions.push(
    vscode.window.onDidChangeWindowState((windowState) => {
      if (!windowState.focused) {
        // החלון איבד פוקוס — שומרים מצב
        void sidebarProvider.saveOnWindowBlur();
      }
    }),
  );

  // --- חשיפת פונקציה לעדכון מונה טוקנים ---
  // SidebarProvider יקרא לפונקציה הזו כשיש עדכון טוקנים
  sidebarProvider.onTokenUsageUpdate = (tokens: number) => {
    sessionTokenCount += tokens;
    updateTokenUsageStatusBar(sessionTokenCount);
  };

  log.info('TS_AiTool activated successfully.');
}

// -------------------------------------------------
// createStatusBarItems — יצירת פריטי Status Bar
// -------------------------------------------------
function createStatusBarItems(
  context: vscode.ExtensionContext,
  settingsService: SettingsService,
): void {
  // --- פריט 1: מודל Claude נוכחי ---
  // לחיצה פותחת Quick Pick להחלפת מודל
  modelStatusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100,
  );
  modelStatusBarItem.command = 'tsAiTool.switchModel';
  modelStatusBarItem.tooltip = 'לחץ להחלפת מודל Claude';
  const currentModel = vscode.workspace.getConfiguration('tsAiTool').get<string>('model') || DEFAULT_MODEL_ID;
  updateModelStatusBar(currentModel);
  modelStatusBarItem.show();
  context.subscriptions.push(modelStatusBarItem);

  // --- פריט 2: סטטוס חיבור (CLI/API/מנותק) ---
  connectionStatusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    99,
  );
  connectionStatusBarItem.command = 'tsAiTool.runDoctor';
  connectionStatusBarItem.tooltip = 'מצב חיבור — לחץ להגדרות';
  const connectionMode = vscode.workspace.getConfiguration('tsAiTool').get<string>('connectionMode') || 'cli';
  updateConnectionStatusBar(connectionMode);
  connectionStatusBarItem.show();
  context.subscriptions.push(connectionStatusBarItem);

  // --- פריט 3: מונה טוקנים לסשן ---
  tokenUsageStatusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    98,
  );
  tokenUsageStatusBarItem.tooltip = 'שימוש בטוקנים בסשן הנוכחי';
  updateTokenUsageStatusBar(0);
  tokenUsageStatusBarItem.show();
  context.subscriptions.push(tokenUsageStatusBarItem);
}

// -------------------------------------------------
// updateModelStatusBar — עדכון תצוגת מודל
// -------------------------------------------------
function updateModelStatusBar(modelId: string): void {
  const model = MODELS[modelId];
  const displayName = model ? model.name : modelId;
  modelStatusBarItem.text = `$(hubot) ${displayName}`;
}

// -------------------------------------------------
// updateConnectionStatusBar — עדכון סטטוס חיבור
// -------------------------------------------------
function updateConnectionStatusBar(mode: string): void {
  if (mode === 'cli') {
    connectionStatusBarItem.text = '$(terminal) CLI';
    connectionStatusBarItem.backgroundColor = undefined;
  } else if (mode === 'api') {
    connectionStatusBarItem.text = '$(key) API';
    connectionStatusBarItem.backgroundColor = undefined;
  } else {
    connectionStatusBarItem.text = '$(debug-disconnect) מנותק';
    connectionStatusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
  }
}

// -------------------------------------------------
// updateTokenUsageStatusBar — עדכון מונה טוקנים
// -------------------------------------------------
function updateTokenUsageStatusBar(tokens: number): void {
  if (tokens === 0) {
    tokenUsageStatusBarItem.text = '$(dashboard) 0 טוקנים';
  } else if (tokens < 1000) {
    tokenUsageStatusBarItem.text = `$(dashboard) ${tokens} טוקנים`;
  } else {
    const k = (tokens / 1000).toFixed(1);
    tokenUsageStatusBarItem.text = `$(dashboard) ${k}K טוקנים`;
  }
}

/**
 * Extension deactivation hook -- called when VS Code shuts down or the extension is disabled.
 * Performs a final conversation save and disposes all resources (timers, providers).
 */
export function deactivate(): void {
  // שמירה אחרונה לפני סגירה + ניקוי טיימרים
  if (activeSidebarProvider) {
    void activeSidebarProvider.saveOnWindowBlur();
    activeSidebarProvider.dispose();
    activeSidebarProvider = null;
  }
  log.info('TS_AiTool deactivated.');
}
