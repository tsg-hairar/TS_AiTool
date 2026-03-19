// ===================================================
// ClaudeService — תקשורת עם Claude
// ===================================================
// תומך בשני מצבים:
// 1. CLI Mode — דרך המנוי שלך (claude CLI subprocess)
//    לא עולה כסף נוסף! משתמש במנוי Max/Pro שלך
// 2. API Mode — דרך Anthropic API (משלם לפי טוקנים)
//
// ברירת מחדל: CLI Mode (המנוי שלך)
// ===================================================

import * as vscode from 'vscode';
import { spawn, exec, type ChildProcess } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
import * as path from 'path';
import * as fs from 'fs';
import type { ModelId, ChatMessage, ToolUse } from '../../shared/types';
import { MODEL_PRICING, TIMEOUTS } from '../../shared/constants';
import { LRUCache, simpleHash } from '../../shared/utils/performance';
import { createLogger } from '../utils/logger';

// -------------------------------------------------
// מצבי חיבור
// -------------------------------------------------
export type ConnectionMode = 'cli' | 'api';

// -------------------------------------------------
// Error Classification — סיווג שגיאות
// -------------------------------------------------
// מסווג שגיאות לקטגוריות לצורך החלטה על retry
// NETWORK — timeout, connection refused → retry עד 3 פעמים
// AUTH — API key לא תקין, פג תוקף → לא retry, הודעה ברורה
// RATE_LIMIT — 429 → retry עם backoff לפי Retry-After
// VALIDATION — bad request → לא retry
// UNKNOWN — retry פעם אחת
// -------------------------------------------------
export type ErrorCategory = 'NETWORK' | 'AUTH' | 'RATE_LIMIT' | 'VALIDATION' | 'UNKNOWN';

export interface ClassifiedError {
  category: ErrorCategory;
  message: string;
  originalError: Error;
  retryable: boolean;
  maxRetries: number;
  retryAfterMs?: number;
}

/** סיווג שגיאה לקטגוריה מתאימה */
function classifyError(error: Error): ClassifiedError {
  const msg = error.message.toLowerCase();
  const errorName = error.name?.toLowerCase() ?? '';

  // --- NETWORK: timeout, connection refused, DNS ---
  if (
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('econnrefused') ||
    msg.includes('econnreset') ||
    msg.includes('enotfound') ||
    msg.includes('enetunreach') ||
    msg.includes('socket hang up') ||
    msg.includes('network') ||
    errorName === 'fetcherror'
  ) {
    return {
      category: 'NETWORK',
      message: `Network error: ${error.message}\n\nPlease check your internet connection.`,
      originalError: error,
      retryable: true,
      maxRetries: 3,
    };
  }

  // --- AUTH: invalid API key, expired, unauthorized ---
  if (
    msg.includes('api key') ||
    msg.includes('invalid key') ||
    msg.includes('unauthorized') ||
    msg.includes('authentication') ||
    msg.includes('401') ||
    msg.includes('403') ||
    msg.includes('forbidden') ||
    msg.includes('expired')
  ) {
    return {
      category: 'AUTH',
      message: `Authentication error: ${error.message}\n\nPlease check your API key or run: claude login`,
      originalError: error,
      retryable: false,
      maxRetries: 0,
    };
  }

  // --- RATE_LIMIT: 429, too many requests ---
  if (
    msg.includes('429') ||
    msg.includes('rate limit') ||
    msg.includes('too many requests') ||
    msg.includes('overloaded')
  ) {
    // ניסיון לחלץ Retry-After מהודעת השגיאה
    const retryAfterMatch = msg.match(/retry.after[:\s]*(\d+)/i);
    const retryAfterSec = retryAfterMatch ? parseInt(retryAfterMatch[1], 10) : 30;

    return {
      category: 'RATE_LIMIT',
      message: `Rate limited. Retrying in ${retryAfterSec}s...`,
      originalError: error,
      retryable: true,
      maxRetries: 3,
      retryAfterMs: retryAfterSec * 1000,
    };
  }

  // --- VALIDATION: bad request, invalid parameter ---
  if (
    msg.includes('400') ||
    msg.includes('bad request') ||
    msg.includes('invalid') ||
    msg.includes('validation') ||
    msg.includes('malformed')
  ) {
    return {
      category: 'VALIDATION',
      message: `Invalid request: ${error.message}`,
      originalError: error,
      retryable: false,
      maxRetries: 0,
    };
  }

  // --- UNKNOWN: retry פעם אחת ---
  return {
    category: 'UNKNOWN',
    message: error.message,
    originalError: error,
    retryable: true,
    maxRetries: 1,
  };
}

/** Token usage breakdown from API/CLI response */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

/** callbacks לקבלת streaming */
export interface StreamCallbacks {
  onToken: (token: string) => void;
  onComplete: (fullText: string, tokenCount: number, usage?: TokenUsage) => void;
  onToolUse: (toolUse: ToolUse) => void;
  onError: (error: Error) => void;
  /** עדכון שלב — מה Claude עושה עכשיו */
  onProgress?: (step: string) => void;
}

