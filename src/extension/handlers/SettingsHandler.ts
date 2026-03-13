// ===================================================
// SettingsHandler — טיפול בהגדרות
// ===================================================

import type { ExtensionToWebviewMessage } from '../../shared/messages';
import type { UserSettings, ModelId } from '../../shared/types';
import { SettingsService } from '../services/SettingsService';

export class SettingsHandler {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly postMessage: (msg: ExtensionToWebviewMessage) => void,
  ) {}

  public async getSettings(): Promise<void> {
    const settings = await this.settingsService.getSettingsAsync();
    this.postMessage({ type: 'settingsLoaded', payload: settings });
  }

  public async updateSettings(updates: Partial<UserSettings>): Promise<void> {
    await this.settingsService.updateSettings(updates);
    await this.getSettings(); // שליחת ההגדרות המעודכנות ל-UI
  }

  public async storeApiKey(apiKey: string): Promise<void> {
    await this.settingsService.storeApiKey(apiKey);
    await this.getSettings(); // refresh hasApiKey in UI
  }

  public async switchModel(model: ModelId): Promise<void> {
    await this.settingsService.updateSetting('model', model);
    this.postMessage({ type: 'modelSwitched', payload: { model } });
  }
}
