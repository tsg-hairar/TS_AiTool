// ===================================================
// ToolExecutor — מנוע הפעלת כלים משותף לכל האייג'נטים
// ===================================================
// שירות מרכזי להפעלת כלים עם:
// - ניהול הרשאות (safe vs dangerous tools)
// - היסטוריית הפעלות
// - אישור משתמש לכלים מסוכנים
// - אימות נתיבים (path validation) — מניעת path traversal
// - סינון פקודות (command sanitization) — חסימת פקודות מסוכנות
// ===================================================

import * as vscode from 'vscode';
import * as path from 'path';
import { validatePathSecurity } from '../../shared/utils/pathValidation';

/**
 * תוצאת הפעלת כלי
 */
export interface ToolExecutionResult {
  toolUseId: string;
  toolName: string;
  success: boolean;
  output: string;
  error?: string;
  durationMs: number;
}

/**
 * הגדרת הרשאה לכלי
 */
export interface ToolPermission {
  tool: string;
  autoApprove: boolean;
  requireConfirmation: boolean;
}

// ===================================================
// Command Security — רשימות שחורות/לבנות לפקודות
// ===================================================

/**
 * דפוסי פקודות מסוכנות — regex patterns שנחסמים תמיד.
 * כל pattern בודק את הפקודה המנורמלת (lowercase, trimmed).
 */
