// ===================================================
// AnalyticsService — מעקב שימוש וסטטיסטיקות
// ===================================================
// עוקב אחר: הודעות, טוקנים, עלות, זמני תגובה,
// סוכנים, פקודות, סשנים
// שומר ב-globalState תחת tsAiTool.analytics
// ===================================================

import * as vscode from 'vscode';
import type { AgentId } from '../../shared/types';

// -------------------------------------------------
// מפתח שמירה
// -------------------------------------------------
const ANALYTICS_KEY = 'tsAiTool.analytics';

// -------------------------------------------------
// טיפוסים
// -------------------------------------------------

/** רשומה יומית */
export interface DailyStats {
  /** תאריך בפורמט YYYY-MM-DD */
  date: string;
  /** הודעות שנשלחו */
  messagesSent: number;
  /** הודעות שהתקבלו */
  messagesReceived: number;
  /** טוקנים שנצרכו */
  tokensUsed: number;
  /** עלות משוערת ($) */
  estimatedCost: number;
  /** סכום זמני תגובה (מילישניות) — לחישוב ממוצע */
  totalResponseTime: number;
  /** מספר תגובות — לחישוב ממוצע */
  responseCount: number;
}

/** מונה שימוש לפי מפתח (סוכן/פקודה/פרויקט) */
export interface UsageCounter {
  [key: string]: number;
}

/** נתוני אנליטיקס מלאים */
export interface AnalyticsData {
  /** נתונים יומיים — מקסימום 90 יום */
  dailyStats: DailyStats[];
  /** שימוש לפי סוכן */
  agentUsage: UsageCounter;
  /** שימוש לפי פקודה */
  commandUsage: UsageCounter;
  /** שימוש לפי פרויקט */
  projectUsage: UsageCounter;
  /** סה"כ סשנים */
  totalSessions: number;
  /** תחילת הסשן הנוכחי */
  currentSessionStart: string;
  /** הודעות בסשן הנוכחי */
  currentSessionMessages: number;
  /** מודל בשימוש */
  currentModel: string;
  /** תאריך התקנה ראשונית */
  firstUsedAt: string;
}

/** סטטיסטיקות מסוכמות לתצוגה */
export interface AnalyticsSummary {
  // --- כרטיסי סיכום ---
  totalMessages: number;
  totalTokens: number;
  totalCost: number;
  avgResponseTime: number;
  // --- מגמות (השוואה לשבוע קודם) ---
  messageTrend: number; // אחוז שינוי
  tokenTrend: number;
  costTrend: number;
  // --- נתונים יומיים (7 ימים אחרונים) ---
  dailyMessages: Array<{ date: string; sent: number; received: number }>;
  // --- שימוש לפי סוכן ---
  agentUsage: Array<{ agentId: string; count: number }>;
  // --- פקודות פופולריות ---
  topCommands: Array<{ command: string; count: number }>;
  // --- פרויקטים לפי פעילות ---
  topProjects: Array<{ projectId: string; count: number }>;
  // --- סשן נוכחי ---
  sessionDuration: number; // דקות
  sessionMessages: number;
  currentModel: string;
  // --- נתוני טוקנים יומיים (7 ימים) ---
  dailyTokens: Array<{ date: string; tokens: number }>;
}

// -------------------------------------------------
// AnalyticsService
// -------------------------------------------------
export class AnalyticsService {
  private data: AnalyticsData;

  constructor(private readonly context: vscode.ExtensionContext) {
    // טעינה מ-globalState או אתחול
    const stored = this.context.globalState.get<AnalyticsData>(ANALYTICS_KEY);
    if (stored) {
      this.data = stored;
    } else {
      const now = new Date().toISOString();
      this.data = {
        dailyStats: [],
        agentUsage: {},
        commandUsage: {},
        projectUsage: {},
        totalSessions: 1,
        currentSessionStart: now,
        currentSessionMessages: 0,
        currentModel: '',
        firstUsedAt: now,
      };
    }

    // סשן חדש
    this.data.totalSessions += 1;
    this.data.currentSessionStart = new Date().toISOString();
    this.data.currentSessionMessages = 0;
    this.save();
  }

