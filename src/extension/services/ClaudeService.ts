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

import { spawn, type ChildProcess } from 'child_process';
import type { ModelId, ChatMessage, ToolUse } from '../../shared/types';

// -------------------------------------------------
// מצבי חיבור
// -------------------------------------------------
export type ConnectionMode = 'cli' | 'api';

/** תוצאה של קריאת streaming */
export interface StreamCallbacks {
  /** נקרא עם כל טוקן חדש */
  onToken: (token: string) => void;
  /** נקרא כשהתגובה הושלמה */
  onComplete: (fullText: string, tokenCount: number) => void;
  /** נקרא כשיש שימוש בכלי */
  onToolUse: (toolUse: ToolUse) => void;
  /** נקרא בשגיאה */
  onError: (error: Error) => void;
}

export class ClaudeService {
  // -------------------------------------------------
  // מצב חיבור — cli (המנוי) או api (מפתח API)
  // -------------------------------------------------
  private mode: ConnectionMode = 'cli';

  // --- CLI Mode ---
  // תהליך Claude CLI שרץ ברקע
  private cliProcess: ChildProcess | null = null;
  // האם ה-CLI מוכן לקבל הודעות
  private cliReady = false;
  // Buffer לקריאת פלט מה-CLI
  private outputBuffer = '';
  // Callbacks של ההודעה הנוכחית
  private currentCallbacks: StreamCallbacks | null = null;

  // --- API Mode ---
  // לקוח Anthropic SDK (רק אם בחרו API mode)
  private apiClient: import('@anthropic-ai/sdk').default | null = null;
  private currentAbort: AbortController | null = null;

