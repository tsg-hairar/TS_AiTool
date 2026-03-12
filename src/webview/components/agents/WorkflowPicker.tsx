// ===================================================
// WorkflowPicker — דיאלוג בחירת Workflow
// ===================================================
// מציג רשימה של workflows מובנים עם תיאור
// המשתמש בוחר workflow, מזין קלט, ומריץ
// ===================================================

import React, { useState } from 'react';
import { useApp } from '../../state/AppContext';
import type { Workflow } from '../../../shared/types';

export function WorkflowPicker() {
  const { state, dispatch, sendMessage } = useApp();
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [input, setInput] = useState('');

  if (!state.workflowPickerOpen) return null;

  // סגירת הדיאלוג
  const close = () => {
    dispatch({ type: 'TOGGLE_WORKFLOW_PICKER' });
    setSelectedWorkflow(null);
    setInput('');
  };

  // הרצת Workflow
  const run = () => {
    if (!selectedWorkflow || !input.trim()) return;
    sendMessage({
      type: 'runWorkflow',
      payload: { workflowId: selectedWorkflow.id, input: input.trim() },
    });
    close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        className="w-96 max-w-[90vw] rounded-lg shadow-xl"
        style={{ background: 'var(--vscode-editor-background)', border: '1px solid var(--vscode-panel-border)' }}
      >
        {/* כותרת */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: 'var(--vscode-panel-border)' }}
        >
          <h3 className="text-sm font-semibold" style={{ color: 'var(--vscode-foreground)' }}>
            ⚡ בחירת Workflow
          </h3>
          <button className="text-lg opacity-50 hover:opacity-100" onClick={close}>
            ✕
          </button>
        </div>

        <div className="p-4">
          {!selectedWorkflow ? (
            // --- שלב 1: בחירת workflow ---
            <div className="space-y-2">
              {state.workflows.map((wf) => (
                <button
                  key={wf.id}
                  className="w-full text-start px-3 py-2.5 rounded-lg transition-all hover:opacity-90"
                  style={{
                    background: 'var(--vscode-list-hoverBackground)',
                    border: '1px solid var(--vscode-panel-border)',
                  }}
                  onClick={() => setSelectedWorkflow(wf)}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span>{wf.icon}</span>
                    <span className="text-sm font-medium" style={{ color: 'var(--vscode-foreground)' }}>
                      {wf.name}
                    </span>
                  </div>
                  <p className="text-xs" style={{ color: 'var(--vscode-descriptionForeground)' }}>
                    {wf.description}
                  </p>
                  {/* שלבים */}
                  <div className="flex items-center gap-1 mt-2">
                    {wf.steps.map((step, i) => (
                      <React.Fragment key={i}>
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded"
                          style={{ background: 'var(--vscode-badge-background)', color: 'var(--vscode-badge-foreground)' }}
                        >
                          {step.agentId}
                        </span>
                        {i < wf.steps.length - 1 && (
                          <span className="text-[10px] opacity-40">→</span>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            // --- שלב 2: הזנת קלט ---
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span>{selectedWorkflow.icon}</span>
                <span className="text-sm font-medium">{selectedWorkflow.name}</span>
                <button
                  className="text-xs opacity-50 hover:opacity-100 mr-auto"
                  onClick={() => setSelectedWorkflow(null)}
                >
                  ← חזרה
                </button>
              </div>

              <p className="text-xs mb-3" style={{ color: 'var(--vscode-descriptionForeground)' }}>
                {selectedWorkflow.description}
              </p>

              <textarea
                className="w-full px-3 py-2 rounded text-sm resize-none"
                style={{
                  background: 'var(--vscode-input-background)',
                  color: 'var(--vscode-input-foreground)',
                  border: '1px solid var(--vscode-input-border)',
                }}
                rows={3}
                placeholder="תאר את המשימה..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    run();
                  }
                }}
                autoFocus
              />

              <div className="flex justify-end gap-2 mt-3">
                <button
                  className="px-3 py-1.5 text-xs rounded"
                  style={{
                    background: 'var(--vscode-button-secondaryBackground)',
                    color: 'var(--vscode-button-secondaryForeground)',
                  }}
                  onClick={close}
                >
                  ביטול
                </button>
                <button
                  className="px-3 py-1.5 text-xs rounded font-medium"
                  style={{
                    background: 'var(--vscode-button-background)',
                    color: 'var(--vscode-button-foreground)',
                    opacity: input.trim() ? 1 : 0.5,
                  }}
                  disabled={!input.trim()}
                  onClick={run}
                >
                  ⚡ הרצה
                </button>
              </div>
            </div>
          )}
        </div>

        {/* מצב ריצה של workflow */}
        {state.workflowRun && state.workflowRun.status === 'running' && (
          <div
            className="px-4 py-3 border-t"
            style={{ borderColor: 'var(--vscode-panel-border)' }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="animate-spin text-sm">⏳</span>
              <span className="text-xs font-medium">
                שלב {state.workflowRun.currentStep + 1} רץ...
              </span>
            </div>
            <button
              className="text-xs text-red-400 hover:text-red-300"
              onClick={() => sendMessage({ type: 'cancelWorkflow' })}
            >
              ❌ ביטול Workflow
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
