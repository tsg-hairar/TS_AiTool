// ===================================================
// Toast — התראות popup
// ===================================================

import React, { useEffect, useState, useCallback } from 'react';
import { useApp } from '../../state/AppContext';

export function Toast() {
  const { state, dispatch, sendMessage } = useApp();
  const [exitingIds, setExitingIds] = useState<Set<string>>(new Set());

  // Dismiss with exit animation
  const dismissToast = useCallback(
    (id: string) => {
      setExitingIds((prev) => new Set(prev).add(id));
      // Wait for exit animation to complete before removing
      setTimeout(() => {
        dispatch({ type: 'REMOVE_NOTIFICATION', payload: id });
        setExitingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, 300);
    },
    [dispatch],
  );

  // הסרה אוטומטית אחרי 5 שניות
  useEffect(() => {
    if (state.notifications.length === 0) return;

    const latest = state.notifications[state.notifications.length - 1];
    const timer = setTimeout(() => {
      dismissToast(latest.id);
    }, 5000);

    return () => clearTimeout(timer);
  }, [state.notifications, dismissToast]);

  if (state.notifications.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 flex flex-col gap-2" role="region" aria-live="polite">
      {state.notifications.slice(-3).map((notification) => (
        <div
          key={notification.id}
          role="alert"
          className={`${exitingIds.has(notification.id) ? 'toast-exit' : 'toast-enter'} rounded-lg px-4 py-3 text-sm shadow-lg flex items-start justify-between`}
          style={{
            background: notification.type === 'error'
              ? 'var(--vscode-inputValidation-errorBackground, #5a1d1d)'
              : notification.type === 'warning'
              ? 'var(--vscode-inputValidation-warningBackground, #5a4a1d)'
              : notification.type === 'success'
              ? '#1a3a2a'
              : 'var(--vscode-input-background)',
            border: `1px solid ${
              notification.type === 'error'
                ? 'var(--vscode-inputValidation-errorBorder, #be1100)'
                : notification.type === 'warning'
                ? 'var(--vscode-inputValidation-warningBorder, #be8c00)'
                : 'var(--vscode-panel-border)'
            }`,
          }}
        >
          <div className="flex-1">
            <div className="font-medium">{notification.title}</div>
            <div className="opacity-80 text-xs mt-1">{notification.message}</div>
          </div>

          {/* כפתור פעולה */}
          {notification.action && (
            <button
              className="btn-ghost text-xs mr-2"
              onClick={() => {
                // שליחת הפקודה ל-extension
                if (notification.action?.command) {
                  sendMessage({ type: 'executeCommand', payload: { command: notification.action.command } } as never);
                }
                dismissToast(notification.id);
              }}
            >
              {notification.action.label}
            </button>
          )}

          {/* כפתור סגירה */}
          <button
            className="btn-ghost text-xs opacity-50 hover:opacity-100"
            onClick={() => dismissToast(notification.id)}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
