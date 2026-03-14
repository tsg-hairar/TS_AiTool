// ===================================================
// ConversationStore — אחסון שיחות
// ===================================================
// שומר ומנהל את כל השיחות ב-globalState של VS Code
// כל שיחה שייכת לפרויקט + סוכן ספציפי
// ===================================================

import * as vscode from 'vscode';
import type { Conversation, ChatMessage, AgentId, SessionState, PinnedMessage } from '../../shared/types';
import { LIMITS } from '../../shared/constants';
import { generateId } from '../../shared/utils/generateId';
import { createLogger } from '../utils/logger';

const log = createLogger('ConversationStore');

// מפתחות לשמירה
const CONVERSATIONS_KEY = 'tsAiTool.conversations';
const DRAFTS_PREFIX = 'tsAiTool.drafts_';
const SESSION_STATE_KEY = 'tsAiTool.sessionState';
const DATA_VERSION_KEY = 'tsAiTool.dataVersion';

// גרסת הנתונים הנוכחית — להעלות בכל שינוי פורמט
const CURRENT_DATA_VERSION = 1;

export class ConversationStore {
  // השיחה הפעילה כרגע
  private activeConversationId: string | null = null;

  constructor(private readonly context: vscode.ExtensionContext) {
    // הרצת מיגרציה אם צריך
    this.migrateIfNeeded();
  }

  // -------------------------------------------------
  // migrateIfNeeded — מיגרציה אוטומטית של פורמט נתונים
  // -------------------------------------------------
  // נקרא בעת אתחול. בודק את גרסת הנתונים ומריץ מיגרציות
  // לפי הסדר עד לגרסה הנוכחית.
  // -------------------------------------------------
  private migrateIfNeeded(): void {
    try {
      const storedVersion = this.context.globalState.get<number>(DATA_VERSION_KEY) ?? 0;
      if (storedVersion >= CURRENT_DATA_VERSION) return;

      const migrations: Array<{ version: number; migrate: (convs: Conversation[]) => Conversation[] }> = [
        {
          version: 1,
          migrate: (convs) => convs.map((c) => ({
            ...c,
            // מוודאים שכל שדות החובה קיימים
            totalTokens: c.totalTokens ?? 0,
            estimatedCost: c.estimatedCost ?? 0,
            messages: (c.messages ?? []).map((m) => ({
              ...m,
              isPinned: m.isPinned ?? false,
              isBookmarked: m.isBookmarked ?? false,
            })),
          })),
        },
        // מיגרציות עתידיות — להוסיף כאן עם version: 2, 3...
      ];

      let conversations = this.context.globalState.get<Conversation[]>(CONVERSATIONS_KEY) ?? [];

      for (const migration of migrations) {
        if (storedVersion < migration.version) {
          conversations = migration.migrate(conversations);
        }
      }

      // שמירה מקבילה — נתונים + גרסה
      void Promise.all([
        this.context.globalState.update(CONVERSATIONS_KEY, conversations),
        this.context.globalState.update(DATA_VERSION_KEY, CURRENT_DATA_VERSION),
      ]).catch(err => console.error('Failed to save conversations:', err));
    } catch (err) {
      log.error(' Migration failed, continuing with existing data:', err);
    }
  }

  // -------------------------------------------------
  // getAll — קבלת כל השיחות
  // -------------------------------------------------
  public getAll(): Conversation[] {
    try {
      return this.context.globalState.get<Conversation[]>(CONVERSATIONS_KEY) ?? [];
    } catch (err) {
      log.error(' Failed to read conversations:', err);
      return [];
    }
  }

  // -------------------------------------------------
  // getByProject — שיחות לפי פרויקט
  // -------------------------------------------------
  public getByProject(projectId: string): Conversation[] {
    return this.getAll().filter((c) => c.projectId === projectId);
  }

