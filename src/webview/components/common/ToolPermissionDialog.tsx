// ===================================================
// ToolPermissionDialog — דיאלוג אישור שימוש בכלים
// ===================================================
// כש-Claude רוצה להשתמש בכלי שדורש אישור,
// מוצג דיאלוג עם פרטי הכלי וכפתורי אישור/דחייה
// ===================================================

import React from 'react';
import { useApp } from '../../state/AppContext';

// מיפוי שמות כלים לאייקון ותיאור בעברית
const TOOL_INFO: Record<string, { icon: string; label: string; danger: boolean }> = {
  read_file: { icon: '📖', label: 'קריאת קובץ', danger: false },
  write_file: { icon: '✏️', label: 'כתיבת קובץ', danger: true },
  edit_file: { icon: '📝', label: 'עריכת קובץ', danger: true },
  search_files: { icon: '🔍', label: 'חיפוש קבצים', danger: false },
  search_content: { icon: '🔎', label: 'חיפוש תוכן', danger: false },
  run_command: { icon: '⚡', label: 'הרצת פקודה', danger: true },
  list_files: { icon: '📁', label: 'רשימת קבצים', danger: false },
  web_search: { icon: '🌐', label: 'חיפוש באינטרנט', danger: false },
  web_fetch: { icon: '🌍', label: 'קריאת דף אינטרנט', danger: false },
};

export function ToolPermissionDialog() {
  const { state, sendMessage } = useApp();

  // אם אין בקשות ממתינות — לא מציגים כלום
  if (state.pendingToolPermissions.length === 0) return null;

  // מציגים את הבקשה הראשונה בתור
  const permission = state.pendingToolPermissions[0];
  const info = TOOL_INFO[permission.toolName] ?? { icon: '🔧', label: permission.toolName, danger: false };

  // הכנת תיאור הפרמטרים
  const inputEntries = Object.entries(permission.input);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        className="w-80 max-w-[90vw] rounded-lg shadow-xl p-4"
        style={{ background: 'var(--vscode-editor-background)', border: '1px solid var(--vscode-panel-border)' }}
      >
        {/* כותרת */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">{info.icon}</span>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--vscode-foreground)' }}>
            בקשת אישור — {info.label}
          </h3>
        </div>

        {/* אזהרה לכלים מסוכנים */}
        {info.danger && (
          <div
            className="text-xs px-2 py-1.5 rounded mb-3"
            style={{ background: 'var(--vscode-inputValidation-warningBackground)', color: 'var(--vscode-inputValidation-warningForeground)' }}
          >
            ⚠️ כלי זה יכול לשנות קבצים או להריץ פקודות
          </div>
        )}

        {/* פרטי הכלי */}
        <div
          className="text-xs rounded p-2 mb-3 overflow-auto max-h-32"
          style={{ background: 'var(--vscode-textBlockQuote-background)', fontFamily: 'monospace' }}
        >
          {inputEntries.map(([key, value]) => (
            <div key={key} className="mb-1">
              <span style={{ color: 'var(--vscode-symbolIcon-propertyForeground)' }}>{key}:</span>{' '}
              <span style={{ color: 'var(--vscode-foreground)' }}>
                {typeof value === 'string'
                  ? value.length > 100 ? value.slice(0, 100) + '...' : value
                  : JSON.stringify(value)}
              </span>
            </div>
          ))}
          {inputEntries.length === 0 && (
            <span style={{ color: 'var(--vscode-descriptionForeground)' }}>(ללא פרמטרים)</span>
          )}
        </div>

        {/* כפתורי פעולה */}
        <div className="flex gap-2 justify-end">
          <button
            className="px-3 py-1.5 text-xs rounded"
            style={{
              background: 'var(--vscode-button-secondaryBackground)',
              color: 'var(--vscode-button-secondaryForeground)',
            }}
            onClick={() => {
              sendMessage({ type: 'denyToolUse', payload: { toolUseId: permission.toolUseId } });
            }}
          >
            ❌ דחייה
          </button>
          <button
            className="px-3 py-1.5 text-xs rounded font-medium"
            style={{
              background: 'var(--vscode-button-background)',
              color: 'var(--vscode-button-foreground)',
            }}
            onClick={() => {
              sendMessage({ type: 'approveToolUse', payload: { toolUseId: permission.toolUseId } });
            }}
          >
            ✅ אישור
          </button>
        </div>
      </div>
    </div>
  );
}
