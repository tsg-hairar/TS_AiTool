// ===================================================
// TemplateService — ניהול תבניות פרומפט
// ===================================================
// CRUD operations לתבניות פרומפט עם שמירה ב-globalState
// תבניות מובנות נטענות מ-constants + תבניות מותאמות אישית
// ===================================================

import * as vscode from 'vscode';
import type { PromptTemplate, PromptTemplateCategory } from '../../shared/types';
import { BUILT_IN_PROMPT_TEMPLATES, LIMITS } from '../../shared/constants';
import { generateId } from '../../shared/utils/generateId';

// מפתח לשמירה ב-globalState
const CUSTOM_TEMPLATES_KEY = 'tsAiTool.promptTemplates';

export class TemplateService {
  constructor(private readonly context: vscode.ExtensionContext) {}

  // -------------------------------------------------
  // getAll — קבלת כל התבניות (מובנות + מותאמות)
  // -------------------------------------------------
  public getAll(): PromptTemplate[] {
    const custom = this.getCustomTemplates();
    return [...BUILT_IN_PROMPT_TEMPLATES, ...custom];
  }

  // -------------------------------------------------
  // getByCategory — תבניות לפי קטגוריה
  // -------------------------------------------------
  public getByCategory(category: PromptTemplateCategory): PromptTemplate[] {
    return this.getAll().filter((t) => t.category === category);
  }

  // -------------------------------------------------
  // getById — תבנית לפי מזהה
  // -------------------------------------------------
  public getById(id: string): PromptTemplate | undefined {
    return this.getAll().find((t) => t.id === id);
  }

  // -------------------------------------------------
  // create — יצירת תבנית חדשה
  // -------------------------------------------------
  public async create(data: {
    title: string;
    content: string;
    category: PromptTemplateCategory;
    icon: string;
    variables: string[];
  }): Promise<PromptTemplate> {
    const custom = this.getCustomTemplates();

    // בדיקת מגבלה
    if (custom.length + BUILT_IN_PROMPT_TEMPLATES.length >= LIMITS.MAX_TEMPLATES) {
      throw new Error('הגעת למגבלת התבניות המקסימלית');
    }

    const template: PromptTemplate = {
      id: `custom-${generateId()}`,
      title: data.title,
      content: data.content,
      category: data.category,
      icon: data.icon,
      variables: data.variables,
      isBuiltIn: false,
      createdAt: new Date().toISOString(),
    };

    custom.push(template);
    await this.saveCustomTemplates(custom);

    return template;
  }

  // -------------------------------------------------
  // update — עדכון תבנית מותאמת אישית
  // -------------------------------------------------
  public async update(
    id: string,
    updates: Partial<PromptTemplate>,
  ): Promise<PromptTemplate | undefined> {
    const custom = this.getCustomTemplates();
    const index = custom.findIndex((t) => t.id === id);

    if (index === -1) {
      // אי אפשר לעדכן תבניות מובנות
      return undefined;
    }

    // לא מאפשרים שינוי isBuiltIn או id
    const { id: _id, isBuiltIn: _isBuiltIn, ...safeUpdates } = updates;
    custom[index] = { ...custom[index], ...safeUpdates };

    await this.saveCustomTemplates(custom);
    return custom[index];
  }

  // -------------------------------------------------
  // delete — מחיקת תבנית מותאמת אישית
  // -------------------------------------------------
  public async delete(id: string): Promise<boolean> {
    const custom = this.getCustomTemplates();
    const filtered = custom.filter((t) => t.id !== id);

    if (filtered.length === custom.length) {
      // לא נמצא — אולי זו תבנית מובנית
      return false;
    }

    await this.saveCustomTemplates(filtered);
    return true;
  }

  // -------------------------------------------------
  // fillVariables — מילוי משתנים בתבנית
  // -------------------------------------------------
  public static fillVariables(
    template: PromptTemplate,
    vars: Record<string, string>,
  ): string {
    let content = template.content;
    for (const [key, value] of Object.entries(vars)) {
      content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
    return content;
  }

  // -------------------------------------------------
  // extractVariables — חילוץ שמות משתנים מתוכן
  // -------------------------------------------------
  public static extractVariables(content: string): string[] {
    const matches = content.match(/\{\{(\w+)\}\}/g);
    if (!matches) return [];
    const vars = matches.map((m) => m.replace(/\{\{|\}\}/g, ''));
    // הסרת כפילויות
    return [...new Set(vars)];
  }

  // -------------------------------------------------
  // getCustomTemplates — תבניות מותאמות מ-globalState
  // -------------------------------------------------
  private getCustomTemplates(): PromptTemplate[] {
    return this.context.globalState.get<PromptTemplate[]>(CUSTOM_TEMPLATES_KEY) ?? [];
  }

  // -------------------------------------------------
  // saveCustomTemplates — שמירה ב-globalState
  // -------------------------------------------------
  private async saveCustomTemplates(templates: PromptTemplate[]): Promise<void> {
    await this.context.globalState.update(CUSTOM_TEMPLATES_KEY, templates);
  }
}