/**
 * ClaudeService -- Core service for communicating with Claude AI.
 *
 * Supports two connection modes:
 * - **CLI Mode**: Sends prompts through the Claude Code CLI subprocess,
 *   using the user's existing Claude Max/Pro subscription at no extra cost.
 * - **API Mode**: Sends prompts directly via the Anthropic SDK (pay-per-token).
 *
 * Features:
 * - Streaming responses with real-time token delivery
 * - LRU response cache (50 entries, 1-hour TTL) for repeated queries
 * - Error classification with automatic retry and exponential backoff
 * - Idle-based CLI timeout (5 minutes) to detect stuck processes
 * - Working directory (CWD) awareness for project context
 */
const log = createLogger('ClaudeService');

export class ClaudeService {
  private mode: ConnectionMode = 'cli';
  private currentCliProcess: ChildProcess | null = null;
  private cliTimeout: ReturnType<typeof setTimeout> | null = null;
  private apiClient: import('@anthropic-ai/sdk').default | null = null;
  private currentAbort: AbortController | null = null;

  // -------------------------------------------------
  // Response Cache — מטמון תשובות
  // -------------------------------------------------
  // LRU cache עם מקסימום 50 רשומות ו-TTL של שעה
  // מפתח = hash של (prompt + model + system message)
  // מדלג על בקשות עם tool-use
  // -------------------------------------------------
  private responseCache = new LRUCache<string, { text: string; tokenCount: number }>({
    maxSize: 50,
    ttlMs: TIMEOUTS.RESPONSE_CACHE_TTL_MS,
  });

  /** יצירת מפתח cache */
  private buildCacheKey(messages: ChatMessage[], systemPrompt: string, model: ModelId): string {
    // Use last 10 messages for cache key to include conversation context
    const recentMessages = messages.slice(-10);
    const messagesKey = recentMessages.map(m => `${m.role}:${m.content}`).join('|');
    return simpleHash(`${messagesKey}|${model}|${systemPrompt}`);
  }

  /** בדיקה אם הבקשה כוללת tool-use (לא לשמור ב-cache) */
  private hasToolUse(messages: ChatMessage[]): boolean {
    return messages.some(m => m.toolUses && m.toolUses.length > 0);
  }

  /** ניקוי מטמון תשובות */
  public clearCache(): void {
    this.responseCache.clear();
  }

  // -------------------------------------------------
  // תיקיית העבודה — CWD
  // -------------------------------------------------
  // חובה להעביר ל-Claude CLI את תיקיית הפרויקט הפתוח
  // כדי שיבין את ההקשר (קבצים, מבנה, CLAUDE.md וכו')
  // -------------------------------------------------
  private workingDirectory: string | null = null;

  public setWorkingDirectory(cwd: string | null): void {
    this.workingDirectory = cwd;
  }

