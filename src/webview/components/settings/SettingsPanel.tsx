// ===================================================
// SettingsPanel — דף הגדרות
// ===================================================
// מאפשר לשנות: מודל, שפה, מצב למידה, הרשאות, ועוד
// השינויים נשלחים ל-Extension ונשמרים ב-VS Code settings
// ===================================================

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../../state/AppContext';
import type { ModelId, UserSettings } from '../../../shared/types';
import { MODELS } from '../../../shared/constants';

export function SettingsPanel() {
  const { state, sendMessage } = useApp();
  const { t, i18n } = useTranslation();
  const settings = state.settings;
  const [apiKeyInput, setApiKeyInput] = useState('');

  // עדיין לא נטענו הגדרות
  if (!settings) {
    return (
      <div className="p-4 text-center" style={{ color: 'var(--vscode-descriptionForeground)' }}>
        {t('settings.loadingSettings')}
      </div>
    );
  }

  // פונקציה לעדכון הגדרה בודדת
  const update = (partial: Partial<UserSettings>) => {
    sendMessage({ type: 'updateSettings', payload: partial });
  };

  // עדכון שפה — גם i18n וגם settings
  const changeLanguage = (lang: 'he' | 'en') => {
    void i18n.changeLanguage(lang);
    update({ language: lang });
  };

  return (
    <div className="p-4 space-y-5 max-w-lg mx-auto view-enter">
      <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--vscode-foreground)' }}>
        {t('settings.title')}
      </h2>

      {/* --- מצב חיבור --- */}
      <Section title={t('settings.claudeConnection')}>
        <div
          className="text-xs px-3 py-2 rounded"
          style={{ background: 'var(--vscode-textBlockQuote-background)' }}
        >
          {settings.hasApiKey ? (
            <span>{t('settings.apiMode')}</span>
          ) : (
            <span>{t('settings.cliMode')}</span>
          )}
        </div>
        <label className="block mt-2">
          <span className="text-xs" style={{ color: 'var(--vscode-descriptionForeground)' }}>
            {t('settings.apiKeyLabel')}
          </span>
          <input
            type="password"
            className="w-full mt-1 px-3 py-1.5 rounded text-xs"
            style={{
              background: 'var(--vscode-input-background)',
              color: 'var(--vscode-input-foreground)',
              border: '1px solid var(--vscode-input-border)',
            }}
            value={apiKeyInput}
            placeholder={settings.hasApiKey ? '••••••••' : t('settings.apiKeyPlaceholder')}
            onChange={(e) => setApiKeyInput(e.target.value)}
            onBlur={() => {
              if (apiKeyInput) {
                sendMessage({ type: 'storeApiKey', payload: { apiKey: apiKeyInput } });
                setApiKeyInput('');
              }
            }}
          />
        </label>
      </Section>

      {/* --- מודל --- */}
      <Section title={t('settings.aiModel')}>
        <div className="space-y-2">
          {Object.values(MODELS).map((model) => (
            <label
              key={model.id}
              className="flex items-start gap-2 px-3 py-2 rounded cursor-pointer transition-all"
              style={{
                background: settings.model === model.id
                  ? 'var(--vscode-list-activeSelectionBackground)'
                  : 'transparent',
                border: `1px solid ${
                  settings.model === model.id
                    ? 'var(--vscode-focusBorder)'
                    : 'var(--vscode-panel-border)'
                }`,
              }}
            >
              <input
                type="radio"
                name="model"
                checked={settings.model === model.id}
                onChange={() => update({ model: model.id as ModelId })}
                className="mt-0.5"
              />
              <div>
                <div className="text-xs font-medium">{model.name}</div>
                <div className="text-[10px]" style={{ color: 'var(--vscode-descriptionForeground)' }}>
                  {model.description}
                </div>
              </div>
            </label>
          ))}
        </div>
      </Section>

      {/* --- שפה --- */}
      <Section title={t('settings.language')}>
        <div className="flex gap-2">
          <RadioButton
            selected={settings.language === 'he'}
            onClick={() => changeLanguage('he')}
            label={t('settings.hebrew')}
          />
          <RadioButton
            selected={settings.language === 'en'}
            onClick={() => changeLanguage('en')}
            label={t('settings.english')}
          />
        </div>
      </Section>

      {/* --- הרשאות כלים --- */}
      <Section title={t('settings.toolPermissions')}>
        <div className="space-y-1.5">
          <RadioButton
            selected={settings.permissionPreset === 'conservative'}
            onClick={() => update({ permissionPreset: 'conservative' })}
            label={`🔒 ${t('settings.permConservative')}`}
          />
          <RadioButton
            selected={settings.permissionPreset === 'normal'}
            onClick={() => update({ permissionPreset: 'normal' })}
            label={`⚖️ ${t('settings.permNormal')}`}
          />
          <RadioButton
            selected={settings.permissionPreset === 'full'}
            onClick={() => update({ permissionPreset: 'full' })}
            label={`🚀 ${t('settings.permFull')}`}
          />
        </div>
      </Section>

      {/* --- מצב למידה --- */}
      <Section title={t('settings.learningMode')}>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.learningMode}
            onChange={(e) => update({ learningMode: e.target.checked })}
          />
          <span className="text-xs">{t('settings.learningModeDesc')}</span>
        </label>
      </Section>

      {/* --- Max Tokens --- */}
      <Section title={t('settings.maxTokens')}>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={1024}
            max={200000}
            step={1024}
            value={settings.maxTokens}
            onChange={(e) => update({ maxTokens: Number(e.target.value) })}
            className="flex-1"
            aria-label={t('settings.maxTokensAria')}
            aria-valuemin={1024}
            aria-valuemax={200000}
            aria-valuenow={settings.maxTokens}
            aria-valuetext={t('settings.maxTokensValue', { count: settings.maxTokens })}
          />
          <span className="text-xs font-mono w-16 text-left">
            {settings.maxTokens.toLocaleString()}
          </span>
        </div>
      </Section>

      {/* --- גודל פונט --- */}
      <Section title={t('settings.fontSize')}>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={10}
            max={24}
            step={1}
            value={settings.fontSize}
            onChange={(e) => update({ fontSize: Number(e.target.value) })}
            className="flex-1"
            aria-label={t('settings.fontSizeAria')}
            aria-valuemin={10}
            aria-valuemax={24}
            aria-valuenow={settings.fontSize}
            aria-valuetext={t('settings.fontSizeValue', { size: settings.fontSize })}
          />
          <span className="text-xs font-mono w-8 text-left">{settings.fontSize}px</span>
        </div>
      </Section>

      {/* --- Quick Actions --- */}
      <Section title={t('settings.quickActions')}>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.quickActionsVisible}
            onChange={(e) => update({ quickActionsVisible: e.target.checked })}
          />
          <span className="text-xs">{t('settings.quickActionsDesc')}</span>
        </label>
      </Section>

      {/* --- סטטיסטיקות --- */}
      <Section title={t('settings.sessionStats')}>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <StatCard label={t('settings.statTokens')} value={state.totalTokens.toLocaleString()} />
          <StatCard label={t('settings.statCost')} value={`$${state.sessionCost.toFixed(4)}`} />
          <StatCard label={t('settings.statMessages')} value={state.messages.length.toString()} />
          <StatCard label={t('settings.statMode')} value={settings.hasApiKey ? 'API' : t('settings.statCliSubscription')} />
        </div>
      </Section>
    </div>
  );
}

