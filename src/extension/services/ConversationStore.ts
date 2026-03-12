// ===================================================
// ConversationStore — אחסון שיחות
// ===================================================
// שומר ומנהל את כל השיחות ב-globalState של VS Code
// כל שיחה שייכת לפרויקט + סוכן ספציפי
// ===================================================

import * as vscode from 'vscode';
import type { Conversation, ChatMessage, AgentId } from '../../shared/types';
import { LIMITS } from '../../shared/constants';

// מפתח לשמירה
const CONVERSATIONS_KEY = 'tsAiTool.conversations';

export class ConversationStore {
  // השיחה הפעילה כרגע
  private activeConversationId: string | null = null;

  constructor(private readonly context: vscode.ExtensionContext) {}

  // -------------------------------------------------
  // getAll — קבלת כל השיחות
  // -------------------------------------------------
  public getAll(): Conversation[] {
    return this.context.globalState.get<Conversation[]>(CONVERSATIONS_KEY) ?? [];
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
  public async delete(conversationId: string): Promise<void> {
    const conversations = this.getAll().filter((c) => c.id !== conversationId);
    await this.save(conversations);

    if (this.activeConversationId === conversationId) {
      this.activeConversationId = null;
    }
  }

  // -------------------------------------------------
  // deleteByProject — מחיקת כל השיחות של פרויקט
  // -------------------------------------------------
  public async deleteByProject(projectId: string): Promise<void> {
    const conversations = this.getAll().filter((c) => c.projectId !== projectId);
    await this.save(conversations);
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
  // save — שמירה ב-globalState
  // -------------------------------------------------
  private async save(conversations: Conversation[]): Promise<void> {
    await this.context.globalState.update(CONVERSATIONS_KEY, conversations);
  }
}

// -------------------------------------------------
// generateId — מזהה ייחודי
// -------------------------------------------------
function generateId(): string {
  const bytes = new Uint8Array(16);
  require('crypto').randomFillSync(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
