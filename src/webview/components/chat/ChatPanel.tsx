// ===================================================
// ChatPanel — פאנל צ'אט ראשי
// ===================================================
// מציג הודעות, סוכנים, ושדה קלט
// ===================================================

import React, { useRef, useEffect } from 'react';
import { useApp } from '../../state/AppContext';
import { MessageBubble } from './MessageBubble';
import { InputArea } from './InputArea';
import { AgentTabs } from '../agents/AgentTabs';

export function ChatPanel() {
  const { state } = useApp();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // גלילה אוטומטית למטה כשמתווספת הודעה
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.messages]);

  // הודעות מוצמדות (pinned) — מוצגות למעלה
  const pinnedMessages = state.messages.filter((m) => m.isPinned);
  const regularMessages = state.messages.filter((m) => !m.isPinned);

  return (
    <div className="flex flex-col h-full">
      {/* טאבים של סוכנים */}
      <AgentTabs />

      {/* הודעות מוצמדות */}
      {pinnedMessages.length > 0 && (
        <div
          className="px-3 py-2 border-b text-xs"
          style={{ borderColor: 'var(--vscode-panel-border)', background: 'rgba(255,255,255,0.02)' }}
        >
          <div className="font-medium mb-1 opacity-60">📌 הודעות מוצמדות</div>
          {pinnedMessages.map((msg) => (
            <div key={msg.id} className="truncate opacity-70 mb-0.5">
              {msg.content.slice(0, 100)}
            </div>
          ))}
        </div>
      )}

      {/* אזור הודעות — גלילה */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        {regularMessages.length === 0 ? (
          <WelcomeMessage />
        ) : (
          regularMessages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))
        )}

        {/* אינדיקטור "חושב..." */}
        {state.status === 'thinking' && (
          <div className="flex items-center gap-2 py-3 animate-fade-in">
            <div className="thinking-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <span className="text-xs opacity-50">חושב...</span>
          </div>
        )}

        {/* שגיאה */}
        {state.errorMessage && (
          <div
            className="rounded-md px-3 py-2 text-xs mt-2 animate-fade-in"
            style={{
              background: 'var(--vscode-inputValidation-errorBackground)',
              border: '1px solid var(--vscode-inputValidation-errorBorder)',
            }}
          >
            ❌ {state.errorMessage}
          </div>
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
  const agent = state.agents.find((a) => a.id === state.activeAgentId);

  return (
    <div className="flex flex-col items-center justify-center py-12 opacity-60">
      <div className="text-3xl mb-3">{agent?.icon ?? '💬'}</div>
      <h2 className="text-sm font-medium mb-1">
        {agent?.name ?? 'צ\'אט'}
      </h2>
      <p className="text-xs text-center max-w-xs">
        {agent?.description ?? 'שלח הודעה כדי להתחיל'}
      </p>
    </div>
  );
}
