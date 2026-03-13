// ===================================================
// ExportService — ייצוא שיחות
// ===================================================
// שירות לייצוא שיחות בפורמטים שונים:
// Markdown, HTML, Clipboard (טקסט), JSON
// ===================================================

import * as vscode from 'vscode';
import type { Conversation, ChatMessage } from '../../shared/types';

/** פורמטים נתמכים לייצוא */
export type ExportFormat = 'markdown' | 'html' | 'clipboard' | 'json';

export class ExportService {
  // -------------------------------------------------
  // export — ייצוא שיחה בפורמט הנדרש
  // -------------------------------------------------
  public async export(
    conversation: Conversation,
    format: ExportFormat,
    projectName?: string,
  ): Promise<void> {
    switch (format) {
      case 'markdown':
        await this.exportToFile(
          conversation,
          this.toMarkdown(conversation, projectName),
          'markdown',
        );
        break;
      case 'html':
        await this.exportToFile(
          conversation,
          this.toHTML(conversation, projectName),
          'html',
        );
        break;
      case 'clipboard':
        await this.exportToClipboard(conversation, projectName);
        break;
      case 'json':
        await this.exportToFile(
          conversation,
          this.toJSON(conversation),
          'json',
        );
        break;
    }
  }

  // -------------------------------------------------
  // toMarkdown — ייצוא ל-Markdown
  // -------------------------------------------------
  public toMarkdown(conversation: Conversation, projectName?: string): string {
    const lines: string[] = [];

    // כותרת ומטא-דאטה
    lines.push(`# ${conversation.title}`);
    lines.push('');
    lines.push(`**תאריך:** ${this.formatDate(conversation.createdAt)}`);
    if (projectName) {
      lines.push(`**פרויקט:** ${projectName}`);
    }
    lines.push(`**סוכן:** ${conversation.agentId}`);
    if (conversation.totalTokens > 0) {
      lines.push(`**טוקנים:** ${conversation.totalTokens.toLocaleString()}`);
    }
    lines.push('');
    lines.push('---');
    lines.push('');

    // הודעות
    for (const msg of conversation.messages) {
      if (msg.role === 'system') continue;

      const roleLabel = msg.role === 'user' ? '👤 **משתמש**' : '🤖 **עוזר**';
      const time = this.formatTime(msg.timestamp);

      lines.push(`### ${roleLabel} — ${time}`);
      lines.push('');

      // תוכן ההודעה — שומרים על code blocks כמו שהם
      lines.push(msg.content);
      lines.push('');

      // כלים שהופעלו
      if (msg.toolUses && msg.toolUses.length > 0) {
        lines.push('> **כלים שהופעלו:**');
        for (const tool of msg.toolUses) {
          const status = tool.status === 'completed' ? '✅' : tool.status === 'failed' ? '❌' : '⏳';
          lines.push(`> - ${status} \`${tool.name}\``);
        }
        lines.push('');
      }

      lines.push('---');
      lines.push('');
    }

    // סיכום
    lines.push(`*יוצא מ-TS AiTool — ${this.formatDate(new Date().toISOString())}*`);

    return lines.join('\n');
  }

  // -------------------------------------------------
  // toHTML — ייצוא ל-HTML מעוצב
  // -------------------------------------------------
  public toHTML(conversation: Conversation, projectName?: string): string {
    const messagesHtml = conversation.messages
      .filter((m) => m.role !== 'system')
      .map((msg) => this.messageToHTML(msg))
      .join('\n');

    return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(conversation.title)}</title>
  <style>
    :root {
      --bg: #1e1e1e;
      --surface: #252526;
      --surface-hover: #2a2d2e;
      --text: #cccccc;
      --text-muted: #858585;
      --accent: #007acc;
      --user-bg: #264f78;
      --assistant-bg: #2d2d2d;
      --border: #404040;
      --code-bg: #1a1a1a;
      --success: #4ec9b0;
      --error: #f14c4c;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Segoe UI', 'Heebo', sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      direction: rtl;
      padding: 0;
    }

    .container {
      max-width: 900px;
      margin: 0 auto;
      padding: 2rem;
    }

    .header {
      border-bottom: 2px solid var(--accent);
      padding-bottom: 1.5rem;
      margin-bottom: 2rem;
    }

    .header h1 {
      font-size: 1.5rem;
      color: #fff;
      margin-bottom: 0.5rem;
    }

