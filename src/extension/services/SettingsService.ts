// ===================================================
// SettingsService — ניהול הגדרות
// ===================================================
// קורא וכותב הגדרות מ-VS Code configuration
// API key נשמר ב-SecretStorage (לא ב-plaintext settings)
// ===================================================

import * as vscode from 'vscode';
import type { UserSettings, ModelId } from '../../shared/types';

const API_KEY_SECRET = 'tsAiTool.apiKey';

export class SettingsService {
  private secretStorage: vscode.SecretStorage;

  constructor(context: vscode.ExtensionContext) {
    this.secretStorage = context.secrets;
  }

  // -------------------------------------------------
  // getSettings — קבלת כל ההגדרות (ללא API key בפלט)
  // -------------------------------------------------
  // Note: hasApiKey is populated asynchronously via getSettingsAsync().
  // This synchronous version returns hasApiKey: false as a placeholder.
  // Use getSettingsAsync() when you need an accurate hasApiKey value.
  // -------------------------------------------------
  public getSettings(): UserSettings {
    const config = vscode.workspace.getConfiguration('tsAiTool');

    return {
      hasApiKey: false, // synchronous — use getSettingsAsync() for accurate value
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
  // getSettingsAsync — קבלת כל ההגדרות כולל hasApiKey מדויק
  // -------------------------------------------------
  public async getSettingsAsync(): Promise<UserSettings> {
    const settings = this.getSettings();
    const apiKey = await this.getApiKey();
    settings.hasApiKey = !!apiKey && apiKey.startsWith('sk-');
    return settings;
  }

  // -------------------------------------------------
  // updateSetting — עדכון הגדרה ספציפית
  // -------------------------------------------------
  public async updateSetting<K extends keyof UserSettings>(
    key: K,
    value: UserSettings[K],
  ): Promise<void> {
    // hasApiKey is read-only — use storeApiKey/clearApiKey instead
    if (key === 'hasApiKey') return;
    const config = vscode.workspace.getConfiguration('tsAiTool');
    await config.update(key as string, value, vscode.ConfigurationTarget.Global);
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
  // getApiKey — קבלת API key מ-SecretStorage
  // -------------------------------------------------
  public async getApiKey(): Promise<string> {
    return (await this.secretStorage.get(API_KEY_SECRET)) || '';
  }

  // -------------------------------------------------
  // storeApiKey — שמירת API key ב-SecretStorage
  // -------------------------------------------------
  public async storeApiKey(apiKey: string): Promise<void> {
    if (apiKey) {
      await this.secretStorage.store(API_KEY_SECRET, apiKey);
    } else {
      await this.secretStorage.delete(API_KEY_SECRET);
    }
    // Migrate: clear any plaintext key left in settings
    const config = vscode.workspace.getConfiguration('tsAiTool');
    const legacyKey = config.get<string>('apiKey', '');
    if (legacyKey) {
      await config.update('apiKey', undefined, vscode.ConfigurationTarget.Global);
    }
  }

  // -------------------------------------------------
  // clearApiKey — מחיקת API key מ-SecretStorage
  // -------------------------------------------------
  public async clearApiKey(): Promise<void> {
    await this.secretStorage.delete(API_KEY_SECRET);
  }

  // -------------------------------------------------
  // migrateApiKeyFromSettings — העברת מפתח ישן מ-settings
  // -------------------------------------------------
  // Call once at activation to migrate any plaintext key
  // -------------------------------------------------
  public async migrateApiKeyFromSettings(): Promise<void> {
    const config = vscode.workspace.getConfiguration('tsAiTool');
    const legacyKey = config.get<string>('apiKey', '');
    if (legacyKey) {
      // Store in SecretStorage
      await this.secretStorage.store(API_KEY_SECRET, legacyKey);
      // Remove from plaintext settings
      await config.update('apiKey', undefined, vscode.ConfigurationTarget.Global);
    }
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
