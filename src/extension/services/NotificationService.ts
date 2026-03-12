// ===================================================
// NotificationService — התראות חכמות
// ===================================================
// מנהל התראות ו-Smart Triggers
// ===================================================

import type { SmartNotification, Conversation } from '../../shared/types';
import { LIMITS } from '../../shared/constants';

export class NotificationService {
  private notifications: SmartNotification[] = [];

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

    // שמירה על מגבלה
    if (this.notifications.length > LIMITS.MAX_NOTIFICATIONS) {
      this.notifications.shift();
    }
  }

  // -------------------------------------------------
  // getAll — קבלת כל ההתראות
  // -------------------------------------------------
  public getAll(): SmartNotification[] {
    return this.notifications;
  }

  // -------------------------------------------------
  // clear — ניקוי התראות
  // -------------------------------------------------
  public clear(): void {
    this.notifications = [];
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
      id: Date.now().toString(),
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
