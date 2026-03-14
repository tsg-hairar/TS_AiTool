// ===================================================
// ConfirmDialog — דיאלוג אישור כללי
// ===================================================
// דיאלוג מודאלי לאישור פעולות — מחיקה, ניקוי וכו'
// תומך RTL, נגישות (alertdialog), ווריאנטים צבעוניים
// ===================================================

import React, { useEffect, useRef, useCallback } from 'react';

// -------------------------------------------------
// Props
// -------------------------------------------------
interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}

// -------------------------------------------------
// צבעי וריאנטים
// -------------------------------------------------
const VARIANT_STYLES = {
  danger: {
    confirmBg: '#dc2626',
    confirmHover: '#b91c1c',
    confirmText: '#ffffff',
    icon: '⚠️',
  },
  warning: {
    confirmBg: '#d97706',
    confirmHover: '#b45309',
    confirmText: '#ffffff',
    icon: '⚡',
  },
  info: {
    confirmBg: 'var(--vscode-button-background)',
    confirmHover: 'var(--vscode-button-hoverBackground)',
    confirmText: 'var(--vscode-button-foreground)',
    icon: 'ℹ️',
  },
};

// -------------------------------------------------
// Component
// -------------------------------------------------
export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'אישור',
  cancelLabel = 'ביטול',
  variant = 'info',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  const styles = VARIANT_STYLES[variant];

  // -------------------------------------------------
  // Focus trap + keyboard handling
  // -------------------------------------------------
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        onConfirm();
        return;
      }

      // Focus trap — Tab cycles between cancel and confirm
      if (e.key === 'Tab') {
        e.preventDefault();
        const active = document.activeElement;
        if (active === confirmBtnRef.current) {
          cancelBtnRef.current?.focus();
        } else {
          confirmBtnRef.current?.focus();
        }
      }
    },
    [isOpen, onCancel, onConfirm],
  );

  // רישום listener למקלדת
  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  // פוקוס אוטומטי על כפתור ביטול כשנפתח
  useEffect(() => {
    if (isOpen) {
      // timeout קטן כדי לתת ל-DOM להתרנדר
      const timer = setTimeout(() => cancelBtnRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // לא מרנדרים אם סגור
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backdropFilter: 'blur(2px)' }}
      onClick={(e) => {
        // סגירה בלחיצה על backdrop
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      {/* רקע כהה — backdrop fade */}
      <div className="dialog-backdrop absolute inset-0 bg-black/50 animate-backdrop-in" />

      {/* הדיאלוג עצמו */}
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        dir="rtl"
        className="dialog-content relative w-80 max-w-[90vw] rounded-lg shadow-2xl p-5 animate-dialog-in"
        style={{
          background: 'var(--vscode-editor-background)',
          border: '1px solid var(--vscode-panel-border)',
        }}
      >
        {/* כותרת */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">{styles.icon}</span>
          <h3
            id="confirm-dialog-title"
            className="text-sm font-semibold"
            style={{ color: 'var(--vscode-foreground)' }}
          >
            {title}
          </h3>
        </div>

        {/* הודעה */}
        <p
          id="confirm-dialog-message"
          className="text-xs leading-relaxed mb-5"
          style={{ color: 'var(--vscode-descriptionForeground)' }}
        >
          {message}
        </p>

        {/* כפתורי פעולה */}
        <div className="flex gap-2 justify-start">
          {/* כפתור אישור */}
          <button
            ref={confirmBtnRef}
            className="px-4 py-1.5 text-xs rounded font-medium transition-smooth click-shrink"
            style={{
              background: styles.confirmBg,
              color: styles.confirmText,
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLButtonElement).style.background = styles.confirmHover;
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLButtonElement).style.background = styles.confirmBg;
            }}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>

          {/* כפתור ביטול */}
          <button
            ref={cancelBtnRef}
            className="px-4 py-1.5 text-xs rounded transition-smooth click-shrink"
            style={{
              background: 'var(--vscode-button-secondaryBackground)',
              color: 'var(--vscode-button-secondaryForeground)',
            }}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
        </div>
      </div>

      {/* Animation keyframes moved to globals.css (animate-dialog-in) */}
    </div>
  );
}
