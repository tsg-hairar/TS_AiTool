// ===================================================
// SearchBar — סרגל חיפוש בהיסטוריית שיחות
// ===================================================
// מאפשר חיפוש טקסט בהודעות השיחה הנוכחית
// תומך בניווט בין תוצאות, debounce, וקיצורי מקלדת
// ===================================================

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Search, X, ChevronUp, ChevronDown } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { TIMEOUTS } from '../../../shared/constants';

// Debounce helper
function useDebounce(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

interface SearchBarProps {
  /** סגירת סרגל החיפוש */
  onClose: () => void;
  /** מספר התוצאות שנמצאו */
  matchCount: number;
  /** אינדקס התוצאה הנוכחית (0-based) */
  currentMatchIndex: number;
  /** ניווט לתוצאה הבאה */
  onNext: () => void;
  /** ניווט לתוצאה הקודמת */
  onPrev: () => void;
}

export function SearchBar({
  onClose,
  matchCount,
  currentMatchIndex,
  onNext,
  onPrev,
}: SearchBarProps) {
  const { state, dispatch } = useApp();
  const inputRef = useRef<HTMLInputElement>(null);
  const [localQuery, setLocalQuery] = useState(state.searchQuery);
  const debouncedQuery = useDebounce(localQuery, TIMEOUTS.SEARCH_DEBOUNCE_MS);

  // פוקוס אוטומטי כשנפתח
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  // עדכון ה-state עם ה-debounced query
  useEffect(() => {
    dispatch({ type: 'SET_SEARCH_QUERY', payload: debouncedQuery });
  }, [debouncedQuery, dispatch]);

  // --- קיצורי מקלדת ---
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
          onPrev();
        } else {
          onNext();
        }
      } else if (e.key === 'g' && e.ctrlKey) {
        e.preventDefault();
        if (e.shiftKey) {
          onPrev();
        } else {
          onNext();
        }
      }
    },
    [onClose, onNext, onPrev],
  );

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 border-b animate-fade-in"
      style={{
        borderColor: 'var(--vscode-panel-border)',
        background: 'var(--vscode-input-background, rgba(255,255,255,0.05))',
      }}
      dir="rtl"
    >
      {/* אייקון חיפוש */}
      <Search
        size={14}
        className="opacity-50 flex-shrink-0"
        style={{ color: 'var(--vscode-foreground)' }}
      />

      {/* שדה חיפוש */}
      <input
        ref={inputRef}
        type="text"
        className="flex-1 bg-transparent border-none outline-none text-xs"
        style={{
          color: 'var(--vscode-input-foreground, inherit)',
          caretColor: 'var(--vscode-focusBorder, #007acc)',
        }}
        placeholder="חיפוש בהודעות..."
        value={localQuery}
        onChange={(e) => setLocalQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        aria-label="חיפוש בהודעות"
      />

      {/* מונה תוצאות */}
      {localQuery.trim() && (
        <span className="text-[10px] opacity-50 flex-shrink-0 whitespace-nowrap">
          {matchCount > 0
            ? `${currentMatchIndex + 1} / ${matchCount} תוצאות`
            : 'אין תוצאות'}
        </span>
      )}

      {/* כפתורי ניווט */}
      {matchCount > 0 && (
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            className="btn-ghost p-0.5 rounded"
            onClick={onPrev}
            title="תוצאה קודמת (Shift+Enter)"
            aria-label="תוצאה קודמת"
          >
            <ChevronUp size={14} style={{ color: 'var(--vscode-foreground)' }} />
          </button>
          <button
            className="btn-ghost p-0.5 rounded"
            onClick={onNext}
            title="תוצאה הבאה (Enter)"
            aria-label="תוצאה הבאה"
          >
            <ChevronDown size={14} style={{ color: 'var(--vscode-foreground)' }} />
          </button>
        </div>
      )}

      {/* כפתור סגירה */}
      <button
        className="btn-ghost p-0.5 rounded flex-shrink-0"
        onClick={onClose}
        title="סגור חיפוש (Escape)"
        aria-label="סגור חיפוש"
      >
        <X size={14} style={{ color: 'var(--vscode-foreground)' }} />
      </button>
    </div>
  );
}

// -------------------------------------------------
// highlightSearchText — הדגשת טקסט תואם בתוך HTML
// -------------------------------------------------
// מקבל טקסט רגיל ו-query, מחזיר HTML עם highlight
// שימוש ב-MessageBubble כשחיפוש פעיל
// -------------------------------------------------
export function highlightSearchText(text: string, query: string): string {
  if (!query || !query.trim()) return text;

  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedQuery})`, 'gi');

  // Split by HTML tags to only highlight text content, not tag attributes
  const parts = text.split(/(<[^>]*>)/);
  return parts
    .map((part) => {
      // Skip HTML tags
      if (part.startsWith('<') && part.endsWith('>')) return part;
      // Replace only in text content
      return part.replace(
        regex,
        '<mark class="search-highlight" style="background: rgba(255, 213, 79, 0.4); color: inherit; border-radius: 2px; padding: 0 1px;">$1</mark>',
      );
    })
    .join('');
}
