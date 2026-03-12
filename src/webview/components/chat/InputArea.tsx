// ===================================================
// InputArea — שדה קלט הודעה
// ===================================================
// תומך בטקסט, תמונות, slash commands, ו-voice input
// ===================================================

import React, { useRef, useCallback } from 'react';
import { useApp } from '../../state/AppContext';

export function InputArea() {
  const { state, dispatch, sendMessage } = useApp();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // -------------------------------------------------
  // שליחת הודעה
  // -------------------------------------------------
  const handleSend = useCallback(() => {
    const text = state.inputText.trim();
    if (!text && state.imageAttachments.length === 0) return;
    if (state.status === 'thinking' || state.status === 'streaming') return;

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

      for (const file of files) {
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = () => {
            const base64 = (reader.result as string).split(',')[1];
            dispatch({ type: 'ADD_IMAGE', payload: base64 });
          };
          reader.readAsDataURL(file);
        }
      }
    },
    [dispatch],
  );

  const isBusy = state.status === 'thinking' || state.status === 'streaming';

  return (
    <div
      className="border-t px-3 py-2"
      style={{ borderColor: 'var(--vscode-panel-border)' }}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      {/* תמונות מצורפות */}
      {state.imageAttachments.length > 0 && (
        <div className="flex gap-2 mb-2 flex-wrap">
          {state.imageAttachments.map((img, i) => (
            <div key={i} className="relative group">
              <img
                src={`data:image/png;base64,${img}`}
                alt={`Attachment ${i + 1}`}
                className="w-16 h-16 object-cover rounded-md"
              />
              <button
                className="absolute -top-1 -left-1 w-4 h-4 bg-red-500 rounded-full text-white text-[8px] flex items-center justify-center opacity-0 group-hover:opacity-100"
                onClick={() => dispatch({ type: 'REMOVE_IMAGE', payload: i })}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* שדה הקלט */}
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          className="input-field resize-none min-h-[36px] max-h-[120px]"
          placeholder={isBusy ? 'ממתין לתגובה...' : 'הקלד הודעה... (/ לפקודות)'}
          value={state.inputText}
          onChange={(e) => {
            dispatch({ type: 'SET_INPUT', payload: e.target.value });
            // Auto-resize
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
          }}
          onKeyDown={handleKeyDown}
          disabled={isBusy}
          rows={1}
          dir="auto"
        />

        {/* כפתורים */}
        <div className="flex gap-1 pb-0.5">
          {/* ביטול (כשעסוק) */}
          {isBusy ? (
            <button
              className="btn-ghost text-red-400"
              onClick={() => sendMessage({ type: 'cancelRequest' })}
              title="ביטול"
            >
              ⏹
            </button>
          ) : (
            <>
              {/* שליחה */}
              <button
                className="btn-primary px-3 py-1.5"
                onClick={handleSend}
                disabled={!state.inputText.trim() && state.imageAttachments.length === 0}
                title="שלח (Enter)"
              >
                ▶
              </button>
            </>
          )}
        </div>
      </div>

      {/* רמז — slash commands */}
      {state.inputText.startsWith('/') && (
        <div
          className="mt-1 text-[10px] opacity-40"
        >
          💡 /help — רשימת פקודות | /review — סקירת קוד | /fix — תיקון באגים
        </div>
      )}
    </div>
  );
}
