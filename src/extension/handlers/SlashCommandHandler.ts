// ===================================================
// SlashCommandHandler — טיפול ב-Slash Commands
// ===================================================
// מנתח ומבצע פקודות /command שהמשתמש מקליד בצ'אט
// ===================================================

import type { ExtensionToWebviewMessage } from '../../shared/messages';
import { ChatHandler } from './ChatHandler';
import { GitHandler } from './GitHandler';

/** רשימת כל הפקודות הזמינות */
const COMMANDS: Record<string, { description: string; usage: string }> = {
  review: { description: 'סקירת קוד', usage: '/review [file]' },
  fix: { description: 'תיקון באגים', usage: '/fix [description]' },
  test: { description: 'כתיבת טסטים', usage: '/test [file]' },
  doc: { description: 'תיעוד קוד', usage: '/doc [file]' },
  security: { description: 'סריקת אבטחה', usage: '/security' },
  run: { description: 'הרצת פרויקט', usage: '/run' },
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

export class SlashCommandHandler {
  constructor(
    private readonly chatHandler: ChatHandler,
    private readonly gitHandler: GitHandler,
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
        id: Date.now().toString(),
        role: 'system',
        content: helpText,
        timestamp: new Date().toISOString(),
      },
    });
  }
}
