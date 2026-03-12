// ===================================================
// MessageBubble — בועת הודעה בודדת
// ===================================================
// מציגה הודעת user/assistant עם Markdown, קוד, וכלים
// ===================================================

import React, { useState } from 'react';
import type { ChatMessage } from '../../../shared/types';
import { useApp } from '../../state/AppContext';

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const { sendMessage } = useApp();
  const [showActions, setShowActions] = useState(false);

  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  // סוכן שנתן את התשובה
  const agentIcon = message.agentId
    ? { manager: '👔', architect: '🏗️', developer: '💻', qa: '🧪', designer: '🎨', security: '🔒', writer: '✍️' }[message.agentId]
    : '🤖';

  return (
    <div
      className={`mb-3 animate-fade-in ${isUser ? '' : ''}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* כותרת הודעה */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs">
          {isUser ? '👤' : isSystem ? 'ℹ️' : agentIcon}
        </span>
        <span className="text-[10px] font-medium opacity-50">
          {isUser ? 'אתה' : isSystem ? 'מערכת' : message.agentId ?? 'AI'}
        </span>
        <span className="text-[10px] opacity-30">
          {formatTime(message.timestamp)}
        </span>

        {/* אינדיקטור streaming */}
        {message.isStreaming && (
          <span className="text-[10px] text-blue-400 animate-pulse-soft">
            streaming...
          </span>
        )}

        {/* כפתורי פעולה */}
        {showActions && !isSystem && (
          <div className="flex gap-1 mr-auto">
            {/* העתקה */}
            <button
              className="btn-ghost text-[10px]"
              onClick={() => navigator.clipboard.writeText(message.content)}
              title="העתק"
            >
              📋
            </button>

            {/* סימנייה */}
            <button
              className="btn-ghost text-[10px]"
              onClick={() => sendMessage({ type: 'toggleBookmark', payload: { messageId: message.id } })}
              title={message.isBookmarked ? 'הסר סימנייה' : 'סמן'}
            >
              {message.isBookmarked ? '⭐' : '☆'}
            </button>

            {/* הצמדה */}
            <button
              className="btn-ghost text-[10px]"
              onClick={() => sendMessage({ type: 'togglePin', payload: { messageId: message.id } })}
              title={message.isPinned ? 'בטל הצמדה' : 'הצמד'}
            >
              {message.isPinned ? '📌' : '📎'}
            </button>
          </div>
        )}
      </div>

      {/* תוכן ההודעה */}
      <div
        className={`rounded-lg px-3 py-2 text-sm leading-relaxed ${
          isUser
            ? 'mr-4'
            : isSystem
            ? 'opacity-70'
            : 'ml-4'
        }`}
        style={{
          background: isUser
            ? 'rgba(59, 130, 246, 0.1)'
            : isSystem
            ? 'rgba(255, 255, 255, 0.03)'
            : 'rgba(255, 255, 255, 0.05)',
          borderRight: isUser
            ? '2px solid rgba(59, 130, 246, 0.5)'
            : undefined,
          borderLeft: !isUser && !isSystem
            ? `2px solid ${getAgentColor(message.agentId)}`
            : undefined,
        }}
      >
        {/* Markdown content — לעת עתה טקסט פשוט */}
        <div className="markdown-content whitespace-pre-wrap break-words">
          {renderContent(message.content)}
        </div>

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
          <div className="mt-2 border-t pt-2" style={{ borderColor: 'var(--vscode-panel-border)' }}>
            {message.toolUses.map((tool) => (
              <div key={tool.id} className="flex items-center gap-2 text-[10px] py-1 opacity-70">
                <span>
                  {tool.status === 'completed' ? '✅' : tool.status === 'running' ? '⏳' : '🔧'}
                </span>
                <span className="font-mono">{tool.name}</span>
                {tool.output && (
                  <span className="truncate max-w-[200px]">{tool.output}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* טוקנים */}
      {message.tokenCount && !isUser && (
        <div className="text-[9px] opacity-30 mt-1 mr-5">
          {message.tokenCount.toLocaleString()} tokens
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------
// Helpers
// -------------------------------------------------

/** רינדור תוכן — מפרק בלוקים של קוד */
function renderContent(content: string): React.ReactNode {
  // פיצול לפי בלוקים של קוד (```)
  const parts = content.split(/(```[\s\S]*?```)/g);

  return parts.map((part, i) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      // בלוק קוד
      const lines = part.slice(3, -3);
      const firstNewline = lines.indexOf('\n');
      const language = firstNewline > 0 ? lines.slice(0, firstNewline).trim() : '';
      const code = firstNewline > 0 ? lines.slice(firstNewline + 1) : lines;

      return (
        <pre key={i} className="my-2 relative group">
          {language && (
            <span className="absolute top-1 left-1 text-[9px] opacity-40">
              {language}
            </span>
          )}
          <button
            className="absolute top-1 right-1 text-[9px] opacity-0 group-hover:opacity-100 btn-ghost"
            onClick={() => navigator.clipboard.writeText(code)}
          >
            📋
          </button>
          <code>{code}</code>
        </pre>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}

function getAgentColor(agentId?: string): string {
  const colors: Record<string, string> = {
    manager: '#8b5cf6',
    architect: '#06b6d4',
    developer: '#10b981',
    qa: '#f59e0b',
    designer: '#ec4899',
    security: '#ef4444',
    writer: '#6366f1',
  };
  return agentId ? colors[agentId] ?? '#666' : '#666';
}