  // -------------------------------------------------
  // trackMessage — מעקב הודעה שנשלחה/התקבלה
  // -------------------------------------------------
  public async trackMessage(
    direction: 'sent' | 'received',
    options?: {
      tokenCount?: number;
      cost?: number;
      responseTimeMs?: number;
      agentId?: AgentId;
      projectId?: string;
    },
  ): Promise<void> {
    const today = this.getToday();
    const daily = this.getOrCreateDaily(today);

    if (direction === 'sent') {
      daily.messagesSent += 1;
    } else {
      daily.messagesReceived += 1;
    }

    if (options?.tokenCount) {
      daily.tokensUsed += options.tokenCount;
    }
    if (options?.cost) {
      daily.estimatedCost += options.cost;
    }
    if (options?.responseTimeMs) {
      daily.totalResponseTime += options.responseTimeMs;
      daily.responseCount += 1;
    }

    // מונים לפי סוכן
    if (options?.agentId) {
      this.data.agentUsage[options.agentId] =
        (this.data.agentUsage[options.agentId] || 0) + 1;
    }

    // מונים לפי פרויקט
    if (options?.projectId) {
      this.data.projectUsage[options.projectId] =
        (this.data.projectUsage[options.projectId] || 0) + 1;
    }

    // סשן נוכחי
    this.data.currentSessionMessages += 1;

    await this.save();
  }

  // -------------------------------------------------
  // trackTokenUsage — מעקב טוקנים בנפרד
  // -------------------------------------------------
  public async trackTokenUsage(tokens: number, cost: number): Promise<void> {
    const today = this.getToday();
    const daily = this.getOrCreateDaily(today);
    daily.tokensUsed += tokens;
    daily.estimatedCost += cost;
    await this.save();
  }

  // -------------------------------------------------
  // trackCommand — מעקב פקודת slash
  // -------------------------------------------------
  public async trackCommand(command: string): Promise<void> {
    this.data.commandUsage[command] =
      (this.data.commandUsage[command] || 0) + 1;
    await this.save();
  }

  // -------------------------------------------------
  // setModel — עדכון המודל הנוכחי
  // -------------------------------------------------
  public setModel(model: string): void {
    this.data.currentModel = model;
  }

