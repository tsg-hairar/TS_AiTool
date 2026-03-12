// ===================================================
// AgentTabs — טאבים להחלפת סוכנים
// ===================================================
// כל סוכן = טאב עם אייקון וצבע ייחודי
// לחיצה על טאב = מעבר לסוכן + צ'אט נפרד
// ===================================================

import React from 'react';
import { useApp } from '../../state/AppContext';

export function AgentTabs() {
  const { state, dispatch, sendMessage } = useApp();

  if (state.agents.length === 0) return null;

  return (
    <div
      className="flex items-center gap-0.5 px-2 py-1.5 overflow-x-auto border-b"
      style={{ borderColor: 'var(--vscode-panel-border)' }}
    >
      {state.agents.map((agent) => {
        const isActive = agent.id === state.activeAgentId;

        return (
          <button
            key={agent.id}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-all whitespace-nowrap ${
              isActive ? 'font-medium' : 'opacity-50 hover:opacity-80'
            }`}
            style={{
              background: isActive ? `${agent.color}20` : 'transparent',
              borderBottom: isActive ? `2px solid ${agent.color}` : '2px solid transparent',
              color: isActive ? agent.color : undefined,
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
      <div className="mr-auto">
        <button
          className="btn-ghost text-[10px] opacity-40 hover:opacity-100"
          title="הרצת Workflow"
          onClick={() => dispatch({ type: 'TOGGLE_WORKFLOW_PICKER' })}
        >
          ⚡ Workflow
        </button>
      </div>
    </div>
  );
}
