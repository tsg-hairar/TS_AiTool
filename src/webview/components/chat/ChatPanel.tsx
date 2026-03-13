// ===================================================
// ChatPanel — פאנל צ'אט ראשי
// ===================================================
// מציג הודעות, סוכנים, ושדה קלט
// ===================================================

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../../state/AppContext';
import { MessageBubble } from './MessageBubble';
import { InputArea } from './InputArea';
import { SearchBar } from './SearchBar';
import { AgentTabs } from '../agents/AgentTabs';
import { RetryButton } from '../common/RetryButton';
import { MessageSkeleton } from '../common/SkeletonLoader';
import { TypingIndicator } from './TypingIndicator';
import { throttle } from '../../../shared/utils/performance';
import { TIMEOUTS } from '../../../shared/constants';

// -------------------------------------------------
// VIRTUAL_BUFFER — כמה הודעות לשמור מעל/מתחת לתצוגה
// ESTIMATED_MSG_HEIGHT — גובה משוער להודעה (px)
// VIRTUALIZATION_THRESHOLD — מפעילים וירטואליזציה רק מעל X הודעות
// -------------------------------------------------
const VIRTUAL_BUFFER = 5;
const ESTIMATED_MSG_HEIGHT = 100;
const VIRTUALIZATION_THRESHOLD = 15;

// -------------------------------------------------
// סיווג שגיאות — מזהה סוג השגיאה לפי טקסט
// -------------------------------------------------
type ErrorCategory = 'network' | 'api' | 'tool' | 'unknown';

function categorizeError(message: string): ErrorCategory {
  const lower = message.toLowerCase();

  // שגיאות רשת
  if (
    lower.includes('network') ||
    lower.includes('timeout') ||
    lower.includes('econnrefused') ||
    lower.includes('enotfound') ||
    lower.includes('fetch') ||
    lower.includes('connection') ||
    lower.includes('חיבור') ||
    lower.includes('רשת')
  ) {
    return 'network';
  }

  // שגיאות API
  if (
    lower.includes('api') ||
    lower.includes('401') ||
    lower.includes('403') ||
    lower.includes('429') ||
    lower.includes('rate limit') ||
    lower.includes('unauthorized') ||
    lower.includes('forbidden') ||
    lower.includes('quota') ||
    lower.includes('credit') ||
    lower.includes('key') ||
    lower.includes('token') ||
    lower.includes('anthropic') ||
    lower.includes('claude')
  ) {
    return 'api';
  }

  // שגיאות כלי
  if (
    lower.includes('tool') ||
    lower.includes('command') ||
    lower.includes('permission') ||
    lower.includes('denied') ||
    lower.includes('כלי') ||
    lower.includes('הרשאה')
  ) {
    return 'tool';
  }

  return 'unknown';
}

/** מידע תצוגתי לפי קטגוריית שגיאה — hook כי משתמש ב-t() */
function useErrorDisplay(category: ErrorCategory) {
  const { t } = useTranslation();
  switch (category) {
    case 'network':
      return { icon: '\u26A1', label: t('chat.errorCategoryNetwork'), color: '#f59e0b' };
    case 'api':
      return { icon: '\u26D4', label: t('chat.errorCategoryApi'), color: '#ef4444' };
    case 'tool':
      return { icon: '\u26A0', label: t('chat.errorCategoryTool'), color: '#f97316' };
    default:
      return { icon: '\u274C', label: t('chat.errorCategoryUnknown'), color: '#ef4444' };
  }
}

