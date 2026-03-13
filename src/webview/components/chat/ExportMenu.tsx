// ===================================================
// ExportMenu — תפריט ייצוא שיחה
// ===================================================
// תפריט נפתח עם אפשרויות ייצוא: Markdown, HTML, Clipboard, JSON
// נסגר בלחיצה מחוץ לתפריט
// ===================================================

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useApp } from '../../state/AppContext';
import {
  FileText,
  FileCode,
  Clipboard,
  FileJson,
} from 'lucide-react';

interface ExportMenuProps {
  /** האם התפריט פתוח */
  isOpen: boolean;
  /** סגירת התפריט */
  onClose: () => void;
}

/** אפשרות בתפריט */
interface ExportOption {
  id: 'markdown' | 'html' | 'clipboard' | 'json';
  label: string;
  description: string;
  icon: React.ReactNode;
}

const EXPORT_OPTIONS: ExportOption[] = [
  {
    id: 'markdown',
    label: 'Markdown',
    description: 'קובץ .md עם עיצוב מלא',
    icon: <FileText size={16} />,
  },
  {
    id: 'html',
    label: 'HTML',
    description: 'דף אינטרנט מעוצב עם ערכת נושא כהה',
    icon: <FileCode size={16} />,
  },
  {
    id: 'clipboard',
    label: 'העתק ללוח',
    description: 'טקסט פשוט מועתק ללוח',
    icon: <Clipboard size={16} />,
  },
  {
    id: 'json',
    label: 'JSON',
    description: 'קובץ .json עם כל המטא-דאטה',
    icon: <FileJson size={16} />,
  },
];

export function ExportMenu({ isOpen, onClose }: ExportMenuProps) {
  const { sendMessage } = useApp();
  const menuRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // איפוס אינדקס כשנפתח
  useEffect(() => {
    if (isOpen) {
      setFocusedIndex(0);
    }
  }, [isOpen]);

  // פוקוס על הפריט הנוכחי
  useEffect(() => {
    if (isOpen && itemRefs.current[focusedIndex]) {
      itemRefs.current[focusedIndex]?.focus();
    }
  }, [focusedIndex, isOpen]);

  // טיפול במקלדת — חצים, Enter, Escape
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!isOpen) return;

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setFocusedIndex((prev) =>
            prev < EXPORT_OPTIONS.length - 1 ? prev + 1 : 0,
          );
          break;
        case 'ArrowUp':
          event.preventDefault();
          setFocusedIndex((prev) =>
            prev > 0 ? prev - 1 : EXPORT_OPTIONS.length - 1,
          );
          break;
        case 'Enter':
        case ' ':
          event.preventDefault();
          handleExport(EXPORT_OPTIONS[focusedIndex].id);
          break;
        case 'Escape':
          event.preventDefault();
          onClose();
          break;
        case 'Home':
          event.preventDefault();
          setFocusedIndex(0);
          break;
        case 'End':
          event.preventDefault();
          setFocusedIndex(EXPORT_OPTIONS.length - 1);
          break;
      }
    },
    [isOpen, focusedIndex, onClose],
  );

  // סגירה בלחיצה מחוץ לתפריט + מקלדת
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    // דיליי קטן כדי שהלחיצה על כפתור הפתיחה לא תסגור מיד
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }, 10);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, handleKeyDown]);

  if (!isOpen) return null;

  function handleExport(format: ExportOption['id']) {
    sendMessage({ type: 'exportChat', payload: { format } });
    onClose();
  }

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="תפריט ייצוא"
      aria-activedescendant={`export-option-${EXPORT_OPTIONS[focusedIndex].id}`}
      className="absolute left-0 top-full mt-1 z-50 min-w-[220px] rounded-md shadow-lg overflow-hidden menu-enter"
      style={{
        background: 'var(--vscode-dropdown-background, #252526)',
        border: '1px solid var(--vscode-dropdown-border, #404040)',
      }}
    >
      {/* כותרת */}
      <div
        className="px-3 py-2 text-xs font-semibold border-b"
        style={{
          color: 'var(--vscode-descriptionForeground, #858585)',
          borderColor: 'var(--vscode-dropdown-border, #404040)',
        }}
      >
        ייצוא שיחה
      </div>

      {/* אפשרויות */}
      {EXPORT_OPTIONS.map((option, idx) => {
        const isFocused = idx === focusedIndex;
        return (
          <button
            key={option.id}
            id={`export-option-${option.id}`}
            ref={(el) => { itemRefs.current[idx] = el; }}
            role="menuitem"
            tabIndex={isFocused ? 0 : -1}
            className="w-full flex items-center gap-3 px-3 py-2 text-right transition-colors"
            style={{
              color: 'var(--vscode-dropdown-foreground, #cccccc)',
              background: isFocused
                ? 'var(--vscode-list-hoverBackground, #2a2d2e)'
                : 'transparent',
              outline: isFocused ? '1px solid var(--vscode-focusBorder, #007acc)' : 'none',
              outlineOffset: '-1px',
            }}
            onMouseEnter={() => setFocusedIndex(idx)}
            onClick={() => handleExport(option.id)}
          >
            <span
              className="flex-shrink-0"
              style={{ color: 'var(--vscode-symbolIcon-fileForeground, #007acc)' }}
            >
              {option.icon}
            </span>
            <div className="flex flex-col items-start">
              <span className="text-sm font-medium">{option.label}</span>
              <span
                className="text-xs"
                style={{ color: 'var(--vscode-descriptionForeground, #858585)' }}
              >
                {option.description}
              </span>
            </div>
          </button>
        );
      })}

      {/* רמז ניווט מקלדת */}
      <div
        className="px-3 py-1.5 text-[10px] border-t flex items-center gap-3"
        style={{
          color: 'var(--vscode-descriptionForeground, #858585)',
          borderColor: 'var(--vscode-dropdown-border, #404040)',
        }}
      >
        <span><kbd>&#x2191;</kbd><kbd>&#x2193;</kbd> navigate</span>
        <span><kbd>Enter</kbd> select</span>
        <span><kbd>Esc</kbd> close</span>
      </div>
    </div>
  );
}
