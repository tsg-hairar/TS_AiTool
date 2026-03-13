// ===================================================
// KeyboardShortcutsModal — חלון קיצורי מקלדת
// ===================================================
// מודאל המציג את כל קיצורי המקלדת הזמינים
// מאורגן לפי קטגוריות, עם חיפוש ותמיכה ב-RTL
// ===================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

// -------------------------------------------------
// Props
// -------------------------------------------------
interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// -------------------------------------------------
// מבנה קיצור מקלדת
// -------------------------------------------------
interface Shortcut {
  /** i18n key for the description */
  descriptionKey: string;
  keys: string[];
  macKeys?: string[];
}

interface ShortcutSection {
  /** i18n key for the section title */
  titleKey: string;
  icon: string;
  shortcuts: Shortcut[];
}

// -------------------------------------------------
// הגדרת כל הקיצורים לפי קטגוריות — using i18n keys
// -------------------------------------------------
const SHORTCUT_SECTIONS: ShortcutSection[] = [
  {
    titleKey: 'shortcuts.sections.chat',
    icon: '\uD83D\uDCAC',
    shortcuts: [
      { descriptionKey: 'shortcuts.actions.newChat', keys: ['Ctrl', 'Shift', 'N'], macKeys: ['Cmd', 'Shift', 'N'] },
      { descriptionKey: 'shortcuts.actions.sendMessage', keys: ['Enter'] },
      { descriptionKey: 'shortcuts.actions.newLine', keys: ['Shift', 'Enter'] },
      { descriptionKey: 'shortcuts.actions.clearChat', keys: ['Ctrl', 'L'] },
      { descriptionKey: 'shortcuts.actions.toggleQuickActions', keys: ['Ctrl', '/'] },
    ],
  },
  {
    titleKey: 'shortcuts.sections.navigation',
    icon: '\uD83E\uDDED',
    shortcuts: [
      { descriptionKey: 'shortcuts.actions.togglePanel', keys: ['Ctrl', 'Shift', 'H'], macKeys: ['Cmd', 'Shift', 'H'] },
      { descriptionKey: 'shortcuts.actions.fullScreen', keys: ['Ctrl', 'Shift', 'F1'], macKeys: ['Cmd', 'Shift', 'F1'] },
      { descriptionKey: 'shortcuts.actions.splitView', keys: ['Ctrl', 'Shift', '2'], macKeys: ['Cmd', 'Shift', '2'] },
    ],
  },
  {
    titleKey: 'shortcuts.sections.projects',
    icon: '\uD83D\uDCC1',
    shortcuts: [
      { descriptionKey: 'shortcuts.actions.runProject', keys: ['Ctrl', 'Shift', 'B'], macKeys: ['Cmd', 'Shift', 'B'] },
    ],
  },
  {
    titleKey: 'shortcuts.sections.agents',
    icon: '\uD83E\uDD16',
    shortcuts: [
      { descriptionKey: 'shortcuts.actions.switchAgent', keys: ['Ctrl', 'Shift', 'A'], macKeys: ['Cmd', 'Shift', 'A'] },
    ],
  },
  {
    titleKey: 'shortcuts.sections.extra',
    icon: '\u2795',
    shortcuts: [
      { descriptionKey: 'shortcuts.actions.voiceInput', keys: ['Ctrl', 'Shift', 'V'], macKeys: ['Cmd', 'Shift', 'V'] },
    ],
  },
];

// -------------------------------------------------
// Component
// -------------------------------------------------
export function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // -------------------------------------------------
  // סינון קיצורים לפי חיפוש
  // -------------------------------------------------
  const filteredSections = SHORTCUT_SECTIONS.map((section) => ({
    ...section,
    shortcuts: section.shortcuts.filter(
      (s) =>
        t(s.descriptionKey).toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.keys.join(' ').toLowerCase().includes(searchQuery.toLowerCase()),
    ),
  })).filter((section) => section.shortcuts.length > 0);

  // -------------------------------------------------
  // Keyboard handling + focus trap
  // -------------------------------------------------
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      // Focus trap — Tab cycles between search input and close button
      if (e.key === 'Tab') {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button, input, [tabindex]:not([tabindex="-1"])',
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
      }
    },
    [isOpen, onClose],
  );

  // Register keyboard listener
  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  // Auto-focus search input on open
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      const timer = setTimeout(() => searchInputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backdropFilter: 'blur(2px)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 animate-backdrop-in" />

      {/* Modal */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-modal-title"
        dir="auto"
        className="relative w-[420px] max-w-[92vw] max-h-[80vh] rounded-lg shadow-2xl flex flex-col animate-dialog-in"
        style={{
          background: 'var(--vscode-editor-background)',
          border: '1px solid var(--vscode-panel-border)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: 'var(--vscode-panel-border)' }}
        >
          <h2
            id="shortcuts-modal-title"
            className="text-sm font-semibold flex items-center gap-2"
            style={{ color: 'var(--vscode-foreground)' }}
          >
            <span>{'\u2328\uFE0F'}</span>
            {t('shortcuts.title')}
          </h2>
          <button
            ref={closeBtnRef}
            className="btn-ghost text-xs px-2 py-1 rounded"
            onClick={onClose}
            aria-label={t('shortcuts.close')}
            title={t('shortcuts.close')}
          >
            {'\u2715'}
          </button>
        </div>

        {/* Search */}
        <div
          className="px-5 py-3 border-b"
          style={{ borderColor: 'var(--vscode-panel-border)' }}
        >
          <input
            ref={searchInputRef}
            type="text"
            className="input-field"
            placeholder={t('shortcuts.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label={t('shortcuts.searchAria')}
          />
        </div>

        {/* Shortcuts list */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {filteredSections.length === 0 ? (
            <div
              className="text-center py-8 text-xs"
              style={{ color: 'var(--vscode-descriptionForeground)' }}
            >
              {t('shortcuts.noResults')}
            </div>
          ) : (
            filteredSections.map((section) => (
              <div key={section.titleKey} className="mb-4">
                {/* Section header */}
                <h3
                  className="text-xs font-semibold mb-2 flex items-center gap-1.5 opacity-70"
                  style={{ color: 'var(--vscode-foreground)' }}
                >
                  <span>{section.icon}</span>
                  {t(section.titleKey)}
                </h3>

                {/* Shortcut rows */}
                <div className="space-y-1">
                  {section.shortcuts.map((shortcut) => (
                    <div
                      key={shortcut.descriptionKey}
                      className="flex items-center justify-between py-1.5 px-2 rounded text-xs hover:bg-white/5 transition-colors"
                    >
                      {/* Description */}
                      <span style={{ color: 'var(--vscode-foreground)' }}>
                        {t(shortcut.descriptionKey)}
                      </span>

                      {/* Key combination */}
                      <div className="flex items-center gap-1" dir="ltr">
                        {shortcut.keys.map((key, i) => (
                          <React.Fragment key={key + i}>
                            {i > 0 && (
                              <span
                                className="text-[10px] opacity-40"
                                style={{ color: 'var(--vscode-foreground)' }}
                              >
                                +
                              </span>
                            )}
                            <kbd>{key}</kbd>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div
          className="px-5 py-3 border-t text-center"
          style={{
            borderColor: 'var(--vscode-panel-border)',
            color: 'var(--vscode-descriptionForeground)',
          }}
        >
          <span className="text-[10px]">
            {t('shortcuts.pressEscToClose', { key: '' })} <kbd>Esc</kbd>
          </span>
        </div>
      </div>

      {/* Animation keyframes moved to globals.css (animate-dialog-in) */}
    </div>
  );
}
