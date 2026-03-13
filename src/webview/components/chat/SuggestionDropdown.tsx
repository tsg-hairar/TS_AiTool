// ===================================================
// SuggestionDropdown — תפריט השלמה אוטומטית
// ===================================================
// מופיע מעל שדה הקלט כש-trigger character מוקלד:
//   / → slash commands
//   @ → סוכנים
//   # → פרויקטים
// ===================================================

import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../../state/AppContext';
import { BUILT_IN_AGENTS } from '../../../shared/constants';
import type { AgentId } from '../../../shared/types';

// -------------------------------------------------
// טיפוסים
// -------------------------------------------------

/** סוג הצעה */
export type SuggestionType = 'command' | 'agent' | 'project';

/** פריט הצעה בודד */
export interface SuggestionItem {
  /** מזהה ייחודי */
  id: string;
  /** תווית תצוגה */
  label: string;
  /** תיאור */
  description: string;
  /** אייקון */
  icon: string;
  /** סוג */
  type: SuggestionType;
  /** ערך להכנסה (מה שמוכנס ל-textarea) */
  insertValue: string;
}

/** Props של SuggestionDropdown */
interface SuggestionDropdownProps {
  /** טקסט הקלט הנוכחי */
  inputText: string;
  /** מיקום הסמן ב-textarea */
  cursorPosition: number;
  /** callback — נבחרה הצעה */
  onSelect: (item: SuggestionItem) => void;
  /** callback — סגירת הדרופדאון */
  onClose: () => void;
  /** האם הדרופדאון גלוי */
  visible: boolean;
  /** אינדקס הפריט הנבחר (מקלדת) */
  selectedIndex: number;
  /** עדכון אינדקס נבחר */
  onSelectedIndexChange: (index: number) => void;
}

// -------------------------------------------------
// פקודות slash מובנות — מקור ל-suggestions
// -------------------------------------------------
const SLASH_COMMANDS: Array<{ id: string; label: string; descriptionKey: string; icon: string }> = [
  { id: 'review', label: '/review', descriptionKey: 'suggestions.cmdReview', icon: '\uD83D\uDD0D' },
  { id: 'fix', label: '/fix', descriptionKey: 'suggestions.cmdFix', icon: '\uD83D\uDC1B' },
  { id: 'test', label: '/test', descriptionKey: 'suggestions.cmdTest', icon: '\uD83E\uDDEA' },
  { id: 'doc', label: '/doc', descriptionKey: 'suggestions.cmdDoc', icon: '\uD83D\uDCDD' },
  { id: 'security', label: '/security', descriptionKey: 'suggestions.cmdSecurity', icon: '\uD83D\uDD12' },
  { id: 'run', label: '/run', descriptionKey: 'suggestions.cmdRun', icon: '\u25B6\uFE0F' },
  { id: 'finish', label: '/finish', descriptionKey: 'suggestions.cmdFinish', icon: '\uD83D\uDE80' },
  { id: 'memory', label: '/memory', descriptionKey: 'suggestions.cmdMemory', icon: '\uD83E\uDDE0' },
  { id: 'compact', label: '/compact', descriptionKey: 'suggestions.cmdCompact', icon: '\uD83D\uDDDC\uFE0F' },
  { id: 'init', label: '/init', descriptionKey: 'suggestions.cmdInit', icon: '\uD83D\uDCC4' },
  { id: 'help', label: '/help', descriptionKey: 'suggestions.cmdHelp', icon: '\u2753' },
  { id: 'clear', label: '/clear', descriptionKey: 'suggestions.cmdClear', icon: '\uD83E\uDDF9' },
  { id: 'cost', label: '/cost', descriptionKey: 'suggestions.cmdCost', icon: '\uD83D\uDCB0' },
  { id: 'model', label: '/model', descriptionKey: 'suggestions.cmdModel', icon: '\uD83E\uDD16' },
  { id: 'status', label: '/status', descriptionKey: 'suggestions.cmdStatus', icon: '\uD83D\uDCCA' },
  { id: 'doctor', label: '/doctor', descriptionKey: 'suggestions.cmdDoctor', icon: '\uD83E\uDE7A' },
];

// -------------------------------------------------
// Fuzzy matching — מציאת תווים תואמים
// -------------------------------------------------

interface FuzzyResult {
  matches: boolean;
  /** אינדקסים של תווים תואמים (להדגשה) */
  matchIndices: number[];
  /** ציון התאמה (גבוה יותר = טוב יותר) */
  score: number;
}

