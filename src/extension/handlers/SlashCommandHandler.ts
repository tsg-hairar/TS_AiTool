// ===================================================
// SlashCommandHandler — טיפול ב-Slash Commands
// ===================================================
// מנתח ומבצע פקודות /command שהמשתמש מקליד בצ'אט
// ===================================================

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import type { ExtensionToWebviewMessage } from '../../shared/messages';
import type { ModelId } from '../../shared/types';
import { MODELS, MODEL_PRICING, MODEL_ALIASES, DEFAULT_MODEL_ID } from '../../shared/constants';
import { ChatHandler } from './ChatHandler';
import { GitHandler } from './GitHandler';
import { SettingsService } from '../services/SettingsService';
import { ClaudeService } from '../services/ClaudeService';
import { generateId } from '../../shared/utils/generateId';

/** רשימת כל הפקודות הזמינות */
const COMMANDS: Record<string, { description: string; usage: string }> = {
  review: { description: 'סקירת קוד', usage: '/review [file]' },
  fix: { description: 'תיקון באגים', usage: '/fix [description]' },
  test: { description: 'כתיבת טסטים', usage: '/test [file]' },
  doc: { description: 'תיעוד קוד', usage: '/doc [file]' },
  security: { description: 'סריקת אבטחה', usage: '/security' },
  // /run is handled via the 'run' case below
  finish: { description: 'Pipeline מלא', usage: '/finish' },
  memory: { description: 'שמירת הקשר לזיכרון', usage: '/memory' },
  compact: { description: 'דחיסת שיחה ארוכה', usage: '/compact' },
  init: { description: 'יצירת CLAUDE.md', usage: '/init' },
  help: { description: 'רשימת פקודות', usage: '/help' },
  clear: { description: 'ניקוי צ\'אט', usage: '/clear' },
  cost: { description: 'עלות שימוש', usage: '/cost' },
  model: { description: 'החלפת מודל', usage: '/model [name]' },
  status: { description: 'סטטיסטיקות שיחה', usage: '/status' },
  doctor: { description: 'אבחון מערכת', usage: '/doctor' },
  update: { description: 'בדיקת עדכונים', usage: '/update' },
  permissions: { description: 'הגדרת הרשאות', usage: '/permissions' },
  config: { description: 'פתיחת הגדרות', usage: '/config' },
};

// MODEL_PRICING and MODEL_ALIASES are imported from shared/constants

export class SlashCommandHandler {
  constructor(
    private readonly chatHandler: ChatHandler,
    private readonly gitHandler: GitHandler,
    private readonly settingsService: SettingsService,
    private readonly claudeService: ClaudeService,
    private readonly postMessage: (msg: ExtensionToWebviewMessage) => void,
  ) {}

