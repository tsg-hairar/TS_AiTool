// ===================================================
// AgentTabs — טאבים להחלפת סוכנים
// ===================================================
// כל סוכן = טאב עם אייקון וצבע ייחודי
// לחיצה על טאב = מעבר לסוכן + צ'אט נפרד
// ===================================================

import React, { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../../state/AppContext';

/**
 * Convert a hex color string to an "r,g,b" string for use in rgba().
 * Handles 3-digit (#abc), 6-digit (#aabbcc), with or without leading #.
 * Returns "255,255,255" as fallback for invalid values.
 */
function hexToRgb(hex: string): string {
  try {
    let h = hex.replace(/^#/, '');
    if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(h)) {
      return '255,255,255';
    }
    // Expand 3-digit hex to 6-digit
    if (h.length === 3) {
      h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    }
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) {
      return '255,255,255';
    }
    return `${r},${g},${b}`;
  } catch {
    return '255,255,255';
  }
}

export function AgentTabs() {
  const { state, dispatch, sendMessage } = useApp();
  const { t } = useTranslation();
  const tabListRef = useRef<HTMLDivElement>(null);

  // Keyboard navigation: arrow keys move between agent tabs
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const agentIds = state.agents.map((a) => a.id);
      const currentIndex = agentIds.indexOf(state.activeAgentId);
      let nextIndex = -1;

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        nextIndex = (currentIndex + 1) % agentIds.length;
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        nextIndex = (currentIndex - 1 + agentIds.length) % agentIds.length;
      } else if (e.key === 'Home') {
        e.preventDefault();
        nextIndex = 0;
      } else if (e.key === 'End') {
        e.preventDefault();
        nextIndex = agentIds.length - 1;
      }

      if (nextIndex >= 0) {
        sendMessage({ type: 'switchAgent', payload: { agentId: agentIds[nextIndex] } });
        // Focus the newly active tab button
        const buttons = tabListRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
        buttons?.[nextIndex]?.focus();
      }
    },
    [state.agents, state.activeAgentId, sendMessage],
  );

  if (state.agents.length === 0) return null;

  return (
    <div
      ref={tabListRef}
      role="tablist"
      aria-label={t('agents.selectAgent')}
      className="flex items-center gap-1 ps-2 pe-2 py-1.5 overflow-x-auto border-b"
      onKeyDown={handleKeyDown}
      style={{
        borderColor: 'var(--vscode-panel-border)',
        background: 'rgba(30, 30, 30, 0.5)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}
    >
      {state.agents.map((agent) => {
        const isActive = agent.id === state.activeAgentId;

        return (
          <button
            key={agent.id}
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            aria-label={`${agent.name} — ${agent.description}`}
            className={`flex items-center gap-1.5 ps-2.5 pe-2.5 py-1.5 rounded-md text-xs whitespace-nowrap click-shrink transition-all duration-250 ${
              isActive
                ? 'font-medium animate-bounce-subtle'
                : 'opacity-50 hover:opacity-80 hover:scale-[1.02]'
            }`}
            style={{
              background: isActive
                ? `rgba(${hexToRgb(agent.color)}, 0.12)`
                : 'rgba(255,255,255,0.03)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              border: isActive
                ? `1px solid ${agent.color}40`
                : '1px solid rgba(255,255,255,0.04)',
              borderBottom: isActive ? `2px solid ${agent.color}` : '2px solid transparent',
              color: isActive ? agent.color : undefined,
              boxShadow: isActive
                ? `0 0 12px ${agent.color}25, 0 0 4px ${agent.color}15`
                : 'none',
              transition: 'all 0.25s ease, transform 0.15s ease',
            }}
            onClick={() =>
              sendMessage({ type: 'switchAgent', payload: { agentId: agent.id } })
            }
            title={agent.description}
          >
            <span>{agent.icon}</span>
            <span className="hidden sm:inline">{agent.name}</span>
          </button>
        );
      })}

      {/* Workflow כפתור */}
      <div className="ms-auto">
        <button
          className="text-[10px] ps-3 pe-3 py-1 rounded-md font-medium opacity-60 hover:opacity-100 transition-all duration-200 hover:scale-[1.02]"
          style={{
            background: 'var(--gradient-primary)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'white',
          }}
          title={t('agents.runWorkflow')}
          aria-label={t('agents.runWorkflow')}
          onClick={() => dispatch({ type: 'TOGGLE_WORKFLOW_PICKER' })}
        >
          {t('agents.workflow')}
        </button>
      </div>
    </div>
  );
}
