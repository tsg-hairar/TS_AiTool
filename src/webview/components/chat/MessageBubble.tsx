// ===================================================
// MessageBubble — בועת הודעה בודדת
// ===================================================
// מציגה הודעת user/assistant עם Markdown, קוד, וכלים
// ===================================================

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pin } from 'lucide-react';
import type { ChatMessage } from '../../../shared/types';
import { useApp } from '../../state/AppContext';
import { renderMarkdown, attachCopyHandlers } from '../../utils/markdown';
import { highlightSearchText } from './SearchBar';
import { memoize } from '../../../shared/utils/performance';

interface MessageBubbleProps {
  message: ChatMessage;
  /** שאילתת חיפוש פעילה (ריק = לא מחפש) */
  searchQuery?: string;
  /** האם ההודעה תואמת לחיפוש */
  isSearchMatch?: boolean;
  /** האם ההודעה היא התוצאה הנוכחית */
  isCurrentSearchMatch?: boolean;
}

export const MessageBubble = React.memo(function MessageBubble({
  message,
  searchQuery = '',
  isSearchMatch = false,
  isCurrentSearchMatch = false,
}: MessageBubbleProps) {
  const { sendMessage } = useApp();
  const { t } = useTranslation();
  const [showActions, setShowActions] = useState(false);

  const contentRef = useRef<HTMLDivElement>(null);
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  // Render markdown content (memoized to avoid re-parsing on every render)
  // כשיש חיפוש פעיל — מדגישים את הטקסט התואם
  const renderedHtml = useMemo(() => {
    const html = renderMarkdown(message.content);
    if (searchQuery.trim() && isSearchMatch) {
      return highlightSearchText(html, searchQuery);
    }
    return html;
  }, [message.content, searchQuery, isSearchMatch]);

  // Attach copy handlers after DOM update
  useEffect(() => {
    if (contentRef.current) {
      attachCopyHandlers(contentRef.current);
    }
  }, [renderedHtml]);

  // סוכן שנתן את התשובה
  const agentIcon = message.agentId
    ? { manager: '👔', architect: '🏗️', developer: '💻', qa: '🧪', designer: '🎨', security: '🔒', writer: '✍️' }[message.agentId]
    : '🤖';

  const senderName = isUser ? t('message.you') : isSystem ? t('message.system') : message.agentId ?? 'AI';
  const timeStr = formatTime(message.timestamp);

  return (
    <div
      role="article"
      aria-label={t('message.ariaLabel', { sender: senderName, time: timeStr })}
      className={`mb-3 transition-all duration-200 ${
        isUser ? 'message-enter-user' : 'message-enter-assistant'
      }`}
      style={{
        // הדגשה ויזואלית כשההודעה תואמת חיפוש
        ...(isCurrentSearchMatch
          ? {
              outline: '2px solid rgba(255, 213, 79, 0.6)',
              outlineOffset: '2px',
              borderRadius: '8px',
            }
          : isSearchMatch
          ? {
              outline: '1px solid rgba(255, 213, 79, 0.25)',
              outlineOffset: '2px',
              borderRadius: '8px',
            }
          : {}),
      }}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* כותרת הודעה */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs">
          {isUser ? '👤' : isSystem ? 'ℹ️' : agentIcon}
        </span>
        <span className="text-[10px] font-medium opacity-50">
          {senderName}
        </span>
        <span className="text-[10px] opacity-30">
          {timeStr}
        </span>

        {/* אינדיקטור streaming — מראה שהתגובה נכתבת */}
        {message.isStreaming && (
          <span
            className="text-[10px] text-blue-400 flex items-center gap-1.5 rounded-full"
            style={{
              background: 'rgba(59, 130, 246, 0.1)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
              padding: '2px 8px',
            }}
          >
            <span
              className="inline-block w-1.5 h-1.5 rounded-full animate-ping"
              style={{ background: 'var(--gradient-primary)', backgroundColor: '#3b82f6' }}
            />
            <span className="animate-pulse-soft">
              {message.content.length > 0 ? t('message.writing') : t('message.starting')}
            </span>
            {/* מספר תווים שכבר נכתבו */}
            {message.content.length > 0 && (
              <span className="opacity-40 font-mono">
                ({message.content.length})
              </span>
            )}
          </span>
        )}

        {/* כפתורי פעולה */}
        {showActions && !isSystem && (
          <div className="flex gap-1 ms-auto animate-fade-in">
            {/* העתקה */}
            <button
              className="btn-ghost text-[10px] transition-all duration-200 hover:scale-110"
              onClick={() => navigator.clipboard.writeText(message.content)}
              title={t('message.copy')}
              aria-label={t('message.copyAria')}
              style={{ borderRadius: 'var(--radius-sm)' }}
            >
              📋
            </button>

            {/* סימנייה */}
            <button
              className="btn-ghost text-[10px] transition-all duration-200 hover:scale-110"
              onClick={() => sendMessage({ type: 'toggleBookmark', payload: { messageId: message.id } })}
              title={message.isBookmarked ? t('message.bookmarkRemove') : t('message.bookmarkAdd')}
              aria-label={message.isBookmarked ? t('message.bookmarkRemoveAria') : t('message.bookmarkAddAria')}
              style={{
                borderRadius: 'var(--radius-sm)',
                boxShadow: message.isBookmarked ? '0 0 8px rgba(245, 158, 11, 0.3)' : undefined,
              }}
            >
              {message.isBookmarked ? '⭐' : '☆'}
            </button>

            {/* הצמדה — Lucide Pin icon */}
            <button
              className="btn-ghost text-[10px] transition-all duration-200 hover:scale-110"
              onClick={() => sendMessage({ type: 'togglePin', payload: { messageId: message.id } })}
              title={message.isPinned ? t('message.pinRemove') : t('message.pinAdd')}
              aria-label={message.isPinned ? t('message.pinRemoveAria') : t('message.pinAddAria')}
              style={{
                transform: message.isPinned ? 'rotate(-45deg)' : 'none',
                borderRadius: 'var(--radius-sm)',
                boxShadow: message.isPinned ? '0 0 8px rgba(245, 158, 11, 0.3)' : undefined,
              }}
            >
              <Pin
                size={13}
                className="transition-colors duration-200"
                style={{
                  color: message.isPinned ? 'var(--agent-qa)' : 'var(--vscode-foreground)',
                  fill: message.isPinned ? 'var(--agent-qa)' : 'none',
                  opacity: message.isPinned ? 1 : 0.6,
                }}
              />
            </button>
          </div>
        )}
      </div>

      {/* תוכן ההודעה */}
      <div
        className={`rounded-lg px-3 py-2 text-sm leading-relaxed transition-all duration-300 ${
          isUser
            ? 'me-4'
            : isSystem
            ? 'opacity-70'
            : 'ms-4'
        }`}
        style={{
          background: message.isPinned
            ? 'rgba(245, 158, 11, 0.06)'
            : isUser
            ? 'rgba(59, 130, 246, 0.08)'
            : isSystem
            ? 'rgba(255, 255, 255, 0.03)'
            : 'rgba(255, 255, 255, 0.04)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          borderInlineEnd: isUser
            ? '2px solid rgba(59, 130, 246, 0.5)'
            : undefined,
          borderInlineStart: message.isPinned
            ? '3px solid rgba(245, 158, 11, 0.7)'
            : !isUser && !isSystem
            ? `3px solid var(--agent-${message.agentId ?? ''}, #666)`
            : undefined,
          boxShadow: message.isPinned
            ? '0 0 12px rgba(245, 158, 11, 0.1), var(--shadow-sm)'
            : 'var(--shadow-sm)',
        }}
      >
        {/* Markdown content — parsed with marked + highlight.js */}
        <div
          ref={contentRef}
          className="markdown-content break-words"
          dangerouslySetInnerHTML={{ __html: renderedHtml }}
        />

        {/* תמונות מצורפות */}
        {message.images && message.images.length > 0 && (
          <div className="flex gap-2 mt-2">
            {message.images.map((img) => (
              <img
                key={img.id}
                src={`data:${img.mimeType};base64,${img.data}`}
                alt={img.name}
                className="max-w-[200px] max-h-[150px] rounded-md"
              />
            ))}
          </div>
        )}

        {/* שימוש בכלים */}
        {message.toolUses && message.toolUses.length > 0 && (
          <div className="mt-2 border-t pt-2" style={{ borderColor: 'rgba(255, 255, 255, 0.06)' }}>
            {message.toolUses.map((tool) => (
              <div
                key={tool.id}
                className="tool-indicator flex items-center gap-2 text-[10px] py-1.5 mb-1 animate-slide-up"
                style={{
                  opacity: tool.status === 'completed' ? 0.8 : 1,
                  borderInlineStart: `2px solid ${
                    tool.status === 'completed'
                      ? 'var(--agent-developer)'
                      : tool.status === 'running'
                      ? 'var(--agent-qa)'
                      : 'var(--agent-architect)'
                  }`,
                }}
              >
                <span>
                  {tool.status === 'completed' ? '✅' : tool.status === 'running' ? '⏳' : '🔧'}
                </span>
                <span className="font-mono font-medium">{tool.name}</span>
                {tool.output && (
                  <span className="truncate max-w-[200px] opacity-60">{tool.output}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* טוקנים */}
      {message.tokenCount && !isUser && (
        <div className="text-[9px] opacity-30 mt-1 me-5">
          {message.tokenCount.toLocaleString()} {t('message.tokens')}
        </div>
      )}
    </div>
  );
});

// -------------------------------------------------
// Helpers
// -------------------------------------------------

// Memoized helpers — מונעים חישוב חוזר
const formatTime = memoize((timestamp: string): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
});