  // -------------------------------------------------
  // getStats — סטטיסטיקות מסוכמות
  // -------------------------------------------------
  public getStats(): AnalyticsSummary {
    const now = new Date();
    const last7days = this.getLastNDays(7);
    const prev7days = this.getLastNDays(14).filter(
      (d) => !last7days.some((l) => l.date === d.date),
    );

    // סיכומים
    const totalMessages = this.data.dailyStats.reduce(
      (sum, d) => sum + d.messagesSent + d.messagesReceived, 0,
    );
    const totalTokens = this.data.dailyStats.reduce(
      (sum, d) => sum + d.tokensUsed, 0,
    );
    const totalCost = this.data.dailyStats.reduce(
      (sum, d) => sum + d.estimatedCost, 0,
    );
    const totalResponseTime = this.data.dailyStats.reduce(
      (sum, d) => sum + d.totalResponseTime, 0,
    );
    const totalResponseCount = this.data.dailyStats.reduce(
      (sum, d) => sum + d.responseCount, 0,
    );
    const avgResponseTime = totalResponseCount > 0
      ? totalResponseTime / totalResponseCount
      : 0;

    // מגמות (7 ימים אחרונים vs 7 לפני)
    const thisWeekMessages = last7days.reduce(
      (s, d) => s + d.messagesSent + d.messagesReceived, 0,
    );
    const prevWeekMessages = prev7days.reduce(
      (s, d) => s + d.messagesSent + d.messagesReceived, 0,
    );
    const thisWeekTokens = last7days.reduce((s, d) => s + d.tokensUsed, 0);
    const prevWeekTokens = prev7days.reduce((s, d) => s + d.tokensUsed, 0);
    const thisWeekCost = last7days.reduce((s, d) => s + d.estimatedCost, 0);
    const prevWeekCost = prev7days.reduce((s, d) => s + d.estimatedCost, 0);

    const trend = (current: number, previous: number) =>
      previous > 0 ? ((current - previous) / previous) * 100 : current > 0 ? 100 : 0;

    // נתונים יומיים (7 ימים)
    const dailyMessages = this.buildLast7DaysData(last7days);
    const dailyTokens = this.buildLast7DaysTokens(last7days);

    // סוכנים — ממוינים
    const agentUsage = Object.entries(this.data.agentUsage)
      .map(([agentId, count]) => ({ agentId, count }))
      .sort((a, b) => b.count - a.count);

    // פקודות — ממוינות
    const topCommands = Object.entries(this.data.commandUsage)
      .map(([command, count]) => ({ command, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // פרויקטים — ממוינים
    const topProjects = Object.entries(this.data.projectUsage)
      .map(([projectId, count]) => ({ projectId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // סשן נוכחי
    const sessionStart = new Date(this.data.currentSessionStart);
    const sessionDuration = Math.round((now.getTime() - sessionStart.getTime()) / 60000);

    return {
      totalMessages,
      totalTokens,
      totalCost,
      avgResponseTime,
      messageTrend: trend(thisWeekMessages, prevWeekMessages),
      tokenTrend: trend(thisWeekTokens, prevWeekTokens),
      costTrend: trend(thisWeekCost, prevWeekCost),
      dailyMessages,
      agentUsage,
      topCommands,
      topProjects,
      sessionDuration,
      sessionMessages: this.data.currentSessionMessages,
      currentModel: this.data.currentModel,
      dailyTokens,
    };
  }

  // -------------------------------------------------
  // getDailyStats — נתונים יומיים גולמיים
  // -------------------------------------------------
  public getDailyStats(): DailyStats[] {
    return this.data.dailyStats;
  }

  // -------------------------------------------------
  // getWeeklyStats — סיכום שבועי
  // -------------------------------------------------
  public getWeeklyStats(): DailyStats[] {
    return this.getLastNDays(7);
  }

  // -------------------------------------------------
  // reset — איפוס כל הנתונים
  // -------------------------------------------------
  public async reset(): Promise<void> {
    const now = new Date().toISOString();
    this.data = {
      dailyStats: [],
      agentUsage: {},
      commandUsage: {},
      projectUsage: {},
      totalSessions: 1,
      currentSessionStart: now,
      currentSessionMessages: 0,
      currentModel: this.data.currentModel,
      firstUsedAt: now,
    };
    await this.save();
  }

  // =================================================
  // עזר — פנימי
  // =================================================

  /** תאריך היום בפורמט YYYY-MM-DD */
  private getToday(): string {
    return new Date().toISOString().slice(0, 10);
  }

  /** מחזיר או יוצר רשומה יומית */
  private getOrCreateDaily(date: string): DailyStats {
    let daily = this.data.dailyStats.find((d) => d.date === date);
    if (!daily) {
      daily = {
        date,
        messagesSent: 0,
        messagesReceived: 0,
        tokensUsed: 0,
        estimatedCost: 0,
        totalResponseTime: 0,
        responseCount: 0,
      };
      this.data.dailyStats.push(daily);

      // שמירת מקסימום 90 ימים
      if (this.data.dailyStats.length > 90) {
        this.data.dailyStats = this.data.dailyStats.slice(-90);
      }
    }
    return daily;
  }

  /** מחזיר את N הימים האחרונים */
  private getLastNDays(n: number): DailyStats[] {
    const today = new Date();
    const dates: string[] = [];
    for (let i = 0; i < n; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      dates.push(d.toISOString().slice(0, 10));
    }
    return this.data.dailyStats.filter((d) => dates.includes(d.date));
  }

  /** בונה נתוני הודעות יומיים ל-7 ימים אחרונים (כולל ימים ריקים) */
  private buildLast7DaysData(
    last7: DailyStats[],
  ): Array<{ date: string; sent: number; received: number }> {
    const result: Array<{ date: string; sent: number; received: number }> = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const daily = last7.find((dd) => dd.date === dateStr);
      result.push({
        date: dateStr,
        sent: daily?.messagesSent ?? 0,
        received: daily?.messagesReceived ?? 0,
      });
    }
    return result;
  }

  /** בונה נתוני טוקנים יומיים ל-7 ימים אחרונים */
  private buildLast7DaysTokens(
    last7: DailyStats[],
  ): Array<{ date: string; tokens: number }> {
    const result: Array<{ date: string; tokens: number }> = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const daily = last7.find((dd) => dd.date === dateStr);
      result.push({
        date: dateStr,
        tokens: daily?.tokensUsed ?? 0,
      });
    }
    return result;
  }

  /** שמירה ב-globalState */
  private async save(): Promise<void> {
    await this.context.globalState.update(ANALYTICS_KEY, this.data);
  }
}
