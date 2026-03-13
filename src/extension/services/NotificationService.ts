// ===================================================
// NotificationService — התראות חכמות
// ===================================================
// מנהל התראות ו-Smart Triggers
// שומר התראות ב-globalState כדי שישרדו reload
// ===================================================

import * as vscode from 'vscode';
import type { SmartNotification, Conversation } from '../../shared/types';
import { LIMITS } from '../../shared/constants';
import { generateId } from '../../shared/utils/generateId';

const STORAGE_KEY = 'notifications';

export class NotificationService {
  private notifications: SmartNotification[] = [];

  constructor(private readonly context: vscode.ExtensionContext) {
    // טעינת התראות שמורות מ-globalState
    this.notifications = this.context.globalState.get<SmartNotification[]>(STORAGE_KEY, []);
  }

  // -------------------------------------------------
  // persist — שמירה ל-globalState
  // -------------------------------------------------
  private persist(): void {
    void this.context.globalState.update(STORAGE_KEY, this.notifications);
  }

  // -------------------------------------------------
  // checkTriggers — בדיקת טריגרים חכמים
  // -------------------------------------------------
  public checkTriggers(conversation?: Conversation): SmartNotification[] {
    const triggered: SmartNotification[] = [];

    if (!conversation) return triggered;

    // טריגר: שיחה ארוכה מ-20 הודעות
    if (conversation.messages.length > 20) {
      triggered.push(this.create(
        'info', 'chat',
        'שיחה ארוכה',
        'השיחה הזו ארוכה. נסה /compact לדחוס אותה.',
        'normal',
        { label: 'דחוס', command: '/compact' },
      ));
    }

    // טריגר: יותר מ-150K טוקנים
    if (conversation.totalTokens > 150000) {
      triggered.push(this.create(
        'warning', 'chat',
        'הקשר גדול',
        'כמות הטוקנים גבוהה. שמור לזיכרון ופתח שיחה חדשה.',
        'high',
        { label: 'שמור', command: '/memory' },
      ));
    }

    // טריגר: עלות גבוהה
    if (conversation.estimatedCost > 5) {
      triggered.push(this.create(
        'warning', 'system',
        'עלות גבוהה',
        `עלות השיחה: $${conversation.estimatedCost.toFixed(2)}. שקול להשתמש במודל זול יותר.`,
        'normal',
      ));
    }

    return triggered;
  }

  // -------------------------------------------------
  // add — הוספת התראה
  // -------------------------------------------------
  public add(notification: SmartNotification): void {
    this.notifications.push(notification);

    // שמירה על מגבלה — FIFO eviction
    while (this.notifications.length > LIMITS.MAX_NOTIFICATIONS) {
      this.notifications.shift();
    }

    this.persist();
  }

  // -------------------------------------------------
  // getAll — קבלת כל ההתראות
  // -------------------------------------------------
  public getAll(): SmartNotification[] {
    return this.notifications;
  }

  // -------------------------------------------------
  // dismissNotification — סימון התראה כ-dismissed
  // -------------------------------------------------
  public dismissNotification(id: string): void {
    const notification = this.notifications.find((n) => n.id === id);
    if (notification) {
      notification.dismissed = true;
      this.persist();
    }
  }

  // -------------------------------------------------
  // clearAll — ניקוי כל ההתראות
  // -------------------------------------------------
  public clearAll(): void {
    this.notifications = [];
    this.persist();
  }

  // -------------------------------------------------
  // clear — ניקוי התראות (alias ל-clearAll)
  // -------------------------------------------------
  public clear(): void {
    this.clearAll();
  }

  // -------------------------------------------------
  // getUnreadCount — מספר התראות שלא נקראו
  // -------------------------------------------------
  public getUnreadCount(): number {
    return this.notifications.filter((n) => !n.dismissed).length;
  }

  // -------------------------------------------------
  // create — יצירת התראה
  // -------------------------------------------------
  private create(
    type: SmartNotification['type'],
    category: SmartNotification['category'],
    title: string,
    message: string,
    priority: SmartNotification['priority'],
    action?: SmartNotification['action'],
  ): SmartNotification {
    return {
      id: generateId(),
      type,
      category,
      title,
      message,
      priority,
      action,
      timestamp: new Date().toISOString(),
    };
  }
}
