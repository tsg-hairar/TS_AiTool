// ===================================================
// RetryButton — כפתור ניסיון חוזר
// ===================================================
// כפתור עם מצב טעינה, לשימוש חוזר בכל מקום
// ===================================================

import React from 'react';
import { useTranslation } from 'react-i18next';

interface RetryButtonProps {
  /** פונקציה שנקראת בלחיצה */
  onRetry: () => void;
  /** טקסט הכפתור — ברירת מחדל מ-i18n */
  label?: string;
  /** האם בתהליך ניסיון חוזר */
  isRetrying?: boolean;
  /** className נוסף */
  className?: string;
}

export function RetryButton({
  onRetry,
  label,
  isRetrying = false,
  className = '',
}: RetryButtonProps) {
  const { t } = useTranslation();
  const displayLabel = label ?? t('retry.defaultLabel');

  return (
    <button
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-all ${
        isRetrying
          ? 'opacity-60 cursor-not-allowed'
          : 'hover:opacity-90 active:scale-95'
      } ${className}`}
      style={{
        background: 'var(--vscode-button-background, #0e639c)',
        color: 'var(--vscode-button-foreground, #ffffff)',
        border: 'none',
      }}
      onClick={onRetry}
      disabled={isRetrying}
      dir="auto"
    >
      {isRetrying ? (
        <>
          {/* ספינר טעינה */}
          <span
            className="inline-block w-3 h-3 border-2 rounded-full animate-spin"
            style={{
              borderColor: 'var(--vscode-button-foreground, #ffffff)',
              borderTopColor: 'transparent',
            }}
          />
          <span>{t('retry.retrying')}</span>
        </>
      ) : (
        <>
          <span>&#8635;</span>
          <span>{displayLabel}</span>
        </>
      )}
    </button>
  );
}