  // -------------------------------------------------
  // נתיב ל-cli.js של Claude Code
  // -------------------------------------------------
  private getCliJsPath(): string {
    const appData = process.env.APPDATA || '';
    return path.join(appData, 'npm', 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js');
  }

  // -------------------------------------------------
  // מציאת node.exe אמין
  // -------------------------------------------------
  // בעיה: process.execPath בתוך VS Code מצביע על Electron,
  // ו-fnm (Fast Node Manager) יוצר נתיבים זמניים שנמחקים.
  // פתרון: מחפשים node.exe במיקומים קבועים.
  // -------------------------------------------------
  private async findNodeExe(): Promise<string> {
    // -------------------------------------------------
    // בעיה: process.execPath ב-VS Code = Electron, לא node
    // fnm (Fast Node Manager) יוצר paths זמניים שנמחקים!
    // פתרון: מחפשים node.exe במיקום קבוע
    // -------------------------------------------------

    // אפשרות 1: process.execPath אם זה באמת node ולא electron/fnm זמני
    const execName = path.basename(process.execPath).toLowerCase();
    if ((execName === 'node.exe' || execName === 'node')
      && !process.execPath.includes('fnm_multishells')
      && fs.existsSync(process.execPath)) {
      return process.execPath;
    }

    // אפשרות 2: מיקום קבוע — Program Files
    // חובה path.join — לא hardcoded backslashes (נבלעים ב-JS)
    const programFiles = path.join('C:', 'Program Files', 'nodejs', 'node.exe');
    if (fs.existsSync(programFiles)) {
      return programFiles;
    }

    // אפשרות 3: where node (Windows) / which node (Unix)
    try {
      const isWin = process.platform === 'win32';
      const cmd = isWin ? 'where node' : 'which node';
      const { stdout } = await execAsync(cmd, { timeout: TIMEOUTS.NODE_LOOKUP_MS });
      const lines = stdout.trim().split('\n').map((l: string) => l.trim());
      // מעדיפים נתיב קבוע (לא fnm זמני)
      const stable = lines.find((l: string) => !l.includes('fnm_multishells'));
      if (stable && fs.existsSync(stable)) return stable;
      if (lines[0] && fs.existsSync(lines[0])) return lines[0];
    } catch {
      // ממשיכים
    }

    // אפשרות 4: fnm — הנתיב הזמני אם קיים כרגע
    if (fs.existsSync(process.execPath)) {
      return process.execPath;
    }

    // fallback — shell ימצא node ב-PATH
    return 'node';
  }

  /**
   * Initialize the Claude service with the appropriate connection mode.
   * If a valid API key (starting with 'sk-') is provided, uses API mode.
   * Otherwise falls back to CLI mode.
   *
   * @param apiKey - Optional Anthropic API key. If provided and valid, enables API mode.
   */
  public async initialize(apiKey?: string): Promise<void> {
    if (apiKey && apiKey.startsWith('sk-')) {
      this.mode = 'api';
      try {
        const { default: Anthropic } = await import('@anthropic-ai/sdk');
        this.apiClient = new Anthropic({ apiKey });
      } catch {
        this.mode = 'cli';
      }
    } else {
      this.mode = 'cli';
    }
  }

  public isReady(): boolean {
    if (this.mode === 'api') return this.apiClient !== null;
    // CLI mode — בודקים שה-cli.js קיים
    return fs.existsSync(this.getCliJsPath());
  }

  public getMode(): ConnectionMode {
    return this.mode;
  }

  /**
   * Send a message to Claude and receive a streaming response.
   *
   * Checks the LRU cache first (for non-tool-use conversations).
   * Routes to either CLI or API mode based on the current configuration.
   * Wraps onComplete to cache successful responses.
   *
   * @param messages - Conversation history (user and assistant messages)
   * @param systemPrompt - System prompt for the AI agent
   * @param model - Claude model ID to use
   * @param maxTokens - Maximum tokens for the response (API mode only)
   * @param callbacks - Streaming callbacks for tokens, completion, errors, and progress
   */
  public async sendMessage(
    messages: ChatMessage[],
    systemPrompt: string,
    model: ModelId,
    maxTokens: number,
    callbacks: StreamCallbacks,
  ): Promise<void> {
    // --- בדיקת cache (רק אם אין tool-use) ---
    if (!this.hasToolUse(messages)) {
      const cacheKey = this.buildCacheKey(messages, systemPrompt, model);
      const cached = this.responseCache.get(cacheKey);
      if (cached) {
        // מחזירים תשובה מהמטמון — מיידית
        callbacks.onToken(cached.text);
        callbacks.onComplete(cached.text, cached.tokenCount);
        return;
      }

      // עוטפים את onComplete כדי לשמור תשובה במטמון
      const originalOnComplete = callbacks.onComplete;
      callbacks = {
        ...callbacks,
        onComplete: (fullText: string, tokenCount: number, usage?: TokenUsage) => {
          // שומרים רק תשובות עם תוכן
          if (fullText.length > 0) {
            this.responseCache.set(cacheKey, { text: fullText, tokenCount });
          }
          originalOnComplete(fullText, tokenCount, usage);
        },
      };
    }

    // --- תמונות: CLI לא תומך בתמונות, צריך API ---
    const hasImages = messages.some((m) => m.images && m.images.length > 0);

    if (this.mode === 'api') {
      return this.sendMessageViaApi(messages, systemPrompt, model, maxTokens, callbacks);
    }

    // אם יש תמונות ואנחנו במצב CLI — ננסה לעבור ל-API אוטומטית
    if (hasImages) {
      if (this.apiClient) {
        // יש API client מוגדר — נשתמש בו לשליחת הודעה עם תמונות
        callbacks.onProgress?.('📸 תמונות מזוהות — שולח דרך API...');
        return this.sendMessageViaApi(messages, systemPrompt, model, maxTokens, callbacks);
      }

      // אין API key — נודיע למשתמש
      callbacks.onError(
        new Error(
          '📸 העלאת תמונות דורשת API Key.\n\n' +
          'Claude CLI לא תומך בשליחת תמונות.\n' +
          'כדי להשתמש בתמונות:\n' +
          '1. לך ל-Settings (⚙️)\n' +
          '2. הוסף Anthropic API Key\n' +
          '3. נסה שוב\n\n' +
          'ההודעה הטקסטואלית תישלח ללא התמונות.',
        ),
      );
      // שולחים את ההודעה בלי תמונות דרך CLI
      const messagesWithoutImages = messages.map((m) => ({
        ...m,
        images: undefined,
      }));
      return this.sendMessageViaCli(messagesWithoutImages, systemPrompt, callbacks);
    }

    return this.sendMessageViaCli(messages, systemPrompt, callbacks);
  }

  // =================================================
  // CLI MODE — שליחה דרך Claude Code CLI
  // =================================================
  // מה שעובד (נבדק!):
  //   spawn(process.execPath, [cli.js, '-p', prompt,
  //     '--output-format', 'stream-json', '--verbose'])
  //
  // חובה:
  //   1. הרצה ישירה דרך node (לא shell: true / claude.cmd)
  //   2. stdin.end() — לסגור stdin מיד
  //   3. מחיקת CLAUDECODE + CLAUDE_CODE_ENTRYPOINT מ-env
  //
  // פורמט פלט (JSON שורה-שורה):
  //   {"type": "system", ...}      — אתחול
  //   {"type": "assistant", ...}    — תוכן (message.content[])
  //   {"type": "result", ...}       — סיום (result = טקסט סופי)
  // =================================================

  private async sendMessageViaCli(
    messages: ChatMessage[],
    systemPrompt: string,
    callbacks: StreamCallbacks,
  ): Promise<void> {
    // --- בניית ה-prompt ---
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUserMessage) {
      callbacks.onError(new Error('No user message found'));
      return;
    }

    // --- בניית הקשר שיחה עם חיסכון בטוקנים ---
    // אסטרטגיה: הודעות אחרונות בפירוט מלא,
    // הודעות ישנות יותר → רק סיכום קצר
    // זה חוסך טוקנים ושומר על הקשר רלוונטי!
    let conversationContext = '';
    if (messages.length > 1) {
      const previousMessages = messages.slice(0, -1); // הכל חוץ מהאחרונה

      if (previousMessages.length <= 6) {
        // מעט הודעות — שולחים הכל כמו שהוא
        for (const msg of previousMessages) {
          const role = msg.role === 'user' ? 'User' : 'Assistant';
          conversationContext += `${role}: ${msg.content}\n\n`;
        }
      } else {
        // הרבה הודעות — סיכום ישנות + 6 אחרונות מלאות
        const olderMessages = previousMessages.slice(0, -6);
        const recentMessages = previousMessages.slice(-6);

        // סיכום קצר של הודעות ישנות (80 תווים לכל אחת)
        conversationContext += '[Earlier context (summarized)]\n';
        for (const msg of olderMessages) {
          const role = msg.role === 'user' ? 'U' : 'A';
          const summary = msg.content.slice(0, 80).replace(/\n/g, ' ');
          conversationContext += `${role}: ${summary}${msg.content.length > 80 ? '...' : ''}\n`;
        }
        conversationContext += '\n[Recent messages]\n';

        // הודעות אחרונות — מלאות
        for (const msg of recentMessages) {
          const role = msg.role === 'user' ? 'User' : 'Assistant';
          conversationContext += `${role}: ${msg.content}\n\n`;
        }
      }
    }

    // בניית prompt — system prompt נשלח בנפרד דרך --system-prompt
    let userPrompt = '';
    if (conversationContext) {
      userPrompt += `[Conversation History]\n${conversationContext}\n`;
    }
    userPrompt += lastUserMessage.content;

    // --- בדיקה שה-CLI קיים ---
    const cliJs = this.getCliJsPath();
    if (!fs.existsSync(cliJs)) {
      callbacks.onError(
        new Error(
          'Claude Code CLI not found.\n\n' +
          'Install it: npm install -g @anthropic-ai/claude-code\n' +
          'Then authenticate: claude login\n\n' +
          'Or add an API key in Settings → apiKey',
        ),
      );
      return;
    }

    // --- ניקוי סביבה ---
    // חובה! אחרת Claude CLI חושב שהוא בתוך session קיים ונתקע
    const cleanEnv = { ...process.env };
    Object.keys(cleanEnv).forEach((k) => {
      if (k.toUpperCase().includes('CLAUDE') || k.toUpperCase().includes('ANTHROPIC')) {
        delete cleanEnv[k];
      }
    });

    // --- הרצת claude CLI ---
    // ישירות דרך node (לא shell:true!) כדי לעקוף בעיית claude.cmd
    // --- הרשאות CLI: מבוסס על הגדרת המשתמש ---
    // permissionPreset (מוגדר ב-Settings):
    //   "full"         → --dangerously-skip-permissions (אישור אוטומטי לכל הכלים)
    //   "normal"       → בלי הדגל — CLI ישתמש בהרשאות ברירת מחדל
    //   "conservative" → בלי הדגל — CLI ישתמש בהרשאות ברירת מחדל
    //
    // הערה: stdin נסגר (stdin.end()) כדי למנוע תקיעה.
    // במצב normal/conservative, ה-CLI עלול לחכות לאישור ולהיתקע.
    // כדי למנוע תקיעה בלי לדלג על הרשאות, מוסיפים timeout
    // וה-ToolExecutor אוכף הגבלות נוספות מצידו.
    const permissionPreset = vscode.workspace
      .getConfiguration('tsAiTool')
      .get<string>('permissionPreset', 'normal');

    const args = [
      cliJs,
      '-p', userPrompt,
      '--output-format', 'stream-json',
      '--verbose',
    ];

    if (permissionPreset === 'full') {
      // המשתמש בחר במפורש "Full (Auto-approve all)" — מדלג על הרשאות
      args.push('--dangerously-skip-permissions');
    }
    // במצב normal / conservative — לא מוסיפים את הדגל.
    // ה-CLI ישתמש בהרשאות ברירת מחדל שלו.
    // אם ה-CLI נתקע בגלל שמחכה לאישור (stdin סגור),
    // ה-idle timeout (300 שניות) יתפוס את זה ויציג הודעת שגיאה מתאימה.

    // הוספת system prompt אם יש
    if (systemPrompt) {
      args.push('--system-prompt', systemPrompt);
    }

    // --- CWD: העברת תיקיית הפרויקט ---
    // בלי זה Claude לא יודע על איזה פרויקט עובדים!
    const cwd = this.workingDirectory || undefined;

    // --- מציאת node.exe אמין ---
    // process.execPath ב-VS Code = Electron, לא node!
    const nodeExe = await this.findNodeExe();

    // --- דיאגנוסטיקה: שומרים לשימוש ב-error messages ---
    const debugInfo = `node: ${nodeExe} | cwd: ${cwd || 'none'} | prompt: ${userPrompt.length} chars`;
    callbacks.onProgress?.(`מפעיל CLI... (${path.basename(nodeExe)})`);

    try {
      this.currentCliProcess = spawn(nodeExe, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: cleanEnv,
        cwd, // תיקיית העבודה
        // windowsHide: true — חבוי (לא פותח חלון CMD)
        windowsHide: true,
      });
    } catch (error) {
      callbacks.onError(new Error(`Failed to start Claude CLI: ${error}\n\n[${debugInfo}]`));
      return;
    }

