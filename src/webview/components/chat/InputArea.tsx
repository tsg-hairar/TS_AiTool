// ===================================================
// InputArea — שדה קלט הודעה
// ===================================================
// תומך בטקסט, תמונות, slash commands, ו-voice input
// ===================================================

import React, { useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../../state/AppContext';
import { TIMEOUTS } from '../../../shared/constants';

/** Detect image MIME type from base64 magic bytes */
function detectImageMime(base64: string): string {
  const h = base64.substring(0, 16);
  if (h.startsWith('/9j/')) return 'image/jpeg';
  if (h.startsWith('iVBOR')) return 'image/png';
  if (h.startsWith('R0lGO')) return 'image/gif';
  if (h.startsWith('UklGR')) return 'image/webp';
  if (h.startsWith('PHN2Z') || h.startsWith('PD94b')) return 'image/svg+xml';
  return 'image/png';
}

export function InputArea() {
  const { state, dispatch, sendMessage } = useApp();
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // טיימר debounce לשמירת טיוטה
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // -------------------------------------------------
  // שמירת טיוטה אוטומטית — debounced כל 3 שניות
  // -------------------------------------------------
  const saveDraftDebounced = useCallback(
    (text: string) => {
      if (draftTimerRef.current) {
        clearTimeout(draftTimerRef.current);
      }
      draftTimerRef.current = setTimeout(() => {
        // שליחה ל-Extension לשמירה ב-globalState
        // משתמשים בשיחה האחרונה (הפעילה) או מזהה כללי
        const conversationId = state.conversations.length > 0
          ? state.conversations[state.conversations.length - 1]?.id
          : 'default';
        if (conversationId && text.trim()) {
          sendMessage({
            type: 'saveDraft',
            payload: { conversationId, text },
          });
        }
      }, TIMEOUTS.DRAFT_SAVE_DEBOUNCE_MS);
    },
    [sendMessage, state.conversations],
  );

  // ניקוי טיימר בעת unmount
  useEffect(() => {
    return () => {
      if (draftTimerRef.current) {
        clearTimeout(draftTimerRef.current);
      }
    };
  }, []);

  // -------------------------------------------------
  // שליחת הודעה
  // -------------------------------------------------
  const handleSend = useCallback(() => {
    const text = state.inputText.trim();
    if (!text && state.imageAttachments.length === 0) return;
    if (state.status === 'thinking' || state.status === 'streaming') return;

    // בדיקת אופליין — אם אין חיבור, מוסיפים לתור
    if (state.isOffline) {
      dispatch({
        type: 'QUEUE_MESSAGE',
        payload: {
          content: text,
          images: state.imageAttachments.length > 0 ? state.imageAttachments : undefined,
        },
      });
      dispatch({ type: 'SET_INPUT', payload: '' });
      dispatch({ type: 'CLEAR_IMAGES' });
      textareaRef.current?.focus();
      return;
    }

    // בדיקה אם זה slash command
    if (text.startsWith('/')) {
      const [command, ...args] = text.split(' ');
      sendMessage({
        type: 'slashCommand',
        payload: { command, args: args.join(' ') || undefined },
      });
    } else {
      // הודעה רגילה
      sendMessage({
        type: 'sendMessage',
        payload: {
          content: text,
          images: state.imageAttachments.length > 0 ? state.imageAttachments : undefined,
        },
      });
    }

    // ניקוי
    dispatch({ type: 'SET_INPUT', payload: '' });
    dispatch({ type: 'CLEAR_IMAGES' });

    // התמקדות חזרה בשדה הקלט
    textareaRef.current?.focus();
  }, [state.inputText, state.imageAttachments, state.status, dispatch, sendMessage]);

  // -------------------------------------------------
  // מקש Enter — שליחה, Shift+Enter — שורה חדשה
  // -------------------------------------------------
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  // -------------------------------------------------
  // גרירת תמונות
  // -------------------------------------------------
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files);

      // גודל מקסימלי: 5MB — תמונות גדולות יותר יגרמו לבעיות
      const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

      for (const file of files) {
        if (!file.type.startsWith('image/')) continue;

        // בדיקת גודל קובץ
        if (file.size > MAX_IMAGE_SIZE) {
          dispatch({
            type: 'SET_ERROR',
            payload: t('input.imageTooLarge', {
              name: file.name,
              size: (file.size / 1024 / 1024).toFixed(1),
            }),
          });
          continue;
        }

        const reader = new FileReader();
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          dispatch({ type: 'ADD_IMAGE', payload: base64 });
        };
        reader.readAsDataURL(file);
      }
    },
    [dispatch, t],
  );

  const isBusy = state.status === 'thinking' || state.status === 'streaming';

  return (
    <div
      role="form"
      aria-label={t('input.ariaLabel')}
      className="border-t px-3 py-2 transition-smooth"
      style={{
        borderColor: 'var(--vscode-panel-border)',
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
      onDrop={handleDrop}
      onDragOver={(e) => {
        e.preventDefault();
        e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
        e.currentTarget.style.background = 'rgba(59, 130, 246, 0.05)';
      }}
      onDragLeave={(e) => {
        e.currentTarget.style.borderColor = '';
        e.currentTarget.style.background = 'var(--glass-bg)';
      }}
    >
      {/* תמונות מצורפות */}
      {state.imageAttachments.length > 0 && (
        <div className="flex gap-2 mb-2 flex-wrap">
          {state.imageAttachments.map((img, i) => (
            <div key={i} className="relative group animate-scale-in">
              <img
                src={`data:${detectImageMime(img)};base64,${img}`}
                alt={`Attachment ${i + 1}`}
                className="w-16 h-16 object-cover"
                style={{
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-md)',
                  border: '1px solid var(--glass-border)',
                }}
              />
              <button
                className="absolute -top-1.5 -start-1.5 w-5 h-5 bg-red-500 rounded-full text-white text-[8px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-110"
                onClick={() => dispatch({ type: 'REMOVE_IMAGE', payload: i })}
                aria-label={t('input.removeImageAria', { index: i + 1 })}
                style={{ boxShadow: '0 2px 8px rgba(239, 68, 68, 0.4)' }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* שדה הקלט */}
      <span id="file-size-limit" className="sr-only">{t('input.fileSizeLimit')}</span>
      <div className="flex items-end gap-2 focus-ring" style={{ borderRadius: 'var(--radius-md)', padding: '2px' }}>
        <textarea
          ref={textareaRef}
          className="input-field resize-none min-h-[36px] max-h-[120px]"
          aria-label={t('input.chatAriaLabel')}
          aria-describedby="file-size-limit"
          placeholder={isBusy ? t('input.placeholderBusy') : t('input.placeholder')}
          value={state.inputText}
          onChange={(e) => {
            dispatch({ type: 'SET_INPUT', payload: e.target.value });
            // שמירת טיוטה אוטומטית
            saveDraftDebounced(e.target.value);
            // Auto-resize
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
          }}
          onKeyDown={handleKeyDown}
          disabled={isBusy}
          rows={1}
          dir="auto"
          style={{ borderRadius: 'var(--radius-md)' }}
        />

        {/* כפתורים */}
        <div className="flex gap-1 pb-0.5">
          {/* ביטול (כשעסוק) */}
          {isBusy ? (
            <button
              className="btn-ghost text-red-400 animate-fade-in animate-pulse-red-glow"
              onClick={() => sendMessage({ type: 'cancelRequest' })}
              title={t('input.cancelRequest')}
              aria-label={t('input.cancelRequestAria')}
              style={{
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
              }}
            >
              ⏹
            </button>
          ) : (
            <>
              {/* שליחה */}
              <button
                className="btn-primary px-3 py-1.5 transition-all duration-200"
                onClick={handleSend}
                disabled={!state.inputText.trim() && state.imageAttachments.length === 0}
                title={t('input.send')}
                aria-label={t('input.sendAria')}
                style={{
                  borderRadius: 'var(--radius-md)',
                  boxShadow: (state.inputText.trim() || state.imageAttachments.length > 0)
                    ? '0 0 12px rgba(59, 130, 246, 0.3), 0 0 4px rgba(59, 130, 246, 0.15)'
                    : 'none',
                }}
              >
                ▶
              </button>
            </>
          )}
        </div>
      </div>

      {/* Character counter */}
      <span className="text-xs" style={{ opacity: 0.5 }}>
        {state.inputText.length > 0 ? `${state.inputText.length} תווים` : ''}
      </span>

      {/* רמז — slash commands */}
      {state.inputText.startsWith('/') && (
        <div
          className="mt-1 text-[10px] opacity-40 animate-fade-in glass-subtle"
          style={{ padding: '4px 8px', borderRadius: 'var(--radius-sm)', display: 'inline-block' }}
        >
          {t('input.slashHint')}
        </div>
      )}
    </div>
  );
}
