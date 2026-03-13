// ===================================================
// ToolPermissionDialog — דיאלוג אישור שימוש בכלים
// ===================================================
// כש-Claude רוצה להשתמש בכלי שדורש אישור,
// מוצג דיאלוג עם פרטי הכלי וכפתורי אישור/דחייה
// ===================================================

import React, { useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../../state/AppContext';

// מיפוי שמות כלים לאייקון ומידע סכנה
const TOOL_ICONS: Record<string, { icon: string; danger: boolean }> = {
  read_file: { icon: '📖', danger: false },
  write_file: { icon: '✏️', danger: true },
  edit_file: { icon: '📝', danger: true },
  search_files: { icon: '🔍', danger: false },
  search_content: { icon: '🔎', danger: false },
  run_command: { icon: '⚡', danger: true },
  list_files: { icon: '📁', danger: false },
  web_search: { icon: '🌐', danger: false },
  web_fetch: { icon: '🌍', danger: false },
};

export function ToolPermissionDialog() {
  const { state, sendMessage } = useApp();
  const { t } = useTranslation();

  // אם אין בקשות ממתינות — לא מציגים כלום
  if (state.pendingToolPermissions.length === 0) return null;

  // מציגים את הבקשה הראשונה בתור
  const permission = state.pendingToolPermissions[0];
  const toolMeta = TOOL_ICONS[permission.toolName] ?? { icon: '🔧', danger: false };
  const toolLabel = t(`toolPermission.tools.${permission.toolName}`, { defaultValue: permission.toolName });

  // הכנת תיאור הפרמטרים
  const inputEntries = Object.entries(permission.input);

  // --- Focus trap for dialog ---
  const dialogRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      sendMessage({ type: 'denyToolUse', payload: { toolUseId: permission.toolUseId } });
      return;
    }
    if (e.key !== 'Tab') return;

    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable || focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }, [permission.toolUseId, sendMessage]);

  useEffect(() => {
    // Focus the dialog when it opens
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable && focusable.length > 0) {
      focusable[focusable.length - 1].focus(); // Focus approve button
    }
  }, [permission.toolUseId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-backdrop-in" role="presentation">
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-label={t('toolPermission.requestTitle', { tool: toolLabel })}
        aria-describedby="tool-permission-desc"
        className="w-80 max-w-[90vw] rounded-lg shadow-xl p-4 animate-dialog-in"
        style={{ background: 'var(--vscode-editor-background)', border: '1px solid var(--vscode-panel-border)' }}
        onKeyDown={handleKeyDown}
      >
        {/* כותרת */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">{toolMeta.icon}</span>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--vscode-foreground)' }}>
            {t('toolPermission.requestTitle', { tool: toolLabel })}
          </h3>
        </div>

        {/* אזהרה לכלים מסוכנים */}
        {toolMeta.danger && (
          <div
            id="tool-permission-desc"
            role="alert"
            className="text-xs px-2 py-1.5 rounded mb-3"
            style={{ background: 'var(--vscode-inputValidation-warningBackground)', color: 'var(--vscode-inputValidation-warningForeground)' }}
          >
            {t('toolPermission.dangerWarning')}
          </div>
        )}
        {!toolMeta.danger && (
          <span id="tool-permission-desc" className="sr-only">
            {t('toolPermission.safeDescription', { tool: toolLabel })}
          </span>
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
            <span style={{ color: 'var(--vscode-descriptionForeground)' }}>{t('toolPermission.noParams')}</span>
          )}
        </div>

        {/* כפתורי פעולה */}
        <div className="flex gap-2 justify-end">
          <button
            className="px-3 py-1.5 text-xs rounded transition-smooth click-shrink"
            style={{
              background: 'var(--vscode-button-secondaryBackground)',
              color: 'var(--vscode-button-secondaryForeground)',
            }}
            onClick={() => {
              sendMessage({ type: 'denyToolUse', payload: { toolUseId: permission.toolUseId } });
            }}
            aria-label={t('toolPermission.denyAria', { tool: toolLabel })}
          >
            {t('toolPermission.deny')}
          </button>
          <button
            className="px-3 py-1.5 text-xs rounded font-medium transition-smooth click-shrink"
            style={{
              background: 'var(--vscode-button-background)',
              color: 'var(--vscode-button-foreground)',
            }}
            onClick={() => {
              sendMessage({ type: 'approveToolUse', payload: { toolUseId: permission.toolUseId } });
            }}
            aria-label={t('toolPermission.approveAria', { tool: toolLabel })}
          >
            {t('toolPermission.approve')}
          </button>
        </div>
      </div>
    </div>
  );
}