    const cliProcess = this.currentCliProcess;
    if (!cliProcess || !cliProcess.stdout) {
      callbacks.onError(new Error(`Failed to start Claude CLI process\n\n[${debugInfo}]`));
      return;
    }

    // חובה! סגירת stdin — בלי זה Claude CLI נתקע
    cliProcess.stdin?.end();

    // --- משתנים ---
    let fullText = '';
    let outputBuffer = '';
    let completed = false;
    let stderrText = '';
    let gotAnyOutput = false;
    // --- לוג אירועים: עוזר לדיאגנוסטיקה ---
    const eventLog: string[] = [];
    let rawChunks = 0;

    // --- timeout מבוסס-חוסר-פעילות (idle-based) ---
    // הבעיה עם timeout אבסולוטי: סריקת פרויקט יכולה לקחת 5-10 דקות
    // אבל ה-CLI שולח פלט כל הזמן (tool calls, תוצאות, events)
    // פתרון: מאפסים את ה-timeout בכל פעם שמגיע פלט כלשהו
    // כך ה-timeout רץ רק אם ה-CLI באמת תקוע (בלי פלט 120 שניות)
    // 5 דקות — Agent tasks (סריקת פרויקט, קריאת קבצים מרובים)
    // יכולים לקחת הרבה זמן בלי לשלוח stdout כי העבודה קורית ברקע
    const IDLE_TIMEOUT_MS = TIMEOUTS.CLI_IDLE_MS;

