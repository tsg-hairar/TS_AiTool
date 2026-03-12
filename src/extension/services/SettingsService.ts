// ===================================================
// SettingsService — ניהול הגדרות
// ===================================================
// קורא וכותב הגדרות מ-VS Code configuration
// ===================================================

import * as vscode from 'vscode';
import type { UserSettings, ModelId } from '../../shared/types';

export class SettingsService {
  // -------------------------------------------------
  // getSettings — קבלת כל ההגדרות
  // -------------------------------------------------
  public getSettings(): UserSettings {
    const config = vscode.workspace.getConfiguration('tsAiTool');

    return {
      apiKey: config.get<string>('apiKey', ''),
      model: config.get<ModelId>('model', 'claude-sonnet-4-20250514'),
      language: config.get<'he' | 'en'>('language', 'he'),
      theme: config.get<'auto' | 'dark' | 'light'>('theme', 'auto'),
      fontSize: config.get<number>('fontSize', 14),
      maxTokens: config.get<number>('maxTokens', 4096),
      learningMode: config.get<boolean>('learningMode', false),
      permissionPreset: config.get<'conservative' | 'normal' | 'full'>('permissionPreset', 'normal'),
      quickActionsVisible: config.get<boolean>('quickActionsVisible', true),
      autoContext: config.get<boolean>('autoContext', true),
      voiceLanguage: config.get<string>('voiceLanguage', 'he-IL'),
    };
  }

  // -------------------------------------------------
  // updateSetting — עדכון הגדרה ספציפית
  // -------------------------------------------------
  public async updateSetting<K extends keyof UserSettings>(
    key: K,
    value: UserSettings[K],
  ): Promise<void> {
    const config = vscode.workspace.getConfiguration('tsAiTool');
    await config.update(key, value, vscode.ConfigurationTarget.Global);
  }

  // -------------------------------------------------
  // updateSettings — עדכון כמה הגדרות בבת אחת
  // -------------------------------------------------
  public async updateSettings(updates: Partial<UserSettings>): Promise<void> {
    for (const [key, value] of Object.entries(updates)) {
      await this.updateSetting(
        key as keyof UserSettings,
        value as UserSettings[keyof UserSettings],
      );
    }
  }

  // -------------------------------------------------
  // getApiKey — קבלת API key
  // -------------------------------------------------
  public getApiKey(): string {
    return this.getSettings().apiKey;
  }

  // -------------------------------------------------
  // getModel — קבלת מודל נוכחי
  // -------------------------------------------------
  public getModel(): ModelId {
    return this.getSettings().model;
  }

  // -------------------------------------------------
  // getLanguage — קבלת שפה
  // -------------------------------------------------
  public getLanguage(): 'he' | 'en' {
    return this.getSettings().language;
  }

  // -------------------------------------------------
  // isLearningMode — האם במצב למידה
  // -------------------------------------------------
  public isLearningMode(): boolean {
    return this.getSettings().learningMode;
  }
}