  // -------------------------------------------------
  // execute — ביצוע פקודה
  // -------------------------------------------------
  public async execute(command: string, args?: string): Promise<void> {
    // הסרת / מהתחלה
    const cmd = command.replace(/^\//, '').toLowerCase();

    switch (cmd) {
      case 'help':
        this.showHelp();
        break;

      case 'clear':
        await this.chatHandler.clearChat();
        break;

      case 'review':
        await this.chatHandler.sendMessage(
          `Please review the code${args ? ` in ${args}` : ' in the current file'}. Check for bugs, quality, and best practices.`,
        );
        break;

      case 'fix':
        await this.chatHandler.sendMessage(
          `Find and fix bugs${args ? `: ${args}` : ' in the current file'}.`,
        );
        break;

      case 'test':
        await this.chatHandler.sendMessage(
          `Write comprehensive tests${args ? ` for ${args}` : ' for the current file'}.`,
        );
        break;

      case 'doc':
        await this.chatHandler.sendMessage(
          `Add documentation and comments${args ? ` to ${args}` : ' to the current file'}.`,
        );
        break;

      case 'security':
        await this.chatHandler.sendMessage(
          'Perform a security audit on the current project. Check for OWASP Top 10 vulnerabilities.',
        );
        break;

      case 'init':
        await this.chatHandler.sendMessage(
          'Analyze this project and create a comprehensive CLAUDE.md file with project guidelines.',
        );
        break;

      case 'compact':
        await this.chatHandler.sendMessage(
          'Summarize our entire conversation into key points and decisions. Keep only the essential context.',
        );
        break;

      case 'memory':
        await this.chatHandler.sendMessage(
          'Save the most important information from this conversation to long-term memory.',
        );
        break;

      case 'finish':
        await this.chatHandler.sendMessage(
          'Run the full pipeline: 1) Code review 2) Write tests 3) Security scan 4) Build check 5) Documentation update.',
        );
        break;

      case 'run':
        await this.chatHandler.sendMessage(
          'Run the project: find the start/build scripts in package.json and execute them. Report any errors.',
        );
        break;

      // =================================================
      // פקודות חדשות
      // =================================================

      case 'cost':
        this.showCost();
        break;

      case 'model':
        await this.switchModel(args);
        break;

      case 'status':
        await this.showStatus();
        break;

      case 'doctor':
        await this.runDoctor();
        break;

      case 'update':
        await this.checkUpdate();
        break;

      case 'permissions':
        await this.handlePermissions(args);
        break;

      case 'config':
        await this.showConfig();
        break;

      default:
        this.postMessage({
          type: 'error',
          payload: { message: `Unknown command: /${cmd}. Type /help for available commands.` },
        });
    }
  }

  // -------------------------------------------------
  // showHelp — הצגת עזרה
  // -------------------------------------------------
  private showHelp(): void {
    const lines = Object.entries(COMMANDS).map(
      ([name, info]) => `**/${name}** — ${info.description}\n  Usage: \`${info.usage}\``,
    );

    const helpText = `# 📋 Available Commands\n\n${lines.join('\n\n')}`;

    this.postMessage({
      type: 'addMessage',
      payload: {
        id: generateId(),
        role: 'system',
        content: helpText,
        timestamp: new Date().toISOString(),
      },
    });
  }

  // -------------------------------------------------
  // showCost — הצגת עלות סשן
  // -------------------------------------------------
  private showCost(): void {
    try {
      const settings = this.settingsService.getSettings();
      const model = settings.model;
      const modelInfo = MODELS[model];
      const mode = this.claudeService.getMode();

      // בניית טבלת תמחור
      const pricingLines = Object.values(MODELS).map((m) => {
        const pricing = MODEL_PRICING[m.id];
        const isCurrent = m.id === model ? ' ⬅️' : '';
        return `| ${m.name} | $${pricing?.input ?? '?'}/1K | $${pricing?.output ?? '?'}/1K |${isCurrent}`;
      });

      let content = `# 💰 עלות שימוש — סיכום\n\n`;

      if (mode === 'cli') {
        content += `**מצב:** CLI (מנוי Max/Pro)\n`;
        content += `**עלות נוספת:** ללא — הכל כלול במנוי שלך! 🎉\n\n`;
      } else {
        content += `**מצב:** API (תשלום לפי טוקנים)\n`;
        content += `**מודל נוכחי:** ${modelInfo?.name ?? model}\n\n`;
      }

      content += `## תמחור לפי מודל\n\n`;
      content += `| מודל | קלט (1K טוקנים) | פלט (1K טוקנים) |\n`;
      content += `|------|-----------------|------------------|\n`;
      content += pricingLines.join('\n');
      content += `\n\n`;

      if (mode === 'cli') {
        content += `> 💡 **טיפ:** במצב CLI אין עלות נוספת. כל השימוש כלול במנוי Claude Max/Pro שלך.`;
      } else {
        content += `> 💡 **טיפ:** כדי לחסוך — עבור למצב CLI (הסר את ה-API Key מההגדרות).`;
      }

      this.sendSystemMessage(content);
    } catch (error) {
      this.sendErrorMessage(`שגיאה בחישוב עלות: ${error instanceof Error ? error.message : 'שגיאה לא ידועה'}`);
    }
  }

  // -------------------------------------------------
  // switchModel — החלפת מודל
  // -------------------------------------------------
  private async switchModel(args?: string): Promise<void> {
    try {
      // ללא ארגומנט — הצגת המודלים הזמינים
      if (!args || !args.trim()) {
        const settings = this.settingsService.getSettings();
        const currentModel = settings.model;

        const modelLines = Object.values(MODELS).map((m) => {
          const isCurrent = m.id === currentModel ? ' ✅' : '';
          return `- **${m.name}** — ${m.description}${isCurrent}`;
        });

        const content =
          `# 🔄 החלפת מודל\n\n` +
          `**מודל נוכחי:** ${MODELS[currentModel]?.name ?? currentModel}\n\n` +
          `## מודלים זמינים:\n${modelLines.join('\n')}\n\n` +
          `**שימוש:** \`/model sonnet\` | \`/model opus\` | \`/model haiku\``;

        this.sendSystemMessage(content);
        return;
      }

      // ניסיון להתאים את הארגומנט למודל
      const arg = args.trim().toLowerCase();
      const targetModelId = MODEL_ALIASES[arg];

      if (!targetModelId) {
        const validNames = Object.keys(MODEL_ALIASES).join(', ');
        this.sendErrorMessage(
          `מודל לא מוכר: "${args.trim()}"\n\nמודלים זמינים: ${validNames}`,
        );
        return;
      }

      const targetModel = MODELS[targetModelId];

      // עדכון ההגדרה
      await this.settingsService.updateSetting('model', targetModelId);

      // עדכון ה-Webview
      this.postMessage({ type: 'modelSwitched', payload: { model: targetModelId } });
      this.postMessage({ type: 'settingsLoaded', payload: this.settingsService.getSettings() });

      this.sendSystemMessage(
        `# ✅ המודל הוחלף\n\n` +
        `**מודל חדש:** ${targetModel.name}\n` +
        `**תיאור:** ${targetModel.description}\n` +
        `**מקסימום טוקנים:** ${targetModel.maxTokens.toLocaleString()}`,
      );
    } catch (error) {
      this.sendErrorMessage(`שגיאה בהחלפת מודל: ${error instanceof Error ? error.message : 'שגיאה לא ידועה'}`);
    }
  }

  // -------------------------------------------------
  // showStatus — הצגת סטטוס נוכחי
  // -------------------------------------------------
  private async showStatus(): Promise<void> {
    try {
      const settings = await this.settingsService.getSettingsAsync();
      const mode = this.claudeService.getMode();
      const isReady = this.claudeService.isReady();
      const currentModel = MODELS[settings.model];
      const projectId = this.chatHandler.getCurrentProjectId();
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? 'לא פתוח';

      let content = `# 📊 סטטוס מערכת\n\n`;

      // חיבור
      content += `## חיבור\n`;
      content += `- **מצב:** ${mode === 'cli' ? 'CLI (מנוי)' : 'API (טוקנים)'}\n`;
      content += `- **סטטוס:** ${isReady ? '🟢 מוכן' : '🔴 לא מוכן'}\n`;
      if (mode === 'api') {
        content += `- **API Key:** ${settings.hasApiKey ? '✅ מוגדר' : '❌ חסר'}\n`;
      }
      content += `\n`;

      // מודל
      content += `## מודל\n`;
      content += `- **שם:** ${currentModel?.name ?? settings.model}\n`;
      content += `- **תיאור:** ${currentModel?.description ?? 'לא ידוע'}\n`;
      content += `- **מקס טוקנים:** ${(currentModel?.maxTokens ?? settings.maxTokens).toLocaleString()}\n\n`;

      // פרויקט
      content += `## פרויקט\n`;
      content += `- **מזהה:** ${projectId ?? 'אין פרויקט פעיל'}\n`;
      content += `- **תיקייה:** ${workspaceFolder}\n\n`;

      // הגדרות
      content += `## הגדרות\n`;
      content += `- **שפה:** ${settings.language === 'he' ? 'עברית' : 'אנגלית'}\n`;
      content += `- **ערכת נושא:** ${settings.theme}\n`;
      content += `- **מצב למידה:** ${settings.learningMode ? '✅ פעיל' : '❌ כבוי'}\n`;
      content += `- **הרשאות:** ${settings.permissionPreset}\n`;
      content += `- **הקשר אוטומטי:** ${settings.autoContext ? '✅ פעיל' : '❌ כבוי'}\n`;

      this.sendSystemMessage(content);
    } catch (error) {
      this.sendErrorMessage(`שגיאה בהצגת סטטוס: ${error instanceof Error ? error.message : 'שגיאה לא ידועה'}`);
    }
  }

  // -------------------------------------------------
  // runDoctor — אבחון מערכת
  // -------------------------------------------------
  private async runDoctor(): Promise<void> {
    try {
      const checks: Array<{ name: string; status: 'pass' | 'fail' | 'warn'; detail: string }> = [];

      // --- בדיקה 1: Claude CLI ---
      const appData = process.env.APPDATA || '';
      const cliJsPath = path.join(appData, 'npm', 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js');
      const cliExists = fs.existsSync(cliJsPath);
      checks.push({
        name: 'Claude CLI',
        status: cliExists ? 'pass' : 'fail',
        detail: cliExists
          ? `נמצא: ${cliJsPath}`
          : 'לא נמצא. התקן: npm install -g @anthropic-ai/claude-code',
      });

      // --- בדיקה 2: Node.js ---
      const nodeVersion = process.version;
      const nodeMajor = parseInt(nodeVersion.slice(1), 10);
      checks.push({
        name: 'Node.js',
        status: nodeMajor >= 18 ? 'pass' : 'warn',
        detail: `גרסה: ${nodeVersion}${nodeMajor < 18 ? ' (מומלץ 18+)' : ''}`,
      });

      // --- בדיקה 3: API Key ---
      const settings = await this.settingsService.getSettingsAsync();
      const hasApiKey = settings.hasApiKey;
      const mode = this.claudeService.getMode();
      checks.push({
        name: 'API Key',
        status: mode === 'cli' ? 'pass' : hasApiKey ? 'pass' : 'fail',
        detail: mode === 'cli'
          ? 'לא נדרש (מצב CLI)'
          : hasApiKey ? 'מוגדר ותקין' : 'חסר — הוסף בהגדרות',
      });

      // --- בדיקה 4: Workspace ---
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      checks.push({
        name: 'Workspace',
        status: workspaceFolder ? 'pass' : 'warn',
        detail: workspaceFolder
          ? `פתוח: ${workspaceFolder}`
          : 'אין תיקייה פתוחה — פתח תיקיית פרויקט',
      });

      // --- בדיקה 5: CLAUDE.md ---
      let hasClaudeMd = false;
      if (workspaceFolder) {
        hasClaudeMd = fs.existsSync(path.join(workspaceFolder, 'CLAUDE.md'));
      }
      checks.push({
        name: 'CLAUDE.md',
        status: hasClaudeMd ? 'pass' : 'warn',
        detail: hasClaudeMd
          ? 'קיים — Claude יבין את הפרויקט טוב יותר'
          : 'חסר — הרץ /init כדי ליצור',
      });

      // --- בדיקה 6: package.json ---
      let hasPackageJson = false;
      if (workspaceFolder) {
        hasPackageJson = fs.existsSync(path.join(workspaceFolder, 'package.json'));
      }
      checks.push({
        name: 'package.json',
        status: hasPackageJson ? 'pass' : 'warn',
        detail: hasPackageJson
          ? 'קיים'
          : 'לא נמצא בתיקיית העבודה',
      });

      // --- בדיקה 7: חיבור Claude ---
      const isReady = this.claudeService.isReady();
      checks.push({
        name: 'חיבור Claude',
        status: isReady ? 'pass' : 'fail',
        detail: isReady
          ? `מוכן (${mode === 'cli' ? 'CLI' : 'API'})`
          : 'לא מוכן — בדוק התקנה/הגדרות',
      });

      // --- בניית הפלט ---
      const statusIcon = (s: 'pass' | 'fail' | 'warn') =>
        s === 'pass' ? '✅' : s === 'fail' ? '❌' : '⚠️';

      const passCount = checks.filter((c) => c.status === 'pass').length;
      const failCount = checks.filter((c) => c.status === 'fail').length;
      const warnCount = checks.filter((c) => c.status === 'warn').length;

      let content = `# 🏥 אבחון מערכת\n\n`;
      content += `**תוצאה:** ${passCount} תקין, ${warnCount} אזהרות, ${failCount} שגיאות\n\n`;

      for (const check of checks) {
        content += `${statusIcon(check.status)} **${check.name}** — ${check.detail}\n\n`;
      }

      if (failCount > 0) {
        content += `---\n\n⚠️ **יש ${failCount} בעיות שדורשות תיקון.** בדוק את הפרטים למעלה.`;
      } else if (warnCount > 0) {
        content += `---\n\n💡 **המערכת תקינה** עם ${warnCount} אזהרות שכדאי לטפל בהן.`;
      } else {
        content += `---\n\n🎉 **הכל תקין!** המערכת מוכנה לעבודה.`;
      }

      this.sendSystemMessage(content);
    } catch (error) {
      this.sendErrorMessage(`שגיאה באבחון: ${error instanceof Error ? error.message : 'שגיאה לא ידועה'}`);
    }
  }

  // -------------------------------------------------
  // checkUpdate — בדיקת עדכונים
  // -------------------------------------------------
  private async checkUpdate(): Promise<void> {
    try {
      // קבלת גרסה נוכחית מ-package.json של התוסף
      const extension = vscode.extensions.getExtension('ts-ai-tool.ts-ai-tool');
      const currentVersion = extension?.packageJSON?.version ?? '1.0.0';

      // --- ניסיון לבדוק גרסה אחרונה ב-marketplace ---
      // נשתמש ב-VS Code API לבדיקה (אין צורך ב-HTTP request ידני)
      let latestInfo = '';
      try {
        // VS Code לא חושף API ישיר ל-marketplace, נשתמש בפקודה
        const extensions = vscode.extensions.all.filter(
          (ext) => ext.id.toLowerCase().includes('ts-ai-tool'),
        );
        if (extensions.length > 0) {
          latestInfo = `\n- **מזהה תוסף:** ${extensions[0].id}`;
        }
      } catch {
        // שקט — לא קריטי
      }

      let content = `# 🔄 בדיקת עדכונים\n\n`;
      content += `**גרסה נוכחית:** v${currentVersion}\n`;
      content += `**פלטפורמה:** VS Code ${vscode.version}\n`;
      content += `**Node.js:** ${process.version}\n`;
      if (latestInfo) {
        content += latestInfo + '\n';
      }
      content += `\n`;

      content += `## בדיקת עדכונים\n\n`;
      content += `כדי לבדוק ולהתקין עדכונים:\n\n`;
      content += `1. **VS Code:** פתח Extensions (Ctrl+Shift+X) → חפש TS AiTool\n`;
      content += `2. **CLI:** הרץ \`code --install-extension ts-ai-tool.ts-ai-tool\`\n`;
      content += `3. **Claude CLI:** הרץ \`npm update -g @anthropic-ai/claude-code\`\n\n`;

      // בדיקה אם Claude CLI מעודכן
      const appData = process.env.APPDATA || '';
      const cliPackageJson = path.join(appData, 'npm', 'node_modules', '@anthropic-ai', 'claude-code', 'package.json');
      if (fs.existsSync(cliPackageJson)) {
        try {
          const cliPkg = JSON.parse(fs.readFileSync(cliPackageJson, 'utf-8'));
          content += `**Claude CLI:** v${cliPkg.version ?? 'לא ידוע'}\n`;
        } catch {
          content += `**Claude CLI:** מותקן (גרסה לא ידועה)\n`;
        }
      } else {
        content += `**Claude CLI:** לא מותקן\n`;
      }

      this.sendSystemMessage(content);
    } catch (error) {
      this.sendErrorMessage(`שגיאה בבדיקת עדכונים: ${error instanceof Error ? error.message : 'שגיאה לא ידועה'}`);
    }
  }

  // -------------------------------------------------
  // handlePermissions — הצגה/שינוי הרשאות
  // -------------------------------------------------
  private async handlePermissions(args?: string): Promise<void> {
    try {
      const settings = this.settingsService.getSettings();
      const currentPreset = settings.permissionPreset;

      // תיאור הפריסטים
      const presetDescriptions: Record<string, { name: string; description: string }> = {
        conservative: {
          name: 'שמרני (Conservative)',
          description: 'מבקש אישור לכל פעולה — קריאת קבצים, כתיבה, הרצת פקודות',
        },
        normal: {
          name: 'רגיל (Normal)',
          description: 'מאשר קריאה אוטומטית, מבקש אישור לכתיבה והרצת פקודות',
        },
        full: {
          name: 'מלא (Full)',
          description: 'מאשר הכל אוטומטית — מתאים למפתחים מנוסים',
        },
      };

      // ללא ארגומנט — הצגת הרשאות נוכחיות
      if (!args || !args.trim()) {
        const presetLines = Object.entries(presetDescriptions).map(([key, info]) => {
          const isCurrent = key === currentPreset ? ' ✅' : '';
          return `- **${info.name}** — ${info.description}${isCurrent}`;
        });

        const content =
          `# 🔐 הרשאות\n\n` +
          `**הגדרה נוכחית:** ${presetDescriptions[currentPreset]?.name ?? currentPreset}\n\n` +
          `## רמות הרשאה:\n${presetLines.join('\n')}\n\n` +
          `**שינוי:** \`/permissions conservative\` | \`/permissions normal\` | \`/permissions full\``;

        this.sendSystemMessage(content);
        return;
      }

      // שינוי הרשאות
      const arg = args.trim().toLowerCase();
      const validPresets = ['conservative', 'normal', 'full'] as const;

      if (!validPresets.includes(arg as typeof validPresets[number])) {
        this.sendErrorMessage(
          `הרשאה לא מוכרת: "${args.trim()}"\n\nאפשרויות: conservative, normal, full`,
        );
        return;
      }

      const newPreset = arg as 'conservative' | 'normal' | 'full';
      await this.settingsService.updateSetting('permissionPreset', newPreset);

      // עדכון ה-Webview
      this.postMessage({ type: 'settingsLoaded', payload: this.settingsService.getSettings() });

      const info = presetDescriptions[newPreset];
      this.sendSystemMessage(
        `# ✅ הרשאות עודכנו\n\n` +
        `**הגדרה חדשה:** ${info.name}\n` +
        `**תיאור:** ${info.description}`,
      );
    } catch (error) {
      this.sendErrorMessage(`שגיאה בעדכון הרשאות: ${error instanceof Error ? error.message : 'שגיאה לא ידועה'}`);
    }
  }

  // -------------------------------------------------
  // showConfig — הצגת תצורה נוכחית
  // -------------------------------------------------
  private async showConfig(): Promise<void> {
    try {
      const settings = await this.settingsService.getSettingsAsync();
      const mode = this.claudeService.getMode();
      const modelInfo = MODELS[settings.model];

      let content = `# ⚙️ תצורה נוכחית\n\n`;

      content += `## חיבור\n`;
      content += `| הגדרה | ערך |\n`;
      content += `|-------|------|\n`;
      content += `| מצב חיבור | ${mode === 'cli' ? 'CLI (מנוי)' : 'API (טוקנים)'} |\n`;
      content += `| API Key | ${settings.hasApiKey ? '•••• (מוגדר)' : 'לא מוגדר'} |\n\n`;

      content += `## מודל\n`;
      content += `| הגדרה | ערך |\n`;
      content += `|-------|------|\n`;
      content += `| מודל | ${modelInfo?.name ?? settings.model} |\n`;
      content += `| מקסימום טוקנים | ${settings.maxTokens.toLocaleString()} |\n\n`;

      content += `## ממשק\n`;
      content += `| הגדרה | ערך |\n`;
      content += `|-------|------|\n`;
      content += `| שפה | ${settings.language === 'he' ? 'עברית' : 'English'} |\n`;
      content += `| ערכת נושא | ${settings.theme} |\n`;
      content += `| גודל גופן | ${settings.fontSize}px |\n`;
      content += `| פעולות מהירות | ${settings.quickActionsVisible ? 'מוצגות' : 'מוסתרות'} |\n\n`;

      content += `## התנהגות\n`;
      content += `| הגדרה | ערך |\n`;
      content += `|-------|------|\n`;
      content += `| מצב למידה | ${settings.learningMode ? 'פעיל' : 'כבוי'} |\n`;
      content += `| הרשאות | ${settings.permissionPreset} |\n`;
      content += `| הקשר אוטומטי | ${settings.autoContext ? 'פעיל' : 'כבוי'} |\n`;
      content += `| שפת קול | ${settings.voiceLanguage} |\n\n`;

      content += `> 💡 **טיפ:** לשינוי הגדרות — לחץ על ⚙️ בפאנל, או השתמש ב-\`/model\` ו-\`/permissions\`.`;

      this.sendSystemMessage(content);
    } catch (error) {
      this.sendErrorMessage(`שגיאה בהצגת תצורה: ${error instanceof Error ? error.message : 'שגיאה לא ידועה'}`);
    }
  }

  // =================================================
  // עזר — שליחת הודעות מערכת
  // =================================================

  /** שולח הודעת מערכת לצ'אט */
  private sendSystemMessage(content: string): void {
    this.postMessage({
      type: 'addMessage',
      payload: {
        id: generateId(),
        role: 'system',
        content,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /** שולח הודעת שגיאה */
  private sendErrorMessage(message: string): void {
    this.postMessage({
      type: 'error',
      payload: { message },
    });
  }
}