  // -------------------------------------------------
  // getByProjectAndAgent — שיחות לפי פרויקט + סוכן
  // -------------------------------------------------
  public getByProjectAndAgent(projectId: string, agentId: AgentId): Conversation[] {
    return this.getAll().filter(
      (c) => c.projectId === projectId && c.agentId === agentId,
    );
  }

  // -------------------------------------------------
  // get — קבלת שיחה לפי ID
  // -------------------------------------------------
  public get(conversationId: string): Conversation | undefined {
    return this.getAll().find((c) => c.id === conversationId);
  }

  // -------------------------------------------------
  // getActive — קבלת השיחה הפעילה
  // -------------------------------------------------
  public getActive(): Conversation | undefined {
    if (!this.activeConversationId) return undefined;
    return this.get(this.activeConversationId);
  }

  // -------------------------------------------------
  // create — יצירת שיחה חדשה
  // -------------------------------------------------
  public async create(projectId: string, agentId: AgentId): Promise<Conversation> {
    const conversations = this.getAll();

    // בדיקת מגבלה
    if (conversations.length >= LIMITS.MAX_CONVERSATIONS) {
      // מוחקים את השיחה הישנה ביותר
      conversations.sort(
        (a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(),
      );
      conversations.shift(); // מוחקים את הראשונה (הישנה ביותר)
    }

    const conversation: Conversation = {
      id: generateId(),
      projectId,
      agentId,
      title: 'שיחה חדשה',
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      totalTokens: 0,
      estimatedCost: 0,
    };

    conversations.push(conversation);
    await this.save(conversations);

    // מסמנים כפעילה
    this.activeConversationId = conversation.id;

    return conversation;
  }

  // -------------------------------------------------
  // addMessage — הוספת הודעה לשיחה
  // -------------------------------------------------
  public async addMessage(
    conversationId: string,
    message: ChatMessage,
  ): Promise<void> {
    const conversations = this.getAll();
    const conv = conversations.find((c) => c.id === conversationId);
    if (!conv) return;

    // בדיקת מגבלת הודעות
    if (conv.messages.length >= LIMITS.MAX_MESSAGES_PER_CONVERSATION) {
      // מוחקים את ההודעה הישנה ביותר (שומרים על system messages)
      const firstNonSystem = conv.messages.findIndex((m) => m.role !== 'system');
      if (firstNonSystem >= 0) {
        conv.messages.splice(firstNonSystem, 1);
      }
    }

    conv.messages.push(message);
    conv.updatedAt = new Date().toISOString();

    // עדכון טוקנים ועלות
    if (message.tokenCount) {
      conv.totalTokens += message.tokenCount;
    }

    // עדכון כותרת לפי ההודעה הראשונה של המשתמש
    if (conv.title === 'שיחה חדשה' && message.role === 'user') {
      conv.title = message.content.slice(0, 50) + (message.content.length > 50 ? '...' : '');
    }

    await this.save(conversations);
  }

  // -------------------------------------------------
  // updateMessage — עדכון הודעה קיימת
  // -------------------------------------------------
  public async updateMessage(
    conversationId: string,
    messageId: string,
    updates: Partial<ChatMessage>,
  ): Promise<void> {
    const conversations = this.getAll();
    const conv = conversations.find((c) => c.id === conversationId);
    if (!conv) return;

    const msg = conv.messages.find((m) => m.id === messageId);
    if (!msg) return;

    Object.assign(msg, updates);
    conv.updatedAt = new Date().toISOString();

    await this.save(conversations);
  }

  // -------------------------------------------------
  // delete — מחיקת שיחה
  // -------------------------------------------------
  // מוחק שיחה וטיוטה מקבילית לשיפור ביצועים
  // -------------------------------------------------
  public async delete(conversationId: string): Promise<void> {
    const conversations = this.getAll().filter((c) => c.id !== conversationId);

    // שמירה מקבילית — שיחות + ניקוי טיוטה
    await Promise.all([
      this.save(conversations),
      this.clearDraft(conversationId),
    ]);

    if (this.activeConversationId === conversationId) {
      this.activeConversationId = null;
    }
  }

  // -------------------------------------------------
  // deleteByProject — מחיקת כל השיחות של פרויקט
  // -------------------------------------------------
  // מוחק שיחות וטיוטות מקבילית
  // -------------------------------------------------
  public async deleteByProject(projectId: string): Promise<void> {
    const allConversations = this.getAll();
    const toDelete = allConversations.filter((c) => c.projectId === projectId);
    const toKeep = allConversations.filter((c) => c.projectId !== projectId);

    // מחיקה מקבילית — שמירת השיחות שנשארו + ניקוי כל הטיוטות של הפרויקט
    await Promise.all([
      this.save(toKeep),
      ...toDelete.map((c) => this.clearDraft(c.id)),
    ]);
  }

  // -------------------------------------------------
  // setActive — הגדרת שיחה כפעילה
  // -------------------------------------------------
  public setActive(conversationId: string | null): void {
    this.activeConversationId = conversationId;
  }

  // -------------------------------------------------
  // getActiveId — מזהה השיחה הפעילה
  // -------------------------------------------------
  public getActiveId(): string | null {
    return this.activeConversationId;
  }

  // -------------------------------------------------
  // clearMessages — ניקוי הודעות בשיחה
  // -------------------------------------------------
  public async clearMessages(conversationId: string): Promise<void> {
    const conversations = this.getAll();
    const conv = conversations.find((c) => c.id === conversationId);
    if (!conv) return;

    conv.messages = [];
    conv.updatedAt = new Date().toISOString();
    await this.save(conversations);
  }

  // -------------------------------------------------
  // search — חיפוש בהודעות
  // -------------------------------------------------
  public search(query: string, projectId?: string): ChatMessage[] {
    const conversations = projectId
      ? this.getByProject(projectId)
      : this.getAll();

    const lowerQuery = query.toLowerCase();
    const results: ChatMessage[] = [];

    for (const conv of conversations) {
      for (const msg of conv.messages) {
        if (msg.content.toLowerCase().includes(lowerQuery)) {
          results.push(msg);
        }
      }
    }

    return results;
  }

  // -------------------------------------------------
  // pinMessage — הצמדת הודעה בשיחה
  // -------------------------------------------------
  public async pinMessage(conversationId: string, messageId: string): Promise<PinnedMessage | null> {
    const conversations = this.getAll();
    const conv = conversations.find((c) => c.id === conversationId);
    if (!conv) return null;

    const msg = conv.messages.find((m) => m.id === messageId);
    if (!msg) return null;

    // עדכון ההודעה כמוצמדת
    msg.isPinned = true;
    conv.updatedAt = new Date().toISOString();
    await this.save(conversations);

    return {
      messageId: msg.id,
      pinnedAt: new Date().toISOString(),
      preview: msg.content.slice(0, 120) + (msg.content.length > 120 ? '...' : ''),
    };
  }

  // -------------------------------------------------
  // unpinMessage — ביטול הצמדת הודעה
  // -------------------------------------------------
  public async unpinMessage(conversationId: string, messageId: string): Promise<void> {
    const conversations = this.getAll();
    const conv = conversations.find((c) => c.id === conversationId);
    if (!conv) return;

    const msg = conv.messages.find((m) => m.id === messageId);
    if (!msg) return;

    msg.isPinned = false;
    conv.updatedAt = new Date().toISOString();
    await this.save(conversations);
  }

  // -------------------------------------------------
  // getPinnedMessages — קבלת כל ההודעות המוצמדות בשיחה
  // -------------------------------------------------
  public getPinnedMessages(conversationId: string): PinnedMessage[] {
    const conv = this.get(conversationId);
    if (!conv) return [];

    return conv.messages
      .filter((m) => m.isPinned)
      .map((m) => ({
        messageId: m.id,
        pinnedAt: conv.updatedAt,
        preview: m.content.slice(0, 120) + (m.content.length > 120 ? '...' : ''),
      }));
  }

  // -------------------------------------------------
  // saveDraft — שמירת טיוטת הודעה
  // -------------------------------------------------
  // שומר את הטקסט שהמשתמש כתב אבל עדיין לא שלח
  // לכל שיחה יש טיוטה נפרדת ב-globalState
  // -------------------------------------------------
  public async saveDraft(conversationId: string, text: string): Promise<void> {
    const key = `${DRAFTS_PREFIX}${conversationId}`;
    try {
      if (text.trim()) {
        await this.context.globalState.update(key, text);
      } else {
        // ניקוי טיוטה ריקה
        await this.context.globalState.update(key, undefined);
      }
    } catch (err) {
      log.error(' Failed to save draft:', err);
    }
  }

  // -------------------------------------------------
  // loadDraft — טעינת טיוטה שנשמרה
  // -------------------------------------------------
  public loadDraft(conversationId: string): string | undefined {
    try {
      const key = `${DRAFTS_PREFIX}${conversationId}`;
      return this.context.globalState.get<string>(key);
    } catch (err) {
      log.error(' Failed to load draft:', err);
      return undefined;
    }
  }

  // -------------------------------------------------
  // clearDraft — ניקוי טיוטה לאחר שליחה
  // -------------------------------------------------
  public async clearDraft(conversationId: string): Promise<void> {
    const key = `${DRAFTS_PREFIX}${conversationId}`;
    try {
      await this.context.globalState.update(key, undefined);
    } catch (err) {
      log.error(' Failed to clear draft:', err);
    }
  }

  // -------------------------------------------------
  // saveSessionState — שמירת מצב מושב לשחזור
  // -------------------------------------------------
  // נקרא בעת סגירת חלון, blur, ומחזורי שמירה אוטומטית
  // -------------------------------------------------
  public async saveSessionState(state: SessionState): Promise<void> {
    try {
      await this.context.globalState.update(SESSION_STATE_KEY, state);
    } catch (err) {
      log.error(' Failed to save session state:', err);
    }
  }

  // -------------------------------------------------
  // loadSessionState — טעינת מצב מושב אחרון
  // -------------------------------------------------
  public loadSessionState(): SessionState | undefined {
    try {
      return this.context.globalState.get<SessionState>(SESSION_STATE_KEY);
    } catch (err) {
      log.error(' Failed to load session state:', err);
      return undefined;
    }
  }

  // -------------------------------------------------
  // clearSessionState — ניקוי מצב מושב
  // -------------------------------------------------
  public async clearSessionState(): Promise<void> {
    try {
      await this.context.globalState.update(SESSION_STATE_KEY, undefined);
    } catch (err) {
      log.error(' Failed to clear session state:', err);
    }
  }

  // -------------------------------------------------
  // saveAllState — שמירת מצב מלא (session + draft) במקביל
  // -------------------------------------------------
  // שימושי בעת סגירת חלון — שומר הכל בבת אחת
  // -------------------------------------------------
  public async saveAllState(
    sessionState: SessionState,
    activeDraft?: { conversationId: string; text: string },
  ): Promise<void> {
    const tasks: Promise<void>[] = [
      this.saveSessionState(sessionState),
    ];

    if (activeDraft) {
      tasks.push(this.saveDraft(activeDraft.conversationId, activeDraft.text));
    }

    await Promise.all(tasks);
  }

  // -------------------------------------------------
  // save — שמירה ב-globalState
  // -------------------------------------------------
  private async save(conversations: Conversation[]): Promise<void> {
    try {
      await this.context.globalState.update(CONVERSATIONS_KEY, conversations);
    } catch (err) {
      log.error(' Failed to save conversations:', err);
      throw err; // re-throw — שמירה היא קריטית
    }
  }
}

