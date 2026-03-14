// ===================================================
// Toolbar — סרגל כלים עליון
// ===================================================

import React, { useState, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../../state/AppContext';
import { ConfirmDialog } from './ConfirmDialog';

// Lazy loading — טעינה עצלה של קומפוננטות כבדות
const KeyboardShortcutsModal = lazy(() =>
  import('./KeyboardShortcutsModal').then(m => ({ default: m.KeyboardShortcutsModal })),
);
const ExportMenu = lazy(() =>
  import('../chat/ExportMenu').then(m => ({ default: m.ExportMenu })),
);

export function Toolbar() {
  const { state, dispatch, sendMessage } = useApp();
  const { t } = useTranslation();
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  return (
    <div
      role="toolbar"
      aria-label={t('toolbar.ariaLabel')}
      className="flex items-center justify-between ps-3 pe-3 py-2 border-b transition-smooth"
      style={{
        borderColor: 'var(--vscode-panel-border)',
        background: 'rgba(30, 30, 30, 0.65)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      {/* צד ימין — שם + ניווט */}
      <div className="flex items-center gap-2">
        {/* כפתור חזרה לפרויקטים */}
        {state.currentView !== 'projects' && (
          <button
            className="btn-ghost text-xs transition-all duration-200 hover:scale-110 active:scale-95"
            onClick={() => dispatch({ type: 'SET_VIEW', payload: 'projects' })}
            title={t('toolbar.backToProjects')}
            aria-label={t('toolbar.backToProjects')}
          >
            📁
          </button>
        )}

        {/* שם הפרויקט הפעיל */}
        <span className="text-sm font-medium">
          {state.activeProject
            ? `${state.activeProject.icon} ${state.activeProject.name}`
            : 'TS AiTool'}
        </span>

        {/* סוכן פעיל */}
        {state.activeProject && state.currentView === 'chat' && (
          <span
            className="text-xs ps-2 pe-2 py-0.5 rounded-full animate-fade-in transition-smooth"
            style={{
              background: 'rgba(255,255,255,0.08)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            {state.agents.find((a) => a.id === state.activeAgentId)?.icon}{' '}
            {state.agents.find((a) => a.id === state.activeAgentId)?.name}
          </span>
        )}
      </div>

      {/* צד שמאל — כפתורים */}
      <div className="flex items-center gap-1">
        {/* אינדיקטור שמירה אוטומטית */}
        {state.showSaveIndicator && (
          <span
            className="text-[10px] opacity-50 me-1 animate-fade-in ps-2 pe-2 py-0.5 rounded-full"
            style={{
              background: 'rgba(255,255,255,0.04)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              border: '1px solid rgba(255,255,255,0.04)',
            }}
            title={state.lastAutoSave ? `${t('toolbar.saved', 'נשמר')}: ${new Date(state.lastAutoSave).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}` : ''}
            aria-label={t('toolbar.autoSaved', 'נשמר אוטומטית')}
          >
            {t('toolbar.saved', 'נשמר')}
          </span>
        )}

        {/* הודעת שחזור מושב */}
        {state.sessionRestored && (
          <span
            className="text-[10px] ps-2 pe-2 py-0.5 rounded-full animate-fade-in"
            style={{ background: 'rgba(34, 197, 94, 0.2)', color: 'rgb(134, 239, 172)' }}
            aria-label={t('toolbar.sessionRestored', 'שיחה שוחזרה')}
          >
            {t('toolbar.sessionRestored', 'שיחה שוחזרה')}
          </span>
        )}

        {/* עלות */}
        {state.sessionCost > 0 && (
          <span className="text-xs opacity-60 me-2">
            ${state.sessionCost.toFixed(4)}
          </span>
        )}

        {/* separator */}
        <span className="toolbar-separator" aria-hidden="true" />

        {/* חיפוש */}
        {state.currentView === 'chat' && (
          <button
            className="btn-ghost text-xs transition-all duration-200 hover:scale-110 active:scale-95"
            onClick={() => dispatch({ type: 'SET_SEARCH_OPEN', payload: !state.searchOpen })}
            title={`${t('toolbar.search') || 'חיפוש'} (Ctrl+F)`}
            aria-label={`${t('toolbar.search') || 'חיפוש'}`}
          >
            🔍
          </button>
        )}

        {/* צ'אט חדש */}
        {state.currentView === 'chat' && (
          <button
            className="btn-ghost text-xs toolbar-new-chat-btn transition-all duration-200 hover:scale-110 active:scale-95"
            onClick={() => sendMessage({ type: 'newChat' })}
            title={t('toolbar.newChat')}
            aria-label={t('toolbar.newChat')}
          >
            ➕
          </button>
        )}

        {/* separator */}
        <span className="toolbar-separator" aria-hidden="true" />

        {/* ניקוי שיחה */}
        {state.currentView === 'chat' && state.messages.length > 0 && (
          <button
            className="btn-ghost text-xs transition-all duration-200 hover:scale-110 active:scale-95"
            onClick={() => setShowClearConfirm(true)}
            title={t('toolbar.clearChat')}
            aria-label={t('toolbar.clearChat')}
          >
            🧹
          </button>
        )}

        {/* ייצוא שיחה */}
        {state.currentView === 'chat' && state.messages.length > 0 && (
          <div className="relative">
            <button
              className="btn-ghost text-xs transition-all duration-200 hover:scale-110 active:scale-95"
              onClick={() => setShowExportMenu(!showExportMenu)}
              title={t('toolbar.exportChat') || 'ייצוא שיחה'}
              aria-label={t('toolbar.exportChat') || 'ייצוא שיחה'}
              aria-haspopup="menu"
              aria-expanded={showExportMenu}
            >
              📤
            </button>
            <Suspense fallback={null}>
              <ExportMenu
                isOpen={showExportMenu}
                onClose={() => setShowExportMenu(false)}
              />
            </Suspense>
          </div>
        )}

        {/* separator */}
        <span className="toolbar-separator" aria-hidden="true" />

        {/* קיצורי מקלדת */}
        <button
          className="btn-ghost text-xs transition-all duration-200 hover:scale-110 active:scale-95"
          onClick={() => setShowShortcuts(true)}
          title={t('toolbar.keyboardShortcuts')}
          aria-label={t('toolbar.keyboardShortcuts')}
        >
          ⌨️
        </button>

        {/* הגדרות */}
        <button
          className="btn-ghost text-xs transition-all duration-200 hover:scale-110 active:scale-95"
          onClick={() => dispatch({ type: 'SET_VIEW', payload: 'settings' })}
          title={t('toolbar.settings')}
          aria-label={t('toolbar.settings')}
        >
          ⚙️
        </button>
      </div>

      {/* מודאל קיצורי מקלדת — lazy loaded */}
      {showShortcuts && (
        <Suspense fallback={null}>
          <KeyboardShortcutsModal
            isOpen={showShortcuts}
            onClose={() => setShowShortcuts(false)}
          />
        </Suspense>
      )}

      {/* דיאלוג אישור ניקוי שיחה */}
      <ConfirmDialog
        isOpen={showClearConfirm}
        title={t('toolbar.clearChatConfirmTitle')}
        message={t('toolbar.clearChatConfirmMessage')}
        confirmLabel={t('toolbar.clearChatConfirmLabel')}
        cancelLabel={t('toolbar.cancel')}
        variant="warning"
        onConfirm={() => {
          setShowClearConfirm(false);
          sendMessage({ type: 'clearChat' });
        }}
        onCancel={() => setShowClearConfirm(false)}
      />
    </div>
  );
}