    .meta {
      display: flex;
      gap: 1.5rem;
      flex-wrap: wrap;
      color: var(--text-muted);
      font-size: 0.85rem;
    }

    .meta span {
      display: flex;
      align-items: center;
      gap: 0.3rem;
    }

    .message {
      margin-bottom: 1.5rem;
      border-radius: 8px;
      overflow: hidden;
    }

    .message-header {
      padding: 0.6rem 1rem;
      font-size: 0.85rem;
      font-weight: 600;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .message.user .message-header {
      background: var(--user-bg);
      color: #fff;
    }

    .message.assistant .message-header {
      background: var(--surface-hover);
      color: var(--success);
    }

    .message-body {
      padding: 1rem;
      background: var(--surface);
      white-space: pre-wrap;
      word-wrap: break-word;
    }

    .message-body p {
      margin-bottom: 0.5rem;
    }

    pre {
      background: var(--code-bg);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 1rem;
      overflow-x: auto;
      margin: 0.5rem 0;
      direction: ltr;
      text-align: left;
    }

    code {
      font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
      font-size: 0.9em;
    }

    :not(pre) > code {
      background: var(--code-bg);
      padding: 0.15rem 0.4rem;
      border-radius: 3px;
      border: 1px solid var(--border);
    }

    .tools {
      padding: 0.5rem 1rem;
      background: var(--surface-hover);
      border-top: 1px solid var(--border);
      font-size: 0.8rem;
      color: var(--text-muted);
    }

    .tool-item {
      display: inline-block;
      margin-left: 0.8rem;
    }

    .footer {
      margin-top: 3rem;
      padding-top: 1rem;
      border-top: 1px solid var(--border);
      text-align: center;
      color: var(--text-muted);
      font-size: 0.8rem;
    }

    @media (max-width: 600px) {
      .container { padding: 1rem; }
      .meta { flex-direction: column; gap: 0.5rem; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${this.escapeHtml(conversation.title)}</h1>
      <div class="meta">
        <span>📅 ${this.formatDate(conversation.createdAt)}</span>
        ${projectName ? `<span>📁 ${this.escapeHtml(projectName)}</span>` : ''}
        <span>🤖 ${this.escapeHtml(conversation.agentId)}</span>
        ${conversation.totalTokens > 0 ? `<span>🔢 ${conversation.totalTokens.toLocaleString()} טוקנים</span>` : ''}
        <span>💬 ${conversation.messages.filter((m) => m.role !== 'system').length} הודעות</span>
      </div>
    </div>

    ${messagesHtml}

    <div class="footer">
      יוצא מ-TS AiTool — ${this.formatDate(new Date().toISOString())}
    </div>
  </div>
</body>
</html>`;
  }

  // -------------------------------------------------
  // toJSON — ייצוא ל-JSON
  // -------------------------------------------------
  public toJSON(conversation: Conversation): string {
    const exportData = {
      exportedAt: new Date().toISOString(),
      exportedBy: 'TS AiTool',
      conversation: {
        id: conversation.id,
        title: conversation.title,
        agentId: conversation.agentId,
        projectId: conversation.projectId,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        totalTokens: conversation.totalTokens,
        estimatedCost: conversation.estimatedCost,
        messageCount: conversation.messages.length,
        messages: conversation.messages.map((msg) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
          agentId: msg.agentId,
          tokenCount: msg.tokenCount,
          toolUses: msg.toolUses?.map((t) => ({
            name: t.name,
            status: t.status,
            input: t.input,
            output: t.output,
          })),
        })),
      },
    };
    return JSON.stringify(exportData, null, 2);
  }

  // -------------------------------------------------
  // toPlainText — טקסט פשוט ל-clipboard
  // -------------------------------------------------
  public toPlainText(conversation: Conversation, projectName?: string): string {
    const lines: string[] = [];

    lines.push(`=== ${conversation.title} ===`);
    lines.push(`תאריך: ${this.formatDate(conversation.createdAt)}`);
    if (projectName) {
      lines.push(`פרויקט: ${projectName}`);
    }
    lines.push(`סוכן: ${conversation.agentId}`);
    lines.push('');
    lines.push('='.repeat(50));
    lines.push('');

    for (const msg of conversation.messages) {
      if (msg.role === 'system') continue;

      const role = msg.role === 'user' ? 'משתמש' : 'עוזר';
      const time = this.formatTime(msg.timestamp);

      lines.push(`[${role}] ${time}`);
      lines.push(msg.content);
      lines.push('');
      lines.push('-'.repeat(40));
      lines.push('');
    }

    lines.push(`יוצא מ-TS AiTool — ${this.formatDate(new Date().toISOString())}`);

    return lines.join('\n');
  }

  // -------------------------------------------------
  // exportToFile — שמירה לקובץ עם דיאלוג
  // -------------------------------------------------
  private async exportToFile(
    conversation: Conversation,
    content: string,
    format: 'markdown' | 'html' | 'json',
  ): Promise<void> {
    const ext = format === 'markdown' ? 'md' : format;
    const filterName = format === 'markdown' ? 'Markdown' : format === 'html' ? 'HTML' : 'JSON';

    // ניקוי שם הקובץ מתווים לא חוקיים
    const safeName = conversation.title
      .replace(/[\\/:*?"<>|]/g, '_')
      .replace(/\s+/g, '_')
      .slice(0, 60);

    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(`${safeName}.${ext}`),
      filters: {
        [filterName]: [ext],
      },
      title: `ייצוא שיחה — ${filterName}`,
    });

    if (!uri) return; // המשתמש ביטל

    await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(content));
    vscode.window.showInformationMessage(`✅ השיחה יוצאה בהצלחה: ${uri.fsPath}`);
  }

  // -------------------------------------------------
  // exportToClipboard — העתקה ללוח
  // -------------------------------------------------
  private async exportToClipboard(
    conversation: Conversation,
    projectName?: string,
  ): Promise<void> {
    const text = this.toPlainText(conversation, projectName);
    await vscode.env.clipboard.writeText(text);
    vscode.window.showInformationMessage('✅ השיחה הועתקה ללוח!');
  }

  // -------------------------------------------------
  // messageToHTML — המרת הודעה ל-HTML
  // -------------------------------------------------
  private messageToHTML(msg: ChatMessage): string {
    const roleClass = msg.role;
    const roleLabel = msg.role === 'user' ? '👤 משתמש' : '🤖 עוזר';
    const time = this.formatTime(msg.timestamp);

    // המרת תוכן — שומרים על code blocks
    const bodyHtml = this.contentToHTML(msg.content);

    // כלים
    let toolsHtml = '';
    if (msg.toolUses && msg.toolUses.length > 0) {
      const toolItems = msg.toolUses
        .map((t) => {
          const icon = t.status === 'completed' ? '✅' : t.status === 'failed' ? '❌' : '⏳';
          return `<span class="tool-item">${icon} ${this.escapeHtml(t.name)}</span>`;
        })
        .join('');
      toolsHtml = `<div class="tools">כלים: ${toolItems}</div>`;
    }

    return `
    <div class="message ${roleClass}">
      <div class="message-header">
        <span>${roleLabel}</span>
        <span>${time}</span>
      </div>
      <div class="message-body">${bodyHtml}</div>
      ${toolsHtml}
    </div>`;
  }

  // -------------------------------------------------
  // contentToHTML — המרת תוכן טקסט ל-HTML
  // -------------------------------------------------
  private contentToHTML(content: string): string {
    // פיצול לפי code blocks
    const parts = content.split(/(```[\s\S]*?```)/g);

    return parts
      .map((part) => {
        if (part.startsWith('```')) {
          // Code block
          const match = part.match(/```(\w*)\n?([\s\S]*?)```/);
          if (match) {
            const lang = match[1] || '';
            const code = this.escapeHtml(match[2].trimEnd());
            const langLabel = lang ? ` data-lang="${this.escapeHtml(lang)}"` : '';
            return `<pre${langLabel}><code>${code}</code></pre>`;
          }
          return `<pre><code>${this.escapeHtml(part)}</code></pre>`;
        }

        // טקסט רגיל — המרה בסיסית
        return this.escapeHtml(part)
          .replace(/`([^`]+)`/g, '<code>$1</code>')
          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.+?)\*/g, '<em>$1</em>')
          .replace(/\n/g, '<br>');
      })
      .join('');
  }

  // -------------------------------------------------
  // Helpers
  // -------------------------------------------------

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private formatDate(isoDate: string): string {
    try {
      return new Date(isoDate).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoDate;
    }
  }

  private formatTime(isoDate: string): string {
    try {
      return new Date(isoDate).toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  }
}