function fuzzyMatch(query: string, target: string): FuzzyResult {
  if (!query) return { matches: true, matchIndices: [], score: 0 };

  const lowerQuery = query.toLowerCase();
  const lowerTarget = target.toLowerCase();

  // בדיקת prefix מדויק — ציון גבוה
  if (lowerTarget.startsWith(lowerQuery)) {
    const indices = Array.from({ length: query.length }, (_, i) => i);
    return { matches: true, matchIndices: indices, score: 100 + query.length };
  }

  // בדיקת contains — ציון בינוני
  const containsIdx = lowerTarget.indexOf(lowerQuery);
  if (containsIdx >= 0) {
    const indices = Array.from({ length: query.length }, (_, i) => containsIdx + i);
    return { matches: true, matchIndices: indices, score: 50 + query.length };
  }

  // fuzzy — כל תו מהשאילתה חייב להופיע בסדר
  const matchIndices: number[] = [];
  let queryIdx = 0;
  for (let i = 0; i < lowerTarget.length && queryIdx < lowerQuery.length; i++) {
    if (lowerTarget[i] === lowerQuery[queryIdx]) {
      matchIndices.push(i);
      queryIdx++;
    }
  }

  if (queryIdx === lowerQuery.length) {
    // ציון — קרבה בין האינדקסים (ריכוז גבוה = ציון טוב)
    let score = query.length;
    if (matchIndices.length > 1) {
      const spread = matchIndices[matchIndices.length - 1] - matchIndices[0];
      score += Math.max(0, 20 - spread);
    }
    return { matches: true, matchIndices, score };
  }

  return { matches: false, matchIndices: [], score: -1 };
}

// -------------------------------------------------
// HighlightedText — הדגשת תווים תואמים
// -------------------------------------------------
function HighlightedText({ text, matchIndices }: { text: string; matchIndices: number[] }) {
  if (matchIndices.length === 0) return <>{text}</>;

  const indexSet = new Set(matchIndices);
  const parts: React.ReactNode[] = [];
  let currentRun = '';
  let currentIsMatch = false;

  for (let i = 0; i < text.length; i++) {
    const isMatch = indexSet.has(i);
    if (isMatch !== currentIsMatch && currentRun) {
      parts.push(
        currentIsMatch
          ? <span key={`m-${i}`} className="suggestion-highlight">{currentRun}</span>
          : <span key={`t-${i}`}>{currentRun}</span>
      );
      currentRun = '';
    }
    currentRun += text[i];
    currentIsMatch = isMatch;
  }

  if (currentRun) {
    parts.push(
      currentIsMatch
        ? <span key="m-end" className="suggestion-highlight">{currentRun}</span>
        : <span key="t-end">{currentRun}</span>
    );
  }

  return <>{parts}</>;
}

// -------------------------------------------------
// parseTrigger — מזהה trigger character ושאילתה
// -------------------------------------------------
interface TriggerInfo {
  type: SuggestionType;
  trigger: string;
  query: string;
  /** מיקום תחילת ה-trigger בטקסט */
  startPos: number;
}

