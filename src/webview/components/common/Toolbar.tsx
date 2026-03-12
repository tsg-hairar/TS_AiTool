// ===================================================
// Toolbar — סרגל כלים עליון
// ===================================================

import React from 'react';
import { useApp } from '../../state/AppContext';

export function Toolbar() {
  const { state, dispatch, sendMessage } = useApp();

  return (
    <div
      className="flex items-center justify-between px-3 py-2 border-b"
      style={{ borderColor: 'var(--vscode-panel-border)' }}
    >
      {/* צד ימין — שם + ניווט */}
      <div className="flex items-center gap-2">
        {/* כפתור חזרה לפרויקטים */}
        {state.currentView !== 'projects' && (
          <button
            className="btn-ghost text-xs"
            onClick={() => dispatch({ type: 'SET_VIEW', payload: 'projects' })}
            title="חזרה לפרויקטים"
          >
            📁
          </button>
        )}

        {/* שם הפרויקט הפעיל */}
        <span className="text-sm font-medium">
          {state.activeProject
            ? `${state.activeProject.icon} ${state.activeProject.name}`
            : 'TS AiTool'}
        </span>

        {/* סוכן פעיל */}
        {state.activeProject && state.currentView === 'chat' && (
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{
              background: 'rgba(255,255,255,0.1)',
            }}
          >
            {state.agents.find((a) => a.id === state.activeAgentId)?.icon}{' '}
            {state.agents.find((a) => a.id === state.activeAgentId)?.name}
          </span>
        )}
      </div>

      {/* צד שמאל — כפתורים */}
      <div className="flex items-center gap-1">
        {/* עלות */}
        {state.sessionCost > 0 && (
          <span className="text-xs opacity-60 ml-2">
            ${state.sessionCost.toFixed(4)}
          </span>
        )}

        {/* צ'אט חדש */}
        {state.currentView === 'chat' && (
          <button
            className="btn-ghost text-xs"
            onClick={() => sendMessage({ type: 'newChat' })}
            title="צ'אט חדש"
          >
            ➕
          </button>
        )}

        {/* הגדרות */}
        <button
          className="btn-ghost text-xs"
          onClick={() => dispatch({ type: 'SET_VIEW', payload: 'settings' })}
          title="הגדרות"
        >
          ⚙️
        </button>
      </div>
    </div>
  );
}
