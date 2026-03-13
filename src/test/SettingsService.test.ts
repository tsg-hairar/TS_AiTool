// ===================================================
// SettingsService — Unit Tests
// ===================================================
// Tests for settings retrieval, defaults, updates,
// SecretStorage API key management, and convenience
// accessor methods.
// ===================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { SettingsService } from '../extension/services/SettingsService';
import { workspace, createMockExtensionContext, mockSecrets } from './__mocks__/vscode';
import type { ExtensionContext } from 'vscode';

// =================================================
// Tests
// =================================================

describe('SettingsService', () => {
  let service: SettingsService;

  beforeEach(() => {
    // Clear all configuration and secrets between tests
    workspace._clearConfig();
    mockSecrets._clear();
    const context = createMockExtensionContext() as unknown as ExtensionContext;
    service = new SettingsService(context);
  });

  // -------------------------------------------------
  // getSettings — default values
  // -------------------------------------------------
  describe('getSettings — defaults', () => {
    it('should return default settings when nothing is configured', () => {
      const settings = service.getSettings();

      expect(settings.hasApiKey).toBe(false);
      expect(settings.model).toBe('claude-sonnet-4-20250514');
      expect(settings.language).toBe('he');
      expect(settings.theme).toBe('auto');
      expect(settings.fontSize).toBe(14);
      expect(settings.maxTokens).toBe(4096);
      expect(settings.learningMode).toBe(false);
      expect(settings.permissionPreset).toBe('normal');
      expect(settings.quickActionsVisible).toBe(true);
      expect(settings.autoContext).toBe(true);
      expect(settings.voiceLanguage).toBe('he-IL');
    });

    it('should return correct types for all fields', () => {
      const settings = service.getSettings();

      expect(typeof settings.hasApiKey).toBe('boolean');
      expect(typeof settings.model).toBe('string');
      expect(typeof settings.language).toBe('string');
      expect(typeof settings.theme).toBe('string');
      expect(typeof settings.fontSize).toBe('number');
      expect(typeof settings.maxTokens).toBe('number');
      expect(typeof settings.learningMode).toBe('boolean');
      expect(typeof settings.permissionPreset).toBe('string');
      expect(typeof settings.quickActionsVisible).toBe('boolean');
      expect(typeof settings.autoContext).toBe('boolean');
      expect(typeof settings.voiceLanguage).toBe('string');
    });
  });

  // -------------------------------------------------
  // getSettings — configured values
  // -------------------------------------------------
  describe('getSettings — configured values', () => {
    it('should return configured model', () => {
      workspace._setConfig('tsAiTool.model', 'claude-opus-4-20250514');
      const settings = service.getSettings();
      expect(settings.model).toBe('claude-opus-4-20250514');
    });

    it('should return configured language', () => {
      workspace._setConfig('tsAiTool.language', 'en');
      const settings = service.getSettings();
      expect(settings.language).toBe('en');
    });

    it('should return configured theme', () => {
      workspace._setConfig('tsAiTool.theme', 'dark');
      const settings = service.getSettings();
      expect(settings.theme).toBe('dark');
    });

    it('should return configured fontSize', () => {
      workspace._setConfig('tsAiTool.fontSize', 18);
      const settings = service.getSettings();
      expect(settings.fontSize).toBe(18);
    });

    it('should return configured maxTokens', () => {
      workspace._setConfig('tsAiTool.maxTokens', 8192);
      const settings = service.getSettings();
      expect(settings.maxTokens).toBe(8192);
    });

    it('should return configured learningMode', () => {
      workspace._setConfig('tsAiTool.learningMode', true);
      const settings = service.getSettings();
      expect(settings.learningMode).toBe(true);
    });

    it('should return configured permissionPreset', () => {
      workspace._setConfig('tsAiTool.permissionPreset', 'full');
      const settings = service.getSettings();
      expect(settings.permissionPreset).toBe('full');
    });
  });

  // -------------------------------------------------
  // updateSetting
  // -------------------------------------------------
  describe('updateSetting', () => {
    it('should persist a single setting', async () => {
      await service.updateSetting('fontSize', 20);
      const settings = service.getSettings();
      expect(settings.fontSize).toBe(20);
    });

    it('should persist language setting', async () => {
      await service.updateSetting('language', 'en');
      const settings = service.getSettings();
      expect(settings.language).toBe('en');
    });

    it('should persist model setting', async () => {
      await service.updateSetting('model', 'claude-haiku-4-5-20251001');
      const settings = service.getSettings();
      expect(settings.model).toBe('claude-haiku-4-5-20251001');
    });

    it('should persist boolean settings', async () => {
      await service.updateSetting('learningMode', true);
      expect(service.getSettings().learningMode).toBe(true);

      await service.updateSetting('learningMode', false);
      expect(service.getSettings().learningMode).toBe(false);
    });

    it('should ignore attempts to set hasApiKey via updateSetting', async () => {
      await service.updateSetting('hasApiKey', true);
      const settings = service.getSettings();
      expect(settings.hasApiKey).toBe(false);
    });
  });

  // -------------------------------------------------
  // updateSettings — batch update
  // -------------------------------------------------
  describe('updateSettings', () => {
    it('should update multiple settings at once', async () => {
      await service.updateSettings({
        language: 'en',
        fontSize: 16,
        theme: 'dark',
        learningMode: true,
      });

      const settings = service.getSettings();
      expect(settings.language).toBe('en');
      expect(settings.fontSize).toBe(16);
      expect(settings.theme).toBe('dark');
      expect(settings.learningMode).toBe(true);
    });

    it('should not affect unspecified settings', async () => {
      await service.updateSettings({ fontSize: 20 });

      const settings = service.getSettings();
      // fontSize changed
      expect(settings.fontSize).toBe(20);
      // Everything else remains default
      expect(settings.language).toBe('he');
      expect(settings.model).toBe('claude-sonnet-4-20250514');
    });
  });

  // -------------------------------------------------
  // API Key — SecretStorage
  // -------------------------------------------------
  describe('API Key (SecretStorage)', () => {
    it('should return empty string by default', async () => {
      expect(await service.getApiKey()).toBe('');
    });

    it('should store and retrieve API key via SecretStorage', async () => {
      await service.storeApiKey('sk-ant-test-key');
      expect(await service.getApiKey()).toBe('sk-ant-test-key');
    });

    it('should clear API key', async () => {
      await service.storeApiKey('sk-ant-test-key');
      await service.clearApiKey();
      expect(await service.getApiKey()).toBe('');
    });

    it('should delete key when storing empty string', async () => {
      await service.storeApiKey('sk-ant-test-key');
      await service.storeApiKey('');
      expect(await service.getApiKey()).toBe('');
    });

    it('getSettingsAsync should return hasApiKey: true when key is stored', async () => {
      await service.storeApiKey('sk-ant-valid-key');
      const settings = await service.getSettingsAsync();
      expect(settings.hasApiKey).toBe(true);
    });

    it('getSettingsAsync should return hasApiKey: false when no key', async () => {
      const settings = await service.getSettingsAsync();
      expect(settings.hasApiKey).toBe(false);
    });

    it('getSettingsAsync should return hasApiKey: false for invalid key format', async () => {
      await service.storeApiKey('not-a-valid-key');
      const settings = await service.getSettingsAsync();
      expect(settings.hasApiKey).toBe(false);
    });
  });

  // -------------------------------------------------
  // migrateApiKeyFromSettings
  // -------------------------------------------------
  describe('migrateApiKeyFromSettings', () => {
    it('should migrate plaintext key to SecretStorage', async () => {
      workspace._setConfig('tsAiTool.apiKey', 'sk-ant-legacy-key');
      await service.migrateApiKeyFromSettings();

      // Key should now be in SecretStorage
      expect(await service.getApiKey()).toBe('sk-ant-legacy-key');
    });

    it('should do nothing when no plaintext key exists', async () => {
      await service.migrateApiKeyFromSettings();
      expect(await service.getApiKey()).toBe('');
    });
  });

  // -------------------------------------------------
  // Convenience methods
  // -------------------------------------------------
  describe('getModel', () => {
    it('should return default model', () => {
      expect(service.getModel()).toBe('claude-sonnet-4-20250514');
    });

    it('should return configured model', () => {
      workspace._setConfig('tsAiTool.model', 'claude-opus-4-20250514');
      expect(service.getModel()).toBe('claude-opus-4-20250514');
    });
  });

  describe('getLanguage', () => {
    it('should return Hebrew by default', () => {
      expect(service.getLanguage()).toBe('he');
    });

    it('should return configured language', () => {
      workspace._setConfig('tsAiTool.language', 'en');
      expect(service.getLanguage()).toBe('en');
    });
  });

  describe('isLearningMode', () => {
    it('should return false by default', () => {
      expect(service.isLearningMode()).toBe(false);
    });

    it('should return true when enabled', () => {
      workspace._setConfig('tsAiTool.learningMode', true);
      expect(service.isLearningMode()).toBe(true);
    });
  });

  // -------------------------------------------------
  // Edge cases
  // -------------------------------------------------
  describe('edge cases', () => {
    it('should handle getSettings being called multiple times', () => {
      const s1 = service.getSettings();
      const s2 = service.getSettings();
      expect(s1).toEqual(s2);
    });

    it('should reflect changes immediately after updateSetting', async () => {
      expect(service.getSettings().fontSize).toBe(14);
      await service.updateSetting('fontSize', 22);
      expect(service.getSettings().fontSize).toBe(22);
    });
  });
});