function parseTrigger(text: string, cursorPos: number): TriggerInfo | null {
  // עובדים על הטקסט עד מיקום הסמן
  const beforeCursor = text.slice(0, cursorPos);

  // מחפשים את ה-trigger האחרון לפני הסמן
  // / בתחילת הטקסט או אחרי רווח
  // @ בכל מקום
  // # בכל מקום

  // / — רק בתחילת שורה (אחרי \n) או בתחילת הטקסט
  const slashMatch = beforeCursor.match(/(?:^|\n)(\/\S*)$/);
  if (slashMatch) {
    const fullMatch = slashMatch[1]; // כולל /
    const query = fullMatch.slice(1); // בלי /
    return {
      type: 'command',
      trigger: '/',
      query,
      startPos: cursorPos - fullMatch.length,
    };
  }

  // @ — אחרי רווח או בתחילת טקסט
  const atMatch = beforeCursor.match(/(?:^|\s)(@\S*)$/);
  if (atMatch) {
    const fullMatch = atMatch[1]; // כולל @
    const query = fullMatch.slice(1);
    return {
      type: 'agent',
      trigger: '@',
      query,
      startPos: cursorPos - fullMatch.length,
    };
  }

  // # — אחרי רווח או בתחילת טקסט
  const hashMatch = beforeCursor.match(/(?:^|\s)(#\S*)$/);
  if (hashMatch) {
    const fullMatch = hashMatch[1]; // כולל #
    const query = fullMatch.slice(1);
    return {
      type: 'project',
      trigger: '#',
      query,
      startPos: cursorPos - fullMatch.length,
    };
  }

  return null;
}

// -------------------------------------------------
// MAX_VISIBLE — מקסימום פריטים מוצגים
// -------------------------------------------------
const MAX_VISIBLE = 7;

// =================================================
// SuggestionDropdown — הקומפוננטה הראשית
// =================================================
export function SuggestionDropdown({
  inputText,
  cursorPosition,
  onSelect,
  onClose,
  visible,
  selectedIndex,
  onSelectedIndexChange,
}: SuggestionDropdownProps) {
  const { t } = useTranslation();
  const { state } = useApp();
  const listRef = useRef<HTMLDivElement>(null);

  // -------------------------------------------------
  // חישוב trigger ו-suggestions
  // -------------------------------------------------
  const triggerInfo = useMemo(
    () => parseTrigger(inputText, cursorPosition),
    [inputText, cursorPosition],
  );

  // בניית רשימת כל ההצעות לפי סוג
  const allSuggestions = useMemo((): SuggestionItem[] => {
    if (!triggerInfo) return [];

    switch (triggerInfo.type) {
      case 'command':
        return SLASH_COMMANDS.map((cmd) => ({
          id: cmd.id,
          label: cmd.label,
          description: t(cmd.descriptionKey),
          icon: cmd.icon,
          type: 'command' as const,
          insertValue: cmd.label + ' ',
        }));

      case 'agent': {
        const agentEntries = Object.values(BUILT_IN_AGENTS);
        return agentEntries.map((agent) => ({
          id: agent.id,
          label: `@${agent.id}`,
          description: agent.name + ' — ' + agent.description,
          icon: agent.icon,
          type: 'agent' as const,
          insertValue: `@${agent.id} `,
        }));
      }

      case 'project': {
        const projects = state.projects;
        if (projects.length === 0) {
          return [{
            id: 'no-projects',
            label: t('suggestions.noProjects'),
            description: t('suggestions.noProjectsDesc'),
            icon: '\uD83D\uDCC1',
            type: 'project' as const,
            insertValue: '#',
          }];
        }
        return projects.map((proj) => ({
          id: proj.id,
          label: `#${proj.name}`,
          description: proj.description || proj.path,
          icon: proj.icon || '\uD83D\uDCC1',
          type: 'project' as const,
          insertValue: `#${proj.name} `,
        }));
      }

      default:
        return [];
    }
  }, [triggerInfo, t, state.projects]);

  // סינון fuzzy
  const filteredSuggestions = useMemo(() => {
    if (!triggerInfo) return [];
    const query = triggerInfo.query;

    const results = allSuggestions
      .map((item) => {
        // fuzzy match על ה-label (בלי ה-trigger character)
        const matchTarget = item.label.startsWith(triggerInfo.trigger)
          ? item.label.slice(triggerInfo.trigger.length)
          : item.label;
        const fuzzy = fuzzyMatch(query, matchTarget);
        // גם מנסים על התיאור
        const descFuzzy = fuzzyMatch(query, item.description);
        const bestScore = Math.max(fuzzy.score, descFuzzy.score);

        return {
          item,
          matchIndices: fuzzy.matches ? fuzzy.matchIndices : [],
          score: bestScore,
          matches: fuzzy.matches || descFuzzy.matches,
        };
      })
      .filter((r) => r.matches)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_VISIBLE);

    return results;
  }, [allSuggestions, triggerInfo]);

  // -------------------------------------------------
  // גלילה לפריט הנבחר
  // -------------------------------------------------
  useEffect(() => {
    if (!listRef.current) return;
    const selected = listRef.current.querySelector('[data-selected="true"]') as HTMLElement | null;
    if (selected) {
      selected.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  // -------------------------------------------------
  // האם להציג
  // -------------------------------------------------
  const shouldShow = visible && triggerInfo !== null && filteredSuggestions.length > 0;

  if (!shouldShow) return null;

  // סוג הקטגוריה הנוכחית — לכותרת
  const categoryLabel =
    triggerInfo!.type === 'command' ? t('suggestions.commands') :
    triggerInfo!.type === 'agent' ? t('suggestions.agents') :
    t('suggestions.projects');

  return (
    <div
      className="suggestion-dropdown menu-enter"
      role="listbox"
      aria-label={t('suggestions.ariaLabel')}
      dir="auto"
    >
      {/* כותרת קטגוריה */}
      <div className="suggestion-header">
        <span className="suggestion-header-icon">
          {triggerInfo!.type === 'command' ? '\u2318' :
           triggerInfo!.type === 'agent' ? '\uD83E\uDDD1\u200D\uD83D\uDCBB' :
           '\uD83D\uDCC2'}
        </span>
        <span>{categoryLabel}</span>
        <span className="suggestion-count">{filteredSuggestions.length}</span>
      </div>

      {/* רשימת הצעות */}
      <div
        ref={listRef}
        className="suggestion-list"
        role="presentation"
      >
        {filteredSuggestions.map((result, idx) => {
          const isSelected = idx === selectedIndex;
          return (
            <div
              key={result.item.id}
              className={`suggestion-item ${isSelected ? 'suggestion-item-selected' : ''}`}
              role="option"
              aria-selected={isSelected}
              data-selected={isSelected}
              onClick={() => onSelect(result.item)}
              onMouseEnter={() => onSelectedIndexChange(idx)}
            >
              {/* אייקון */}
              <span className="suggestion-item-icon">{result.item.icon}</span>

              {/* תוכן */}
              <div className="suggestion-item-content">
                <span className="suggestion-item-label">
                  {/* trigger prefix */}
                  <span className="suggestion-trigger-char">
                    {triggerInfo!.trigger}
                  </span>
                  <HighlightedText
                    text={result.item.label.slice(triggerInfo!.trigger.length)}
                    matchIndices={result.matchIndices}
                  />
                </span>
                <span className="suggestion-item-desc">
                  {result.item.description}
                </span>
              </div>

              {/* מקש קיצור — Enter לנבחר */}
              {isSelected && (
                <span className="suggestion-item-hint">
                  <kbd>Enter</kbd>
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* רמז ניווט תחתון */}
      <div className="suggestion-footer">
        <span><kbd>&uarr;</kbd><kbd>&darr;</kbd> {t('suggestions.navigate')}</span>
        <span><kbd>Enter</kbd> {t('suggestions.select')}</span>
        <span><kbd>Esc</kbd> {t('suggestions.dismiss')}</span>
      </div>
    </div>
  );
}

// -------------------------------------------------
// Hook — useSuggestions
// -------------------------------------------------
// מנהל את לוגיקת ה-suggestions (visible, selectedIndex, keyboard)
// -------------------------------------------------

export interface UseSuggestionsResult {
  /** האם הדרופדאון גלוי */
  visible: boolean;
  /** אינדקס הפריט הנבחר */
  selectedIndex: number;
  /** עדכון אינדקס */
  setSelectedIndex: (idx: number) => void;
  /** trigger info */
  triggerInfo: TriggerInfo | null;
  /** פריטים מסוננים (לבדיקת כמות) */
  filteredCount: number;
  /** handler למקש — מחזיר true אם צרך למנוע default */
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => boolean;
  /** בחירת הצעה — מחזיר טקסט חדש ומיקום סמן */
  selectSuggestion: (item: SuggestionItem) => { newText: string; newCursor: number };
  /** סגירת דרופדאון */
  close: () => void;
}

export function useSuggestions(
  inputText: string,
  cursorPosition: number,
  allSuggestionsCount: number,
): UseSuggestionsResult {
  const [visible, setVisible] = React.useState(false);
  const [selectedIndex, setSelectedIndex] = React.useState(0);

  const triggerInfo = useMemo(
    () => parseTrigger(inputText, cursorPosition),
    [inputText, cursorPosition],
  );

  // פתיחה/סגירה אוטומטית
  useEffect(() => {
    if (triggerInfo) {
      setVisible(true);
      setSelectedIndex(0);
    } else {
      setVisible(false);
    }
  }, [triggerInfo?.type, triggerInfo?.query]);

  const close = useCallback(() => {
    setVisible(false);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>): boolean => {
      if (!visible || !triggerInfo) return false;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < Math.min(allSuggestionsCount - 1, MAX_VISIBLE - 1) ? prev + 1 : 0,
          );
          return true;

        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : Math.min(allSuggestionsCount - 1, MAX_VISIBLE - 1),
          );
          return true;

        case 'Enter':
          // אם יש suggestions פתוחות — Enter = בחירה, לא שליחה
          e.preventDefault();
          return true; // ChatPanel ידע לבחור את הפריט

        case 'Escape':
          e.preventDefault();
          close();
          return true;

        case 'Tab':
          // Tab גם בוחר
          e.preventDefault();
          return true;

        default:
          return false;
      }
    },
    [visible, triggerInfo, allSuggestionsCount, close],
  );

  const selectSuggestion = useCallback(
    (item: SuggestionItem): { newText: string; newCursor: number } => {
      if (!triggerInfo) return { newText: inputText, newCursor: cursorPosition };

      const before = inputText.slice(0, triggerInfo.startPos);
      const after = inputText.slice(cursorPosition);
      const newText = before + item.insertValue + after;
      const newCursor = before.length + item.insertValue.length;

      return { newText, newCursor };
    },
    [triggerInfo, inputText, cursorPosition],
  );

  return {
    visible,
    selectedIndex,
    setSelectedIndex,
    triggerInfo,
    filteredCount: allSuggestionsCount,
    handleKeyDown,
    selectSuggestion,
    close,
  };
}

// ייצוא עזר — parseTrigger זמין גם בנפרד
export { parseTrigger };
export type { TriggerInfo };
