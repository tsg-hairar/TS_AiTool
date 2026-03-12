// ===================================================
// SettingsPanel — דף הגדרות
// ===================================================
// מאפשר לשנות: מודל, שפה, מצב למידה, הרשאות, ועוד
// השינויים נשלחים ל-Extension ונשמרים ב-VS Code settings
// ===================================================

import React from 'react';
import { useApp } from '../../state/AppContext';
import type { ModelId, UserSettings } from '../../../shared/types';
import { MODELS } from '../../../shared/constants';

export function SettingsPanel() {
  const { state, sendMessage } = useApp();
  const settings = state.settings;

  // עדיין לא נטענו הגדרות
  if (!settings) {
    return (
      <div className="p-4 text-center" style={{ color: 'var(--vscode-descriptionForeground)' }}>
        טוען הגדרות...
      </div>
    );
  }

  // פונקציה לעדכון הגדרה בודדת
  const update = (partial: Partial<UserSettings>) => {
    sendMessage({ type: 'updateSettings', payload: partial });
  };

  return (
    <div className="p-4 space-y-5 max-w-lg mx-auto">
      <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--vscode-foreground)' }}>
        ⚙️ הגדרות
      </h2>

      {/* --- מצב חיבור --- */}
      <Section title="חיבור ל-Claude">
        <div
          className="text-xs px-3 py-2 rounded"
          style={{ background: 'var(--vscode-textBlockQuote-background)' }}
        >
          {settings.apiKey ? (
            <span>🔑 מצב API — משלם לפי טוקנים</span>
          ) : (
            <span>💳 מצב CLI — דרך המנוי שלך (ללא עלות נוספת!)</span>
          )}
        </div>
        <label className="block mt-2">
          <span className="text-xs" style={{ color: 'var(--vscode-descriptionForeground)' }}>
            API Key (השאר ריק למצב CLI/מנוי)
          </span>
          <input
            type="password"
            className="w-full mt-1 px-3 py-1.5 rounded text-xs"
            style={{
              background: 'var(--vscode-input-background)',
              color: 'var(--vscode-input-foreground)',
              border: '1px solid var(--vscode-input-border)',
            }}
            value={settings.apiKey}
            placeholder="sk-ant-..."
            onChange={(e) => update({ apiKey: e.target.value })}
          />
        </label>
      </Section>

      {/* --- מודל --- */}
      <Section title="מודל AI">
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
      <Section title="שפה">
        <div className="flex gap-2">
          <RadioButton
            selected={settings.language === 'he'}
            onClick={() => update({ language: 'he' })}
            label="🇮🇱 עברית"
          />
          <RadioButton
            selected={settings.language === 'en'}
            onClick={() => update({ language: 'en' })}
            label="🇺🇸 English"
          />
        </div>
      </Section>

      {/* --- הרשאות כלים --- */}
      <Section title="הרשאות כלים">
        <div className="space-y-1.5">
          <RadioButton
            selected={settings.permissionPreset === 'conservative'}
            onClick={() => update({ permissionPreset: 'conservative' })}
            label="🔒 שמרני — אישור על כל פעולה"
          />
          <RadioButton
            selected={settings.permissionPreset === 'normal'}
            onClick={() => update({ permissionPreset: 'normal' })}
            label="⚖️ רגיל — קריאה אוטומטית, כתיבה דורשת אישור"
          />
          <RadioButton
            selected={settings.permissionPreset === 'full'}
            onClick={() => update({ permissionPreset: 'full' })}
            label="🚀 מלא — הכל אוטומטי (מתקדם)"
          />
        </div>
      </Section>

      {/* --- מצב למידה --- */}
      <Section title="מצב למידה">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.learningMode}
            onChange={(e) => update({ learningMode: e.target.checked })}
          />
          <span className="text-xs">הוסף הערות מפורטות בעברית לכל קוד</span>
        </label>
      </Section>

      {/* --- Max Tokens --- */}
      <Section title="מקסימום טוקנים">
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={1024}
            max={200000}
            step={1024}
            value={settings.maxTokens}
            onChange={(e) => update({ maxTokens: Number(e.target.value) })}
            className="flex-1"
          />
          <span className="text-xs font-mono w-16 text-left">
            {settings.maxTokens.toLocaleString()}
          </span>
        </div>
      </Section>

      {/* --- גודל פונט --- */}
      <Section title="גודל פונט">
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={10}
            max={24}
            step={1}
            value={settings.fontSize}
            onChange={(e) => update({ fontSize: Number(e.target.value) })}
            className="flex-1"
          />
          <span className="text-xs font-mono w-8 text-left">{settings.fontSize}px</span>
        </div>
      </Section>

      {/* --- Quick Actions --- */}
      <Section title="פעולות מהירות">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.quickActionsVisible}
            onChange={(e) => update({ quickActionsVisible: e.target.checked })}
          />
          <span className="text-xs">הצג פעולות מהירות בצ'אט</span>
        </label>
      </Section>

      {/* --- סטטיסטיקות --- */}
      <Section title="סטטיסטיקות סשן">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <StatCard label="טוקנים" value={state.totalTokens.toLocaleString()} />
          <StatCard label="עלות" value={`$${state.sessionCost.toFixed(4)}`} />
          <StatCard label="הודעות" value={state.messages.length.toString()} />
          <StatCard label="מצב" value={settings.apiKey ? 'API' : 'CLI (מנוי)'} />
        </div>
      </Section>
    </div>
  );
}

// --- קומפוננטת עזר: סקשן ---
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3
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