    // --- פונקציה לאיפוס ה-timeout ---
    const resetIdleTimeout = () => {
      if (this.cliTimeout) clearTimeout(this.cliTimeout);
      this.cliTimeout = setTimeout(() => {
        if (!completed) {
          cliProcess.kill('SIGTERM');
          const stderrSnippet = stderrText.trim().substring(0, 300);
          // --- לוג מפורט: מציגים את כל האירועים שהתקבלו ---
          const eventsDetail = eventLog.length > 0
            ? `Events (${eventLog.length}):\n${eventLog.slice(0, 20).join('\n')}\n\n`
            : 'No events parsed.\n\n';

          const timeoutError = new Error(
            `Claude CLI timed out (no output for ${IDLE_TIMEOUT_MS / 1000}s).\n\n` +
            `Got output: ${gotAnyOutput ? 'yes' : 'no'} (${rawChunks} chunks)\n` +
            `Accumulated text: ${fullText.length} chars\n` +
            `Buffer remaining: ${outputBuffer.length} chars\n` +
            (stderrSnippet ? `Stderr: ${stderrSnippet}\n\n` : '') +
            eventsDetail +
            `Debug: ${debugInfo}\n\n` +
            'Possible fixes:\n' +
            '1. Run: claude login\n' +
            '2. Or add API key in Settings',
          );
          const classified = classifyError(timeoutError);
          callbacks.onError(new Error(`[${classified.category}] ${classified.message}`));
        }
      }, IDLE_TIMEOUT_MS);
    };

    // --- מתחילים את ה-timeout הראשון ---
    resetIdleTimeout();