const BLOCKED_COMMAND_PATTERNS: { pattern: RegExp; reason: string }[] = [
  // --- מחיקה הרסנית ---
  { pattern: /\brm\s+(-[a-z]*r[a-z]*f|--recursive|--force)\b/i, reason: 'Recursive forced deletion (rm -rf) is blocked' },
  { pattern: /\brm\s+-[a-z]*f[a-z]*r\b/i, reason: 'Recursive forced deletion (rm -fr) is blocked' },
  { pattern: /\brm\s+.*\s+\/\s*$/i, reason: 'Deleting root filesystem is blocked' },
  { pattern: /\bdel\s+\/s\b/i, reason: 'Recursive delete (del /s) is blocked' },
  { pattern: /\brd\s+\/s\b/i, reason: 'Recursive directory removal (rd /s) is blocked' },
  { pattern: /\brmdir\s+\/s\b/i, reason: 'Recursive directory removal (rmdir /s) is blocked' },

  // --- פורמט דיסק ---
  { pattern: /\bformat\s+[a-z]:/i, reason: 'Disk formatting is blocked' },
  { pattern: /\bmkfs\b/i, reason: 'Filesystem creation (mkfs) is blocked' },

  // --- הרסה של מערכת ההפעלה ---
  { pattern: /\bdd\s+.*of=\/dev\//i, reason: 'Writing to raw devices (dd) is blocked' },
  { pattern: />\s*\/dev\/[sh]d[a-z]/i, reason: 'Writing to raw block devices is blocked' },

  // --- Forkbomb / denial of service ---
  { pattern: /:\(\)\s*\{\s*:\|:&\s*\}\s*;/i, reason: 'Fork bomb detected and blocked' },
  { pattern: /\bwhile\s+true.*do.*done/i, reason: 'Infinite loop pattern is blocked' },

  // --- שינוי הרשאות מסוכן ---
  { pattern: /\bchmod\s+(-[a-z]*R|--recursive)\s+777\b/i, reason: 'Recursive chmod 777 is blocked' },
  { pattern: /\bchown\s+(-[a-z]*R|--recursive)\s+root/i, reason: 'Recursive chown to root is blocked' },

  // --- הרצת סקריפטים מרחוק ללא בדיקה ---
  { pattern: /\bcurl\s+.*\|\s*(ba)?sh\b/i, reason: 'Piping remote content to shell is blocked' },
  { pattern: /\bwget\s+.*\|\s*(ba)?sh\b/i, reason: 'Piping remote content to shell is blocked' },

  // --- שינויי רגיסטרי מערכתיים (Windows) ---
  { pattern: /\breg\s+(delete|add)\s+.*HKLM/i, reason: 'Modifying HKLM registry is blocked' },

  // --- כיבוי / אתחול מחדש ---
  { pattern: /\bshutdown\b/i, reason: 'System shutdown is blocked' },
  { pattern: /\breboot\b/i, reason: 'System reboot is blocked' },
  { pattern: /\binit\s+[06]\b/i, reason: 'System init level change is blocked' },

  // --- עצירת שירותים קריטיים ---
  { pattern: /\bnet\s+stop\b/i, reason: 'Stopping Windows services is blocked' },
  { pattern: /\bsystemctl\s+(stop|disable)\b/i, reason: 'Stopping system services is blocked' },

  // --- ניקוי Event Logs / audit trails ---
  { pattern: /\bwevtutil\s+cl\b/i, reason: 'Clearing Windows event logs is blocked' },
];

/**
 * פקודות מותרות (allowlist) — אם מופעל, רק פקודות שמתחילות בביטויים האלה מותרות.
 * ברירת מחדל: כבוי (null) = כל פקודה שלא חסומה מותרת.
 * ניתן לקנפג דרך setCommandAllowlist.
 */
const DEFAULT_COMMAND_ALLOWLIST: string[] | null = null;

// ===================================================
// Path Security — delegated to shared pathValidation utility
// ===================================================
// Legacy wrapper: ToolExecutor now uses the shared validatePathSecurity()
// from src/shared/utils/pathValidation.ts. The local validatePath function
// is kept as a thin adapter for backward compatibility with the existing
// executeToolInternal API that passes a single workspaceRoot string.
// ===================================================

/**
 * Adapter: wraps the shared validatePathSecurity to accept a single
 * workspace root string (as used by ToolExecutor internally).
 */
function validatePath(inputPath: string, workspaceRoot: string): string {
  return validatePathSecurity(inputPath, workspaceRoot ? [workspaceRoot] : []);
}

/**
 * ToolExecutor -- Central engine for executing tools on behalf of AI agents.
 *
 * Provides:
 * - **Permission management**: Safe tools (read_file, list_files) are auto-approved;
 *   dangerous tools (write_file, execute_command, delete_file) require user confirmation.
 * - **Path validation**: All file operations are validated against the workspace root
 *   to prevent path traversal attacks.
 * - **Command sanitization**: Blocks dangerous shell commands (rm -rf, format, fork bombs, etc.)
 *   via a configurable blocklist pattern system.
 * - **Execution history**: Tracks all tool executions with timing metrics.
 * - **Audit logging**: Logs every tool execution to a VS Code OutputChannel for observability.
 */
// -------------------------------------------------
// Rate limiting constants
// -------------------------------------------------
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute window
const RATE_LIMIT_MAX_CALLS = 30;     // max 30 tool calls per minute

export class ToolExecutor {
  private permissions: Map<string, ToolPermission> = new Map();
  private executionHistory: ToolExecutionResult[] = [];
  private commandAllowlist: string[] | null = DEFAULT_COMMAND_ALLOWLIST;

  /** VS Code OutputChannel for audit logging of tool executions */
  private auditLog: vscode.OutputChannel;

  /** Timestamps of recent tool executions for rate limiting */
  private rateLimitTimestamps: number[] = [];

  constructor(private context: vscode.ExtensionContext) {
    this.auditLog = vscode.window.createOutputChannel('TS AiTool - Tool Audit');
    this.initDefaultPermissions();
  }

  /**
   * Check if tool execution is within rate limits.
   * Prunes old timestamps and returns false if limit exceeded.
   */
  private checkRateLimit(): boolean {
    const now = Date.now();
    this.rateLimitTimestamps = this.rateLimitTimestamps.filter(
      (ts) => now - ts < RATE_LIMIT_WINDOW_MS,
    );

    if (this.rateLimitTimestamps.length >= RATE_LIMIT_MAX_CALLS) {
      return false;
    }

    this.rateLimitTimestamps.push(now);
    return true;
  }

  /**
   * אתחול הרשאות ברירת מחדל
   * כלים בטוחים — אישור אוטומטי
   * כלים מסוכנים — דורשים אישור משתמש
   */
  private initDefaultPermissions(): void {
    // Safe tools - auto-approve
    const safeTools = ['read_file', 'list_files', 'search_files', 'get_diagnostics'];
    safeTools.forEach(tool => {
      this.permissions.set(tool, { tool, autoApprove: true, requireConfirmation: false });
    });

    // Dangerous tools - require confirmation
    const dangerousTools = ['write_file', 'execute_command', 'delete_file', 'modify_settings'];
    dangerousTools.forEach(tool => {
      this.permissions.set(tool, { tool, autoApprove: false, requireConfirmation: true });
    });
  }

  // -------------------------------------------------
  // Workspace root — שורש ה-workspace הפעיל
  // -------------------------------------------------
  private getWorkspaceRoot(): string {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      return '';
    }
    return folders[0].uri.fsPath;
  }

  // -------------------------------------------------
  // Command Security — בדיקת פקודות
  // -------------------------------------------------

  /**
   * בדיקה שפקודה אינה מסוכנת.
   * זורק שגיאה אם הפקודה חסומה.
   */
  private validateCommand(command: string): void {
    if (!command || typeof command !== 'string') {
      throw new Error('Command is empty or invalid');
    }

    const trimmed = command.trim();

    // בדיקה 1: Allowlist — אם מוגדר, רק פקודות מאושרות מותרות
    if (this.commandAllowlist !== null) {
      const firstToken = trimmed.split(/\s+/)[0].toLowerCase();
      const allowed = this.commandAllowlist.some(
        (cmd) => firstToken === cmd.toLowerCase(),
      );
      if (!allowed) {
        throw new Error(
          `Command "${firstToken}" is not in the allowed commands list. ` +
          `Allowed commands: ${this.commandAllowlist.join(', ')}. ` +
          'Configure the allowlist via ToolExecutor.setCommandAllowlist().',
        );
      }
    }

    // בדיקה 2: Blocklist — דפוסים מסוכנים תמיד חסומים
    for (const { pattern, reason } of BLOCKED_COMMAND_PATTERNS) {
      if (pattern.test(trimmed)) {
        throw new Error(
          `Command blocked for security: ${reason}.\n` +
          `Command: "${trimmed.substring(0, 80)}${trimmed.length > 80 ? '...' : ''}"\n` +
          'If you need to run this command, use the VS Code integrated terminal directly.',
        );
      }
    }
  }

  /**
   * הגדרת רשימת פקודות מותרות (allowlist).
   * @param commands רשימת שמות פקודות מותרות, או null כדי לכבות את ה-allowlist.
   *
   * דוגמה:
   *   setCommandAllowlist(['npm', 'npx', 'git', 'node', 'tsc', 'eslint'])
   *   setCommandAllowlist(null) // מכבה — כל פקודה שלא חסומה מותרת
   */
  setCommandAllowlist(commands: string[] | null): void {
    this.commandAllowlist = commands;
  }

  /**
   * קבלת רשימת דפוסי פקודות חסומות (לצורך UI / דיבאג)
   */
  getBlockedPatterns(): { pattern: string; reason: string }[] {
    return BLOCKED_COMMAND_PATTERNS.map(({ pattern, reason }) => ({
      pattern: pattern.source,
      reason,
    }));
  }

  /**
   * הפעלת כלי עם בדיקת הרשאות
   * @param toolName שם הכלי
   * @param toolInput פרמטרים לכלי
   * @param toolUseId מזהה ייחודי להפעלה
   * @param onApproval callback לאישור משתמש (לכלים מסוכנים)
   */
  async executeTool(
    toolName: string,
    toolInput: Record<string, unknown>,
    toolUseId: string,
    onApproval?: (toolName: string, input: Record<string, unknown>) => Promise<boolean>,
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    // Rate limit check
    if (!this.checkRateLimit()) {
      const result: ToolExecutionResult = {
        toolUseId,
        toolName,
        success: false,
        output: '',
        error: `Rate limit exceeded: maximum ${RATE_LIMIT_MAX_CALLS} tool calls per minute. Please wait before trying again.`,
        durationMs: Date.now() - startTime,
      };
      this.logAudit(toolName, toolUseId, toolInput, 'error', 0, 'Rate limit exceeded');
      this.executionHistory.push(result);
      return result;
    }

    try {
      // Check permissions
      const permission = this.permissions.get(toolName);
      if (permission?.requireConfirmation && onApproval) {
        const approved = await onApproval(toolName, toolInput);
        if (!approved) {
          this.logAudit(toolName, toolUseId, toolInput, 'denied');
          return {
            toolUseId,
            toolName,
            success: false,
            output: '',
            error: 'Tool execution denied by user',
            durationMs: Date.now() - startTime,
          };
        }
      }

      // Execute tool
      this.logAudit(toolName, toolUseId, toolInput, 'started');
      const output = await this.executeToolInternal(toolName, toolInput);

      const result: ToolExecutionResult = {
        toolUseId,
        toolName,
        success: true,
        output,
        durationMs: Date.now() - startTime,
      };

      this.logAudit(toolName, toolUseId, toolInput, 'success', result.durationMs);
      this.executionHistory.push(result);
      return result;
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : String(error);
      const inputSummary = this.summarizeInput(toolInput);
      const errorMessage = `Tool "${toolName}" failed (id: ${toolUseId}, input: ${inputSummary}): ${rawMessage}`;
      const result: ToolExecutionResult = {
        toolUseId,
        toolName,
        success: false,
        output: '',
        error: errorMessage,
        durationMs: Date.now() - startTime,
      };
      this.logAudit(toolName, toolUseId, toolInput, 'error', result.durationMs, rawMessage);
      this.executionHistory.push(result);
      return result;
    }
  }

  /**
   * הפעלת כלי פנימית — מיפוי שם כלי לפעולה בפועל
   */
  private async executeToolInternal(toolName: string, input: Record<string, unknown>): Promise<string> {
    const workspaceRoot = this.getWorkspaceRoot();

    switch (toolName) {
      case 'read_file': {
        const filePath = input.path as string;
        if (!filePath) throw new Error('read_file: Missing required "path" parameter');
        // --- אימות נתיב: חייב להיות בתוך ה-workspace ---
        const validatedPath = validatePath(filePath, workspaceRoot);
        const uri = vscode.Uri.file(validatedPath);
        const content = await vscode.workspace.fs.readFile(uri);
        return Buffer.from(content).toString('utf-8');
      }

      case 'write_file': {
        const filePath = input.path as string;
        const content = input.content as string;
        if (!filePath || content === undefined) throw new Error('write_file: Missing required "path" or "content" parameter');
        // --- אימות נתיב: חייב להיות בתוך ה-workspace ---
        const validatedPath = validatePath(filePath, workspaceRoot);
        const uri = vscode.Uri.file(validatedPath);
        await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf-8'));
        return `File written successfully: ${validatedPath}`;
      }

      case 'list_files': {
        const dirPath = input.path as string || workspaceRoot;
        if (!dirPath) throw new Error('list_files: No workspace folder is open and no "path" parameter provided');
        // --- אימות נתיב: חייב להיות בתוך ה-workspace ---
        const validatedPath = validatePath(dirPath, workspaceRoot);
        const uri = vscode.Uri.file(validatedPath);
        const entries = await vscode.workspace.fs.readDirectory(uri);
        return entries
          .map(([name, type]) => `${type === vscode.FileType.Directory ? '\u{1F4C1}' : '\u{1F4C4}'} ${name}`)
          .join('\n');
      }

      case 'search_files': {
        const query = input.query as string;
        const include = input.include as string || '**/*';
        if (!query) throw new Error('search_files: Missing required "query" parameter');
        // search_files משתמש ב-vscode.workspace.findFiles שכבר מוגבל ל-workspace
        const results: string[] = [];
        const files = await vscode.workspace.findFiles(include, '**/node_modules/**', 100);

        // Process files in parallel with concurrency limit of 10
        // to avoid blocking the Extension Host with sequential reads
        const CONCURRENCY = 10;
        for (let i = 0; i < files.length; i += CONCURRENCY) {
          const batch = files.slice(i, i + CONCURRENCY);
          const batchResults = await Promise.allSettled(
            batch.map(async (file) => {
              const content = await vscode.workspace.fs.readFile(file);
              const text = Buffer.from(content).toString('utf-8');
              if (text.includes(query)) {
                return vscode.workspace.asRelativePath(file);
              }
              return null;
            }),
          );
          for (const result of batchResults) {
            if (result.status === 'fulfilled' && result.value) {
              results.push(result.value);
            }
          }
        }
        return results.length > 0 ? results.join('\n') : 'No matches found';
      }

      case 'execute_command':
      case 'run_command': {
        const command = input.command as string;
        if (!command) throw new Error('execute_command: Missing required "command" parameter');
        // --- אימות פקודה: חסימת פקודות מסוכנות ---
        this.validateCommand(command);
        // Use VS Code terminal for safety
        const terminal = vscode.window.createTerminal('AI Tool');
        terminal.sendText(command);
        terminal.show();
        return `Command sent to terminal: ${command}`;
      }

      case 'delete_file': {
        const filePath = input.path as string;
        if (!filePath) throw new Error('delete_file: Missing required "path" parameter');
        // --- אימות נתיב: חייב להיות בתוך ה-workspace ---
        const validatedPath = validatePath(filePath, workspaceRoot);
        const uri = vscode.Uri.file(validatedPath);
        await vscode.workspace.fs.delete(uri, { recursive: false });
        return `File deleted successfully: ${validatedPath}`;
      }

      case 'get_diagnostics': {
        const filePath = input.path as string;
        let diagnostics: vscode.Diagnostic[];
        if (filePath) {
          // --- אימות נתיב: חייב להיות בתוך ה-workspace ---
          const validatedPath = validatePath(filePath, workspaceRoot);
          const uri = vscode.Uri.file(validatedPath);
          diagnostics = vscode.languages.getDiagnostics(uri);
        } else {
          diagnostics = vscode.languages.getDiagnostics()
            .flatMap(([, diags]) => diags);
        }
        if (diagnostics.length === 0) return 'No diagnostics found';
        return diagnostics
          .map(
            (d) =>
              `[${vscode.DiagnosticSeverity[d.severity]}] Line ${d.range.start.line + 1}: ${d.message}`,
          )
          .join('\n');
      }

      default:
        throw new Error(`Unknown tool: "${toolName}". Available tools: read_file, write_file, list_files, search_files, execute_command, delete_file, get_diagnostics`);
    }
  }

  /**
   * קבלת היסטוריית הפעלות
   */
  getHistory(): ToolExecutionResult[] {
    return [...this.executionHistory];
  }

  /**
   * ניקוי היסטוריית הפעלות
   */
  clearHistory(): void {
    this.executionHistory = [];
  }

  /**
   * הגדרת הרשאה לכלי ספציפי
   */
  setPermission(toolName: string, permission: ToolPermission): void {
    this.permissions.set(toolName, permission);
  }

  /**
   * Write an audit log entry to the OutputChannel.
   * Logs the tool name, execution ID, timestamp, status, duration, and any error.
   *
   * @param toolName - Name of the tool being executed
   * @param toolUseId - Unique identifier for this execution
   * @param input - The input parameters passed to the tool
   * @param status - Execution status: 'started', 'success', 'denied', or 'error'
   * @param durationMs - Execution duration in milliseconds (omitted for 'started')
   * @param errorMessage - Error message if status is 'error'
   */
  private logAudit(
    toolName: string,
    toolUseId: string,
    input: Record<string, unknown>,
    status: 'started' | 'success' | 'denied' | 'error',
    durationMs?: number,
    errorMessage?: string,
  ): void {
    const timestamp = new Date().toISOString();
    const inputSummary = this.summarizeInput(input);
    let line = `[${timestamp}] TOOL ${status.toUpperCase()} | ${toolName} | id=${toolUseId}`;
    if (inputSummary) {
      line += ` | input: ${inputSummary}`;
    }
    if (durationMs !== undefined) {
      line += ` | ${durationMs}ms`;
    }
    if (errorMessage) {
      line += ` | error: ${errorMessage}`;
    }
    this.auditLog.appendLine(line);
  }

  /**
   * Create a short summary of tool input for audit logging.
   * Avoids logging full file contents -- only logs keys and short values.
   */
  private summarizeInput(input: Record<string, unknown>): string {
    const parts: string[] = [];
    for (const [key, value] of Object.entries(input)) {
      if (typeof value === 'string') {
        // Truncate long values (e.g., file content)
        const short = value.length > 80 ? value.substring(0, 80) + '...' : value;
        parts.push(`${key}="${short}"`);
      } else if (value !== undefined && value !== null) {
        parts.push(`${key}=${JSON.stringify(value)}`);
      }
    }
    return parts.join(', ');
  }

  /**
   * Dispose of resources (OutputChannel).
   * Should be called when the extension deactivates.
   */
  dispose(): void {
    this.auditLog.dispose();
  }
}

// Re-export path validation for backward compatibility and unit tests
export { validatePath };
export { validatePathSecurity } from '../../shared/utils/pathValidation';