// --- קומפוננטת עזר: סקשן ---
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const id = React.useId();
  const sectionId = `settings-section-${id}`;
  return (
    <div role="group" aria-labelledby={sectionId}>
      <h3
        id={sectionId}
        className="text-xs font-medium mb-2"
        style={{ color: 'var(--vscode-foreground)' }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

// --- קומפוננטת עזר: כפתור רדיו ---
function RadioButton({ selected, onClick, label }: { selected: boolean; onClick: () => void; label: string }) {
  return (
    <button
      className="px-3 py-1.5 rounded text-xs transition-all"
      style={{
        background: selected ? 'var(--vscode-button-background)' : 'var(--vscode-button-secondaryBackground)',
        color: selected ? 'var(--vscode-button-foreground)' : 'var(--vscode-button-secondaryForeground)',
        border: selected ? '1px solid var(--vscode-focusBorder)' : '1px solid transparent',
      }}
      onClick={onClick}
      role="radio"
      aria-checked={selected}
    >
      {label}
    </button>
  );
}

// --- קומפוננטת עזר: כרטיס סטטיסטיקה ---
function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="px-3 py-2 rounded text-center"
      style={{ background: 'var(--vscode-textBlockQuote-background)' }}
    >
      <div className="text-[10px]" style={{ color: 'var(--vscode-descriptionForeground)' }}>
        {label}
      </div>
      <div className="font-medium mt-0.5">{value}</div>
    </div>
  );
}