export function ChatPanel() {
  const { state, dispatch, sendMessage } = useApp();
  const { t } = useTranslation();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup retry timer on unmount
  useEffect(() => {
    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
    };
  }, []);

  // --- מצב טעינת היסטוריה — מראה שלדים בזמן טעינת שיחה ---
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // כשנטענת שיחה (LOAD_CONVERSATION), מראים שלדים לרגע
  useEffect(() => {
    if (state.status === 'thinking' && state.messages.length === 0) {
      setIsLoadingHistory(true);
    } else if (isLoadingHistory && state.messages.length > 0) {
      setIsLoadingHistory(false);
    }
  }, [state.messages.length, state.status, isLoadingHistory]);

  // --- טיימר streaming — מראה כמה זמן Claude עובד ---
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const isBusy = state.status === 'thinking' || state.status === 'streaming';

  useEffect(() => {
    if (!isBusy) {
      setElapsedSeconds(0);
      return;
    }
    // מתחילים לספור שניות כשהסטטוס הופך ל-busy
    const start = Date.now();
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [isBusy]);

  // -------------------------------------------------
  // חיפוש — חישוב התאמות מקומיות בהודעות הנוכחיות
  // -------------------------------------------------
  const searchQuery = state.searchQuery;
  const searchMatchIndices = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const lowerQ = searchQuery.toLowerCase();
    const indices: number[] = [];
    state.messages.forEach((msg, i) => {
      if (msg.content.toLowerCase().includes(lowerQ)) {
        indices.push(i);
      }
    });
    return indices;
  }, [searchQuery, state.messages]);

  // עדכון ה-state עם התוצאות
  useEffect(() => {
    dispatch({ type: 'SET_SEARCH_MATCHES', payload: searchMatchIndices });
  }, [searchMatchIndices, dispatch]);

  // ניווט לתוצאה הבאה
  const handleSearchNext = useCallback(() => {
    if (searchMatchIndices.length === 0) return;
    const next = (state.searchCurrentMatch + 1) % searchMatchIndices.length;
    dispatch({ type: 'SET_SEARCH_CURRENT_MATCH', payload: next });
  }, [searchMatchIndices, state.searchCurrentMatch, dispatch]);

  // ניווט לתוצאה הקודמת
  const handleSearchPrev = useCallback(() => {
    if (searchMatchIndices.length === 0) return;
    const prev = (state.searchCurrentMatch - 1 + searchMatchIndices.length) % searchMatchIndices.length;
    dispatch({ type: 'SET_SEARCH_CURRENT_MATCH', payload: prev });
  }, [searchMatchIndices, state.searchCurrentMatch, dispatch]);

  // סגירת חיפוש
  const handleSearchClose = useCallback(() => {
    dispatch({ type: 'SET_SEARCH_OPEN', payload: false });
  }, [dispatch]);

  // גלילה להודעה התואמת הנוכחית
  const messageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  useEffect(() => {
    if (searchMatchIndices.length === 0) return;
    const matchMsgIndex = searchMatchIndices[state.searchCurrentMatch];
    if (matchMsgIndex === undefined) return;
    const el = messageRefs.current.get(matchMsgIndex);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [state.searchCurrentMatch, searchMatchIndices]);

  // --- קיצור מקלדת Ctrl+F לפתיחת חיפוש ---
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        dispatch({ type: 'SET_SEARCH_OPEN', payload: true });
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [dispatch]);

  // גלילה אוטומטית למטה כשמתווספת הודעה
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.messages]);

  // -------------------------------------------------
  // ניסיון חוזר — שולח מחדש את ההודעה האחרונה של המשתמש
  // -------------------------------------------------
  const handleRetry = useCallback(() => {
    // מחפשים את ההודעה האחרונה של המשתמש
    const lastUserMessage = [...state.messages]
      .reverse()
      .find((m) => m.role === 'user');

    if (!lastUserMessage) return;

    setIsRetrying(true);

    // מנקים שגיאה
    dispatch({ type: 'SET_ERROR', payload: null });

    // שולחים שוב את ההודעה
    sendMessage({
      type: 'sendMessage',
      payload: { content: lastUserMessage.content },
    });

    // מאפסים מצב ניסיון חוזר אחרי קצת זמן
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
    }
    retryTimerRef.current = setTimeout(() => setIsRetrying(false), TIMEOUTS.UI_FEEDBACK_MS);
  }, [state.messages, dispatch, sendMessage]);

  // הודעות מוצמדות (pinned) — מוצגות למעלה
  const pinnedMessages = state.messages.filter((m) => m.isPinned);
  const regularMessages = state.messages.filter((m) => !m.isPinned);

  // פורמט זמן mm:ss
  const formatElapsed = (s: number) => {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return min > 0 ? `${min}:${sec.toString().padStart(2, '0')}` : `${sec}s`;
  };

  // בניית set של אינדקסי הודעות תואמות (לשימוש מהיר)
  const matchingMsgSet = useMemo(
    () => new Set(searchMatchIndices),
    [searchMatchIndices],
  );

  // האינדקס של ההודעה המודגשת כ"נוכחית"
  const currentHighlightMsgIndex =
    searchMatchIndices.length > 0
      ? searchMatchIndices[state.searchCurrentMatch]
      : -1;

  // -------------------------------------------------
  // Message Virtualization — רינדור רק הודעות נראות
  // -------------------------------------------------
  // מפעילים רק מעל VIRTUALIZATION_THRESHOLD הודעות
  // Buffer של 5 הודעות מעל/מתחת לתצוגה
  // -------------------------------------------------
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [visibleRange, setVisibleRange] = useState<{ start: number; end: number }>({
    start: 0,
    end: Math.max(regularMessages.length, VIRTUALIZATION_THRESHOLD + VIRTUAL_BUFFER),
  });

  // שמירת גבהים אמיתיים של הודעות שכבר רונדרו
  const measuredHeights = useRef<Map<number, number>>(new Map());

  const useVirtualization = regularMessages.length > VIRTUALIZATION_THRESHOLD;

  // חישוב טווח הנראה — throttled scroll handler
  const updateVisibleRange = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container || !useVirtualization) return;

    const scrollTop = container.scrollTop;
    const viewportHeight = container.clientHeight;

    // חישוב אינדקס ההודעה הראשונה הנראית
    let accumulatedHeight = 0;
    let startIdx = 0;

    for (let i = 0; i < regularMessages.length; i++) {
      const h = measuredHeights.current.get(i) ?? ESTIMATED_MSG_HEIGHT;
      if (accumulatedHeight + h >= scrollTop) {
        startIdx = i;
        break;
      }
      accumulatedHeight += h;
    }

    // חישוב אינדקס ההודעה האחרונה הנראית
    let endIdx = startIdx;
    let visibleHeight = 0;
    for (let i = startIdx; i < regularMessages.length; i++) {
      const h = measuredHeights.current.get(i) ?? ESTIMATED_MSG_HEIGHT;
      visibleHeight += h;
      endIdx = i;
      if (visibleHeight >= viewportHeight) break;
    }

    // הוספת buffer
    const newStart = Math.max(0, startIdx - VIRTUAL_BUFFER);
    const newEnd = Math.min(regularMessages.length - 1, endIdx + VIRTUAL_BUFFER);

    setVisibleRange((prev) => {
      if (prev.start === newStart && prev.end === newEnd) return prev;
      return { start: newStart, end: newEnd };
    });
  }, [regularMessages.length, useVirtualization]);

  // Throttled scroll handler
  const throttledScroll = useMemo(
    () => throttle(updateVisibleRange as (...args: unknown[]) => unknown, 50),
    [updateVisibleRange],
  );

  // ניקוי throttle בעת unmount
  useEffect(() => {
    return () => throttledScroll.cancel();
  }, [throttledScroll]);

  // עדכון טווח כשמשתנה מספר ההודעות
  useEffect(() => {
    if (!useVirtualization) {
      setVisibleRange({ start: 0, end: regularMessages.length - 1 });
    } else {
      updateVisibleRange();
    }
  }, [regularMessages.length, useVirtualization, updateVisibleRange]);

  // מדידת גובה הודעה שרונדרה
  const measureRef = useCallback((el: HTMLDivElement | null, idx: number) => {
    if (el) {
      messageRefs.current.set(idx, el);
      const height = el.getBoundingClientRect().height;
      if (height > 0) {
        measuredHeights.current.set(idx, height);
      }
    }
  }, []);

  // חישוב גובה ה-spacer העליון (מקום להודעות שלא מרונדרות)
  const topSpacerHeight = useMemo(() => {
    if (!useVirtualization) return 0;
    let h = 0;
    for (let i = 0; i < visibleRange.start; i++) {
      h += measuredHeights.current.get(i) ?? ESTIMATED_MSG_HEIGHT;
    }
    return h;
  }, [visibleRange.start, useVirtualization]);

  // חישוב גובה ה-spacer התחתון
  const bottomSpacerHeight = useMemo(() => {
    if (!useVirtualization) return 0;
    let h = 0;
    for (let i = visibleRange.end + 1; i < regularMessages.length; i++) {
      h += measuredHeights.current.get(i) ?? ESTIMATED_MSG_HEIGHT;
    }
    return h;
  }, [visibleRange.end, regularMessages.length, useVirtualization]);

  // הודעות שבאמת מרונדרות
  const renderedMessages = useMemo(() => {
    if (!useVirtualization) return regularMessages;
    return regularMessages.slice(visibleRange.start, visibleRange.end + 1);
  }, [regularMessages, visibleRange, useVirtualization]);

  // -------------------------------------------------
  // שליחה חוזרת של הודעות בתור כשחוזרים אונליין
  // -------------------------------------------------
  const prevOffline = useRef(state.isOffline);
  useEffect(() => {
    if (prevOffline.current && !state.isOffline && state.queuedMessages.length > 0) {
      // חזרנו אונליין — שולחים הודעות שבתור
      for (const queued of state.queuedMessages) {
        sendMessage({
          type: 'sendMessage',
          payload: { content: queued.content, images: queued.images },
        });
      }
      dispatch({ type: 'CLEAR_QUEUED_MESSAGES' });
    }
    prevOffline.current = state.isOffline;
  }, [state.isOffline, state.queuedMessages, sendMessage, dispatch]);

  return (
    <div className="flex flex-col h-full" style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
      {/* באנר אופליין — מוצג כשאין חיבור לרשת */}
      {state.isOffline && (
        <div
          role="alert"
          className="px-3 py-2 flex items-center gap-2 text-xs border-b"
          style={{
            background: 'rgba(245, 158, 11, 0.15)',
            borderColor: 'rgba(245, 158, 11, 0.3)',
            color: '#fbbf24',
          }}
        >
          <span>&#x26A0;</span>
          <span className="font-medium">{t('chat.offlineTitle', { defaultValue: 'No Connection' })}</span>
          <span className="opacity-70">
            {t('chat.offlineDesc', { defaultValue: 'Messages will be queued and sent when connection is restored.' })}
          </span>
          {state.queuedMessages.length > 0 && (
            <span
              className="ms-auto px-2 py-0.5 rounded-full text-[10px] font-medium"
              style={{ background: 'rgba(245, 158, 11, 0.25)' }}
            >
              {state.queuedMessages.length} queued
            </span>
          )}
        </div>
      )}

      {/* טאבים של סוכנים */}
      <AgentTabs />

      {/* סרגל חיפוש */}
      {state.searchOpen && (
        <SearchBar
          onClose={handleSearchClose}
          matchCount={searchMatchIndices.length}
          currentMatchIndex={state.searchCurrentMatch}
          onNext={handleSearchNext}
          onPrev={handleSearchPrev}
        />
      )}

      {/* --- סרגל סטטוס: מופיע כש-Claude עובד --- */}
      {isBusy && (
        <div
          role="status"
          aria-live="polite"
          aria-label={state.status === 'streaming' ? t('chat.writingResponse') : state.statusMessage || t('chat.processing')}
          className={`px-3 py-1.5 flex items-center gap-2 text-[10px] border-b animate-slide-down ${
            state.status === 'thinking' ? 'status-thinking' : 'status-streaming'
          }`}
          style={{
            borderColor: 'var(--vscode-panel-border)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        >
          {/* אינדיקטור אנימציה */}
          <div className="flex gap-0.5">
            <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#3b82f6', animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#3b82f6', animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#3b82f6', animationDelay: '300ms' }} />
          </div>

          {/* סטטוס טקסט — מציג פירוט מ-statusMessage אם יש */}
          <span className="opacity-70">
            {state.status === 'streaming'
              ? t('chat.writingResponseEllipsis')
              : state.statusMessage || t('chat.processingEllipsis')}
          </span>

          {/* טיימר */}
          <span className="opacity-40 font-mono ms-auto">
            {formatElapsed(elapsedSeconds)}
          </span>

          {/* אינדיקטור שלבים — מתקדם עם הזמן */}
          {state.status === 'thinking' && !state.statusMessage && elapsedSeconds > 3 && (
            <span className="opacity-40 text-[9px]">
              {elapsedSeconds < 10 ? t('chat.connecting') :
               elapsedSeconds < 20 ? t('chat.analyzing') :
               elapsedSeconds < 40 ? t('chat.thinking') :
               t('chat.stillWorking')}
            </span>
          )}
        </div>
      )}

      {/* הודעות מוצמדות */}
      {pinnedMessages.length > 0 && (
        <div
          className="px-3 py-2 border-b text-xs glass-subtle"
          style={{
            borderColor: 'var(--vscode-panel-border)',
            borderInlineStart: '3px solid rgba(245, 158, 11, 0.5)',
          }}
        >
          <div className="font-medium mb-1 opacity-60 flex items-center gap-1.5">
            <span style={{ color: 'var(--agent-qa)' }}>&#128204;</span>
            {t('chat.pinnedMessages')}
          </div>
          {pinnedMessages.map((msg) => (
            <div key={msg.id} className="truncate opacity-70 mb-0.5 ps-4">
              {msg.content.slice(0, 100)}
            </div>
          ))}
        </div>
      )}

      {/* אזור הודעות — גלילה עם וירטואליזציה */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-3 py-4"
        role="log"
        aria-live="polite"
        aria-label={t('chat.ariaLabel')}
        onScroll={useVirtualization ? () => throttledScroll() : undefined}
      >
        {isLoadingHistory ? (
          /* שלדי טעינה — מוצגים בזמן טעינת היסטוריית שיחה */
          <div className="animate-fade-in">
            <MessageSkeleton isUser={true} />
            <MessageSkeleton isUser={false} />
            <MessageSkeleton isUser={true} />
          </div>
        ) : regularMessages.length === 0 ? (
          <WelcomeMessage />
        ) : (
          <>
            {/* Spacer עליון — מחזיק מקום להודעות שמעל ה-viewport */}
            {topSpacerHeight > 0 && <div style={{ height: topSpacerHeight }} aria-hidden="true" />}

            {renderedMessages.map((message, idx) => {
              // חישוב אינדקס אמיתי
              const regularIdx = useVirtualization ? visibleRange.start + idx : idx;
              const realIndex = state.messages.indexOf(message);
              const isMatch = matchingMsgSet.has(realIndex);
              const isCurrent = realIndex === currentHighlightMsgIndex;
              return (
                <div
                  key={message.id}
                  ref={(el) => measureRef(el, regularIdx)}
                >
                  <MessageBubble
                    message={message}
                    searchQuery={state.searchOpen ? searchQuery : ''}
                    isSearchMatch={isMatch}
                    isCurrentSearchMatch={isCurrent}
                  />
                </div>
              );
            })}

            {/* Spacer תחתון — מחזיק מקום להודעות שמתחת ל-viewport */}
            {bottomSpacerHeight > 0 && <div style={{ height: bottomSpacerHeight }} aria-hidden="true" />}

            {/* מונה הודעות — מוצג רק כשיש וירטואליזציה */}
            {useVirtualization && (
              <div
                className="text-center text-[10px] opacity-30 py-1 select-none"
                aria-live="off"
              >
                {t('chat.messageCounter', {
                  current: visibleRange.end + 1,
                  total: regularMessages.length,
                  defaultValue: `${'\u05D4\u05D5\u05D3\u05E2\u05D4'} ${visibleRange.end + 1} ${'\u05DE\u05EA\u05D5\u05DA'} ${regularMessages.length}`,
                })}
              </div>
            )}
          </>
        )}

        {/* אינדיקטור "חושב..." — TypingIndicator component */}
        {(state.status === 'thinking' || state.status === 'streaming') && (
          <TypingIndicator
            status={state.status as 'thinking' | 'streaming'}
            statusMessage={state.statusMessage ?? undefined}
            elapsedSeconds={elapsedSeconds}
          />
        )}

        {/* שגיאה משופרת — עם סיווג, כפתור סגירה, וניסיון חוזר */}
        {state.errorMessage && (
          <ChatError
            message={state.errorMessage}
            onDismiss={() => dispatch({ type: 'SET_ERROR', payload: null })}
            onRetry={handleRetry}
            isRetrying={isRetrying}
          />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* שדה קלט */}
      <InputArea />
    </div>
  );
}

// -------------------------------------------------
// WelcomeMessage — כשאין הודעות
// -------------------------------------------------
function WelcomeMessage() {
  const { state } = useApp();
  const { t } = useTranslation();
  const agent = state.agents.find((a) => a.id === state.activeAgentId);

  return (
    <div className="flex flex-col items-center justify-center py-12 opacity-60 animate-scale-in">
      <div
        className="text-3xl mb-3 glass-card flex items-center justify-center"
        style={{
          width: '64px',
          height: '64px',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-glow)',
        }}
      >
        {agent?.icon ?? '\uD83D\uDCAC'}
      </div>
      <h2 className="text-sm font-medium mb-1 mt-2">
        {agent?.name ?? t('chat.defaultChatName')}
      </h2>
      <p className="text-xs text-center max-w-xs">
        {agent?.description ?? t('chat.sendToStart')}
      </p>
    </div>
  );
}

// -------------------------------------------------
// ChatError — תצוגת שגיאה משופרת
// -------------------------------------------------
interface ChatErrorProps {
  message: string;
  onDismiss: () => void;
  onRetry: () => void;
  isRetrying: boolean;
}

function ChatError({ message, onDismiss, onRetry, isRetrying }: ChatErrorProps) {
  const { t } = useTranslation();
  const category = categorizeError(message);
  const display = useErrorDisplay(category);

  return (
    <div
      role="alert"
      className="rounded-lg px-3 py-2.5 mt-2 animate-shake"
      dir="auto"
      style={{
        background: 'rgba(90, 29, 29, 0.75)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid var(--vscode-inputValidation-errorBorder, #be1100)',
        boxShadow: '0 4px 16px rgba(239, 68, 68, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
      }}
    >
      {/* שורה ראשונה — אייקון + קטגוריה + כפתור סגירה */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <span style={{ color: display.color }}>{display.icon}</span>
          <span
            className="text-xs font-medium"
            style={{ color: display.color }}
          >
            {display.label}
          </span>
        </div>

        {/* כפתור סגירה */}
        <button
          className="btn-ghost text-xs opacity-50 hover:opacity-100 p-0.5 leading-none"
          onClick={onDismiss}
          title={t('chat.closeError')}
          aria-label={t('chat.closeErrorAria')}
        >
          &#10005;
        </button>
      </div>

      {/* הודעת השגיאה */}
      <p className="text-xs opacity-80 mb-2 leading-relaxed">{message}</p>

      {/* כפתור ניסיון חוזר */}
      <div className="flex items-center gap-2">
        <RetryButton
          onRetry={onRetry}
          isRetrying={isRetrying}
          label={t('chat.retryLabel')}
        />

        {/* רמז לפי סוג השגיאה */}
        <span className="text-[10px] opacity-40">
          {category === 'network' && t('chat.errorHintNetwork')}
          {category === 'api' && t('chat.errorHintApi')}
          {category === 'tool' && t('chat.errorHintTool')}
        </span>
      </div>
    </div>
  );
}
