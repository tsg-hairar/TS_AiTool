// ===================================================
// TypingIndicator — אינדיקטור חשיבה / כתיבה
// ===================================================
// מוצג כש-Claude חושב או כותב תגובה.
// 3 נקודות מקפצות + טקסט סטטוס.
// מכבד prefers-reduced-motion דרך CSS.
// ===================================================

import React from 'react';
import { useTranslation } from 'react-i18next';

interface TypingIndicatorProps {
  /** הסטטוס הנוכחי — thinking / streaming */
  status: 'thinking' | 'streaming';
  /** הודעת סטטוס מותאמת (אופציונלי) */
  statusMessage?: string;
  /** זמן שעבר בשניות */
  elapsedSeconds?: number;
}

export function TypingIndicator({
  status,
  statusMessage,
  elapsedSeconds = 0,
}: TypingIndicatorProps) {
  const { t } = useTranslation();

  const formatElapsed = (s: number) => {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return min > 0 ? `${min}:${sec.toString().padStart(2, '0')}` : `${sec}s`;
  };

  const label =
    status === 'streaming'
      ? t('chat.writingResponseEllipsis')
      : statusMessage || t('chat.thinkingIndicator', { defaultValue: 'Claude \u05D7\u05D5\u05E9\u05D1...' });

  return (
    <div
      className="flex items-center gap-3 py-3 ps-3 pe-3 rounded-lg animate-fade-in"
      role="status"
      aria-live="polite"
      aria-label={label}
      style={{
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid var(--glass-border)',
        borderInlineStart: '3px solid var(--typing-agent-color, var(--vscode-textLink-foreground, #3b82f6))',
      }}
    >
      {/* 3 נקודות מקפצות */}
      <div className="typing-indicator-dots typing-dots-glow">
        <span className="typing-indicator-dot" />
        <span className="typing-indicator-dot" />
        <span className="typing-indicator-dot" />
      </div>

      {/* טקסט סטטוס */}
      <span className="text-xs opacity-60 animate-pulse-soft">
        {label}
      </span>

      {/* טיימר */}
      {elapsedSeconds > 2 && (
        <span className="text-[10px] opacity-30 font-mono ms-auto">
          {formatElapsed(elapsedSeconds)}
        </span>
      )}
    </div>
  );
}