  // -------------------------------------------------
  // initialize — אתחול השירות
  // -------------------------------------------------
  // apiKey ריק = CLI mode (המנוי שלך)
  // apiKey מלא = API mode (משלם לפי טוקנים)
  // -------------------------------------------------
  public initialize(apiKey?: string): void {
    if (apiKey && apiKey.startsWith('sk-')) {
      // --- API Mode ---
      // יש API key → עובדים ישירות עם ה-SDK
      this.mode = 'api';
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const Anthropic = require('@anthropic-ai/sdk');
        this.apiClient = new Anthropic({ apiKey });
      } catch {
        // SDK לא מותקן — fallback ל-CLI
        this.mode = 'cli';
        this.startCliProcess();
      }
    } else {
      // --- CLI Mode ---
      // אין API key → עובדים דרך claude CLI (המנוי שלך!)
      this.mode = 'cli';
      this.startCliProcess();
    }
  }

  // -------------------------------------------------
  // isReady — בדיקה אם מוכן לשלוח הודעות
  // -------------------------------------------------
  public isReady(): boolean {
    if (this.mode === 'api') {
      return this.apiClient !== null;
    }
    return this.cliReady || this.cliProcess !== null;
  }

  // -------------------------------------------------
  // getMode — קבלת מצב החיבור הנוכחי
  // -------------------------------------------------
  public getMode(): ConnectionMode {
    return this.mode;
  }

  // =================================================
  // CLI MODE — דרך המנוי שלך
  // =================================================
  // זה עובד ע"י הרצת `claude` כ-subprocess
  // ושליחת הודעות דרך stdin, קבלת תגובות דרך stdout
  // בדיוק כמו שהתוסף הישן (AITool) עבד!
  // =================================================

  // -------------------------------------------------
  // startCliProcess — הפעלת תהליך Claude CLI
  // -------------------------------------------------
  private startCliProcess(): void {
    try {
      // הרצת claude בצורה אינטראקטיבית
      // --output-format stream-json = קבלת JSON streaming
      this.cliProcess = spawn('claude', [
        '--output-format', 'stream-json',
        '--verbose',
      ], {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
        // עבודה בתיקייה הנוכחית של VS Code
        env: { ...process.env },
      });

      this.cliReady = true;

      // --- קריאת stdout (תגובות מ-Claude) ---
      this.cliProcess.stdout?.on('data', (data: Buffer) => {
        this.handleCliOutput(data.toString('utf-8'));
      });

      // --- קריאת stderr (שגיאות/לוגים) ---
      this.cliProcess.stderr?.on('data', (data: Buffer) => {
        const text = data.toString('utf-8');
        // stderr מכיל לפעמים סטטוס, לא תמיד שגיאות
        console.log('[Claude CLI stderr]:', text);
      });

      // --- כשהתהליך נסגר ---
      this.cliProcess.on('close', (code) => {
        console.log(`[Claude CLI] Process exited with code ${code}`);
        this.cliProcess = null;
        this.cliReady = false;
      });

      this.cliProcess.on('error', (err) => {
        console.error('[Claude CLI] Failed to start:', err.message);
        this.cliProcess = null;
        this.cliReady = false;
        // אם Claude CLI לא מותקן — מודיעים למשתמש
        this.currentCallbacks?.onError(
          new Error(
            'Claude CLI not found. Install it with: npm install -g @anthropic-ai/claude-code\n' +
            'Or provide an API key in Settings → tsAiTool.apiKey',
          ),
        );
      });
    } catch (error) {
      console.error('[Claude CLI] Spawn error:', error);
      this.cliReady = false;
    }
  }

  // -------------------------------------------------
  // handleCliOutput — עיבוד פלט מה-CLI
  // -------------------------------------------------
  private handleCliOutput(rawData: string): void {
    // הוספה ל-buffer (כי הנתונים מגיעים בחלקים)
    this.outputBuffer += rawData;

    // פיצול לשורות — כל שורה = JSON נפרד
    const lines = this.outputBuffer.split('\n');

    // השורה האחרונה עלולה להיות חלקית — שומרים אותה
    this.outputBuffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const event = JSON.parse(trimmed);
        this.handleCliEvent(event);
      } catch {
        // לא JSON — כנראה טקסט רגיל מ-Claude
        // שולחים כטוקן
        if (trimmed && this.currentCallbacks) {
          this.currentCallbacks.onToken(trimmed);
        }
      }
    }
  }

  // -------------------------------------------------
  // handleCliEvent — טיפול באירוע JSON מה-CLI
  // -------------------------------------------------
  private handleCliEvent(event: Record<string, unknown>): void {
    if (!this.currentCallbacks) return;

    const type = event.type as string;

    switch (type) {
      // --- טוקן חדש (streaming) ---
      case 'assistant':
      case 'content_block_delta': {
        const text = (event.content as string)
          ?? ((event.delta as Record<string, unknown>)?.text as string)
          ?? '';
        if (text) {
          this.currentCallbacks.onToken(text);
        }
        break;
      }

      // --- שימוש בכלי ---
      case 'tool_use': {
        const toolUse: ToolUse = {
          id: (event.id as string) ?? Date.now().toString(),
          name: (event.name as string) as ToolUse['name'],
          input: (event.input as Record<string, unknown>) ?? {},
          status: 'running',
        };
        this.currentCallbacks.onToolUse(toolUse);
        break;
      }

      // --- תוצאת כלי ---
      case 'tool_result': {
        // הכלי סיים — ממשיכים streaming
        break;
      }

      // --- סיום ---
      case 'result':
      case 'message_stop': {
        const content = (event.result as string) ?? (event.content as string) ?? '';
        const tokenCount = (event.total_tokens as number)
          ?? ((event.usage as Record<string, number>)?.output_tokens ?? 0);
        this.currentCallbacks.onComplete(content, tokenCount);
        this.currentCallbacks = null;
        break;
      }

      // --- שגיאה ---
      case 'error': {
        const msg = (event.error as string) ?? (event.message as string) ?? 'CLI error';
        this.currentCallbacks.onError(new Error(msg));
        this.currentCallbacks = null;
        break;
      }

      // --- אירועי סטטוס (מתעלמים) ---
      case 'system':
      case 'ping':
        break;

      default:
        // אירוע לא מוכר — שולחים כטקסט אם יש content
        if (event.content && typeof event.content === 'string') {
          this.currentCallbacks.onToken(event.content);
        }
    }
  }

  // -------------------------------------------------
  // sendMessage — שליחת הודעה (CLI או API)
  // -------------------------------------------------
  public async sendMessage(
    messages: ChatMessage[],
    systemPrompt: string,
    model: ModelId,
    maxTokens: number,
    callbacks: StreamCallbacks,
  ): Promise<void> {
    if (this.mode === 'api') {
      return this.sendMessageViaApi(messages, systemPrompt, model, maxTokens, callbacks);
    }
    return this.sendMessageViaCli(messages, systemPrompt, model, callbacks);
  }

  // =================================================
  // CLI — שליחה דרך Claude CLI
  // =================================================
  private async sendMessageViaCli(
    messages: ChatMessage[],
    systemPrompt: string,
    _model: ModelId,
    callbacks: StreamCallbacks,
  ): Promise<void> {
    // בדיקה שה-CLI רץ
    if (!this.cliProcess || !this.cliReady) {
      this.startCliProcess();
      // נותנים לו רגע להתחיל
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (!this.cliProcess?.stdin) {
      callbacks.onError(
        new Error(
          'Claude CLI not available.\n\n' +
          'Option 1: Install Claude Code CLI: npm install -g @anthropic-ai/claude-code\n' +
          'Option 2: Add API key in Settings → tsAiTool.apiKey',
        ),
      );
      return;
    }

    // שמירת callbacks
    this.currentCallbacks = callbacks;

    // בניית ההודעה לשליחה
    // שולחים את ההודעה האחרונה של המשתמש
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUserMessage) {
      callbacks.onError(new Error('No user message found'));
      return;
    }

    // שליחה ל-stdin של Claude CLI
    const prompt = lastUserMessage.content;

    try {
      this.cliProcess.stdin.write(prompt + '\n');
    } catch (error) {
      callbacks.onError(
        error instanceof Error ? error : new Error('Failed to write to CLI'),
      );
    }
  }

  // =================================================
  // API — שליחה דרך Anthropic SDK
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
      // המרת הודעות לפורמט Anthropic API
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
      const totalTokens = finalMessage.usage.input_tokens + finalMessage.usage.output_tokens;
      callbacks.onComplete(fullText, totalTokens);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      callbacks.onError(
        error instanceof Error ? error : new Error('Unknown API error'),
      );
    } finally {
      this.currentAbort = null;
    }
  }

  // -------------------------------------------------
  // cancel — ביטול הבקשה
  // -------------------------------------------------
  public cancel(): void {
    if (this.mode === 'api') {
      // API mode — ביטול בקשת HTTP
      if (this.currentAbort) {
        this.currentAbort.abort();
        this.currentAbort = null;
      }
    } else {
      // CLI mode — שליחת Ctrl+C לתהליך
      if (this.cliProcess) {
        this.cliProcess.kill('SIGINT');
      }
    }
    this.currentCallbacks = null;
  }

  // -------------------------------------------------
  // dispose — ניקוי — סגירת תהליך CLI
  // -------------------------------------------------
  public dispose(): void {
    if (this.cliProcess) {
      this.cliProcess.kill();
      this.cliProcess = null;
    }
    this.cliReady = false;
    this.currentCallbacks = null;
  }

  // -------------------------------------------------
  // estimateCost — חישוב עלות (רק API mode)
  // -------------------------------------------------
  public static estimateCost(
    model: ModelId,
    inputTokens: number,
    outputTokens: number,
  ): number {
    const pricing: Record<ModelId, { input: number; output: number }> = {
      'claude-sonnet-4-20250514': { input: 0.003, output: 0.015 },
      'claude-opus-4-20250514': { input: 0.015, output: 0.075 },
      'claude-haiku-4-5-20251001': { input: 0.001, output: 0.005 },
    };

    const p = pricing[model];
    if (!p) return 0;
    return (inputTokens / 1000) * p.input + (outputTokens / 1000) * p.output;
  }
}