    // --- קריאת stdout ---
    cliProcess.stdout.on('data', (data: Buffer) => {
      gotAnyOutput = true;
      rawChunks++;
      const chunk = data.toString('utf-8');
      outputBuffer += chunk;

      // --- איפוס idle timeout בכל פלט ---
      // כל עוד ה-CLI שולח משהו = הוא עובד, לא תקוע!
      resetIdleTimeout();

      // לוג: תוכן ה-chunk הראשון (לדיאגנוסטיקה)
      if (rawChunks <= 3) {
        eventLog.push(`chunk#${rawChunks}(${chunk.length}b): ${chunk.substring(0, 120).replace(/\n/g, '\\n')}`);
      }

      // כל שורה = JSON event נפרד
      const lines = outputBuffer.split('\n');
      outputBuffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const event = JSON.parse(trimmed);
          // --- לוג כל event ---
          const evType = event.type || 'unknown';
          const evSubtype = event.subtype || '';
          eventLog.push(`event: ${evType}${evSubtype ? '/' + evSubtype : ''}`);

          this.handleCliEvent(event, callbacks, (text) => {
            fullText += text;
          }, () => {
            completed = true;
          }, () => fullText);
        } catch {
          // לא JSON — שומרים בלוג לדיאגנוסטיקה
          eventLog.push(`non-json(${trimmed.length}b): ${trimmed.substring(0, 80)}`);
        }
      }
    });

    // --- קריאת stderr ---
    // גם stderr מאפס timeout — לפעמים ה-CLI כותב לוגים לשם
    // בזמן שה-Agent עובד ברקע בלי stdout
    cliProcess.stderr?.on('data', (data: Buffer) => {
      stderrText += data.toString('utf-8');
      resetIdleTimeout();
    });

    // --- כשהתהליך נסגר ---
    return new Promise<void>((resolve) => {
      cliProcess.on('close', (code) => {
        if (this.cliTimeout) {
          clearTimeout(this.cliTimeout);
          this.cliTimeout = null;
        }
        this.currentCliProcess = null;

        // עיבוד שורה אחרונה ב-buffer
        if (outputBuffer.trim()) {
          try {
            const event = JSON.parse(outputBuffer.trim());
            this.handleCliEvent(event, callbacks, (text) => {
              fullText += text;
            }, () => {
              completed = true;
            }, () => fullText);
          } catch { /* ignore */ }
        }

        if (!completed) {
          if (fullText) {
            callbacks.onComplete(fullText, 0);
          } else if (code !== 0) {
            const errDetail = stderrText.trim()
              ? `\nStderr:\n${stderrText.trim().substring(0, 500)}`
              : '';
            const exitError = new Error(
              `Claude CLI exited with code ${code}.${errDetail}\n` +
              `Debug: ${debugInfo}\n\n` +
              'Possible fixes:\n' +
              '1. Run: claude login\n' +
              '2. Or add API key in Settings',
            );
            const classified = classifyError(exitError);
            callbacks.onError(new Error(`[${classified.category}] ${classified.message}`));
          } else {
            callbacks.onComplete('', 0);
          }
        }

        resolve();
      });

      cliProcess.on('error', (err) => {
        if (this.cliTimeout) {
          clearTimeout(this.cliTimeout);
          this.cliTimeout = null;
        }
        this.currentCliProcess = null;
        const classified = classifyError(err);
        callbacks.onError(new Error(`[${classified.category}] Claude CLI error: ${classified.message}`));
        resolve();
      });
    });
  }

  // -------------------------------------------------
  // handleCliEvent — טיפול באירוע JSON מה-CLI
  // -------------------------------------------------
  // פורמט אירועים (מתוך בדיקה אמיתית):
  //
  // 1. {"type":"system","subtype":"init",...}
  //    → אתחול, מתעלמים
  //
  // 2. {"type":"assistant","message":{"content":[{"type":"text","text":"..."}],...}}
  //    → התוכן! שולחים כטוקנים ל-UI
  //
  // 3. {"type":"rate_limit_event",...}
  //    → מידע rate limit, מתעלמים
  //
  // 4. {"type":"result","subtype":"success","result":"...","usage":{...}}
  //    → סיום! result = הטקסט המלא, usage = טוקנים
  // -------------------------------------------------
  private handleCliEvent(
    event: Record<string, unknown>,
    callbacks: StreamCallbacks,
    appendText: (text: string) => void,
    markComplete: () => void,
    getAccumulatedText?: () => string,
  ): void {
    const type = event.type as string;

    switch (type) {
      case 'assistant': {
        // התוכן נמצא ב-message.content (מערך של בלוקים)
        const message = event.message as Record<string, unknown> | undefined;
        const content = message?.content;

        if (Array.isArray(content)) {
          for (const block of content) {
            const b = block as Record<string, unknown>;
            if (b.type === 'text' && typeof b.text === 'string') {
              // --- טקסט רגיל — שולחים ל-UI ---
              appendText(b.text);
              callbacks.onToken(b.text);
            } else if (b.type === 'tool_use') {
              // --- שימוש ב-tool — מציגים עדכון התקדמות ---
              // זה מה שקורה כשה-CLI סורק קבצים, קורא, וכו'
              const toolName = b.name as string ?? '';
              const toolInput = b.input as Record<string, unknown> ?? {};
              // מציגים מה ה-CLI עושה (למשל: "Read: package.json")
              const shortDesc = toolInput.file_path
                ? String(toolInput.file_path).split(/[\\/]/).pop()
                : toolInput.pattern
                  ? String(toolInput.pattern)
                  : toolInput.command
                    ? String(toolInput.command).substring(0, 40)
                    : toolInput.description
                      ? String(toolInput.description).substring(0, 40)
                      : '';
              callbacks.onProgress?.(`🔧 ${toolName}${shortDesc ? ': ' + shortDesc : ''}`);
            }
          }
        } else if (typeof event.content === 'string') {
          // fallback — content ישירות על ה-event
          appendText(event.content);
          callbacks.onToken(event.content);
        }
        break;
      }

      case 'content_block_delta': {
        const delta = event.delta as Record<string, unknown> | undefined;
        const text = delta?.text as string ?? '';
        if (text) {
          appendText(text);
          callbacks.onToken(text);
        }
        break;
      }

      case 'result': {
        // אירוע סיום — result מכיל את הטקסט המלא
        // באג שתוקן: לפעמים result.result שונה ממה ש-stream-ד
        // לכן מעדיפים את הטקסט שנצבר מ-streaming (fullText)
        // ורק אם אין — משתמשים ב-result
        const resultText = (event.result as string) ?? '';
        const accumulated = getAccumulatedText?.() ?? '';
        const finalText = accumulated.length > 0 ? accumulated : resultText;

        const usage = event.usage as Record<string, number> | undefined;
        const inputTokens = usage?.input_tokens ?? 0;
        const outputTokens = usage?.output_tokens ?? 0;
        const totalTokens = inputTokens + outputTokens;

        markComplete();
        callbacks.onComplete(finalText, totalTokens, { inputTokens, outputTokens });
        break;
      }

      case 'error': {
        const errBody = event.error;
        const msg = typeof errBody === 'string'
          ? errBody
          : typeof errBody === 'object' && errBody
            ? ((errBody as Record<string, unknown>).message as string) ?? 'CLI error'
            : (event.message as string) ?? 'CLI error';
        callbacks.onError(new Error(msg));
        markComplete();
        break;
      }

      // --- אירועי מערכת: שולחים עדכוני התקדמות ---
      case 'system': {
        const subtype = event.subtype as string;
        if (subtype === 'init') {
          // --- אתחול session ---
          const model = event.model as string ?? '';
          const cwd = event.cwd as string ?? '';
          const cwdShort = cwd ? cwd.split(/[\\/]/).pop() : '';
          callbacks.onProgress?.(
            `מתחבר... (${model || 'Claude'}${cwdShort ? ` | ${cwdShort}` : ''})`,
          );
        } else if (subtype === 'task_started') {
          // --- סוכן חדש הופעל! ---
          // מציגים בצ'אט שסוכן התחיל לעבוד
          const desc = event.description as string ?? '';
          const taskType = event.task_type as string ?? '';
          const agentLabel = taskType === 'local_agent' ? '🤖 סוכן' : '⚙️ משימה';
          const statusLine = `\n\n---\n${agentLabel}: **${desc}**\n`;
          appendText(statusLine);
          callbacks.onToken(statusLine);
          callbacks.onProgress?.(`${agentLabel}: ${desc}`);
        } else if (subtype === 'task_progress') {
          // --- עדכון התקדמות מסוכן ברקע ---
          // מראים למשתמש מה הסוכן עושה עכשיו
          const content = event.content as string ?? '';
          if (content) {
            callbacks.onProgress?.(`🤖 ${content.substring(0, 60)}`);
          }
        } else if (subtype === 'task_completed') {
          // --- סוכן סיים! ---
          const desc = event.description as string ?? '';
          callbacks.onProgress?.(`✅ סוכן סיים: ${desc}`);
        }
        break;
      }

      // --- אירועי tool results מסוכנים (events עם parent_tool_use_id) ---
      // כשסוכן משתמש ב-tools, ה-CLI שולח events מסוג user עם תוצאות
      case 'user': {
        // מציגים עדכון התקדמות עבור tool results של סוכנים
        const parentId = event.parent_tool_use_id as string | null;
        if (parentId) {
          // זה tool result של סוכן — מציגים מה הוא קיבל
          const msg = event.message as Record<string, unknown> | undefined;
          const userContent = msg?.content;
          if (Array.isArray(userContent)) {
            for (const block of userContent) {
              const b = block as Record<string, unknown>;
              if (b.type === 'tool_result' && typeof b.content === 'string') {
                // מציגים snippet קצר מתוצאת ה-tool
                const snippet = b.content.substring(0, 80).replace(/\n/g, ' ');
                callbacks.onProgress?.(`📄 ${snippet}...`);
              }
            }
          }
        }
        break;
      }

      case 'ping':
      case 'rate_limit_event':
        break;

      default:
        break;
    }
  }

  // -------------------------------------------------
  // withRetry — wrapper method לביצוע retry עם exponential backoff
  // -------------------------------------------------
  // מקבל פונקציה אסינכרונית ומנסה שוב לפי סיווג השגיאה.
  // לא מחליף error handling קיים — עוטף אותו.
  // -------------------------------------------------
  private async withRetry<T>(
    operation: () => Promise<T>,
    callbacks: StreamCallbacks,
    context: string = 'operation',
  ): Promise<T> {
    let lastError: Error | null = null;
    let attempt = 0;
    const MAX_ATTEMPTS = 4; // attempt 0 + up to 3 retries

    while (attempt < MAX_ATTEMPTS) {
      try {
        return await operation();
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));

        // AbortError — לא retry, המשתמש ביטל
        if (err.name === 'AbortError') {
          throw err;
        }

        const classified = classifyError(err);
        lastError = err;

        // לא retryable — זורקים מיד
        if (!classified.retryable || attempt >= classified.maxRetries) {
          throw new Error(classified.message);
        }

        // חישוב backoff
        const baseDelay = classified.retryAfterMs ?? (1000 * Math.pow(2, attempt));
        // הוספת jitter קטן למניעת thundering herd
        const jitter = Math.random() * 500;
        const delayMs = baseDelay + jitter;

        attempt++;
        log.warn(
          `${context} failed (${classified.category}), ` +
          `retry ${attempt}/${classified.maxRetries} in ${Math.round(delayMs)}ms: ${err.message}`,
        );
        callbacks.onProgress?.(
          `${classified.category === 'RATE_LIMIT' ? 'Rate limited' : 'Error'}, ` +
          `retrying (${attempt}/${classified.maxRetries})...`,
        );

        // המתנה לפני retry
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    // לא אמור להגיע לכאן, אבל ליתר ביטחון
    throw lastError ?? new Error(`${context} failed after ${attempt} attempts`);
  }

  // =================================================
  // API MODE — שליחה דרך Anthropic SDK
  // =================================================
  private async sendMessageViaApi(
    messages: ChatMessage[],
    systemPrompt: string,
    model: ModelId,
    maxTokens: number,
    callbacks: StreamCallbacks,
  ): Promise<void> {
    if (!this.apiClient) {
      callbacks.onError(new Error('API key not configured. Go to Settings.'));
      return;
    }

    this.currentAbort = new AbortController();

    try {
      await this.withRetry(async () => {
        const anthropicMessages = messages
          .filter((m) => m.role !== 'system')
          .map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.images && m.images.length > 0
              ? [
                  ...m.images.map((img) => ({
                    type: 'image' as const,
                    source: {
                      type: 'base64' as const,
                      media_type: img.mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                      data: img.data,
                    },
                  })),
                  { type: 'text' as const, text: m.content },
                ]
              : m.content,
          }));

        if (!this.apiClient || !this.currentAbort) {
          throw new Error('API client or abort controller not initialized');
        }

        let fullText = '';
        const stream = this.apiClient.messages.stream({
          model,
          max_tokens: maxTokens,
          system: systemPrompt,
          messages: anthropicMessages,
        }, {
          signal: this.currentAbort.signal,
        });

        stream.on('text', (text: string) => {
          fullText += text;
          callbacks.onToken(text);
        });

        const finalMessage = await stream.finalMessage();
        const apiInputTokens = finalMessage.usage.input_tokens;
        const apiOutputTokens = finalMessage.usage.output_tokens;
        const totalTokens = apiInputTokens + apiOutputTokens;
        callbacks.onComplete(fullText, totalTokens, {
          inputTokens: apiInputTokens,
          outputTokens: apiOutputTokens,
        });
      }, callbacks, 'API request');
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      // classifyError כבר עיבד את ההודעה ב-withRetry — שולחים כמות שהיא
      callbacks.onError(error instanceof Error ? error : new Error('Unknown API error'));
    } finally {
      this.currentAbort = null;
    }
  }

  /**
   * Cancel the currently active request.
   * In API mode, aborts the HTTP request. In CLI mode, kills the subprocess.
   * On Windows, uses `taskkill` since SIGTERM does not work reliably.
   */
  public cancel(): void {
    // Clear timeouts BEFORE nulling process references to avoid race conditions
    if (this.cliTimeout) {
      clearTimeout(this.cliTimeout);
      this.cliTimeout = null;
    }
    if (this.mode === 'api') {
      this.currentAbort?.abort();
      this.currentAbort = null;
    } else {
      const proc = this.currentCliProcess;
      this.currentCliProcess = null;
      if (proc && !proc.killed && proc.pid) {
        try {
          if (process.platform === 'win32') {
            // On Windows, SIGTERM doesn't work properly — use taskkill
            spawn('taskkill', ['/pid', proc.pid.toString(), '/f', '/t'], {
              stdio: 'ignore',
            });
          } else {
            proc.kill('SIGTERM');
          }
        } catch (_err) {
          // Process may have already exited — ignore kill errors
        }
      }
    }
  }

  /**
   * Dispose all resources: cancel active requests and clear the response cache.
   * Should be called when the extension deactivates.
   */
  public dispose(): void {
    this.cancel();
    this.clearCache();
  }

  /**
   * Estimate the cost of an API request based on token usage and model pricing.
   * Returns 0 if the model is not found in MODEL_PRICING.
   *
   * @param model - The Claude model ID
   * @param inputTokens - Number of input tokens consumed
   * @param outputTokens - Number of output tokens generated
   * @returns Estimated cost in USD
   */
  public static estimateCost(
    model: ModelId,
    inputTokens: number,
    outputTokens: number,
  ): number {
    const p = MODEL_PRICING[model];
    if (!p) return 0;
    return (inputTokens / 1000) * p.input + (outputTokens / 1000) * p.output;
  }
}
