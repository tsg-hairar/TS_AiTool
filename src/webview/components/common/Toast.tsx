// ===================================================
// Toast — התראות popup
// ===================================================

import React, { useEffect } from 'react';
import { useApp } from '../../state/AppContext';

export function Toast() {
  const { state, dispatch } = useApp();

  // הסרה אוטומטית אחרי 5 שניות
  useEffect(() => {
    if (state.notifications.length === 0) return;

    const latest = state.notifications[state.notifications.length - 1];
    const timer = setTimeout(() => {
      dispatch({ type: 'REMOVE_NOTIFICATION', payload: latest.id });
    }, 5000);

    return () => clearTimeout(timer);
  }, [state.notifications, dispatch]);

  if (state.notifications.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 flex flex-col gap-2">
      {state.notifications.slice(-3).map((notification) => (
        <div
          key={notification.id}
          className="animate-fade-in rounded-lg px-4 py-3 text-sm shadow-lg flex items-start justify-between"
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
            <button className="btn-ghost text-xs mr-2">
              {notification.action.label}
            </button>
          )}

          {/* כפתור סגירה */}
          <button
            className="btn-ghost text-xs opacity-50 hover:opacity-100"
            onClick={() => dispatch({ type: 'REMOVE_NOTIFICATION', payload: notification.id })}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
