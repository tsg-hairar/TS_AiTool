// ===================================================
// WorkflowPicker — דיאלוג בחירת Workflow
// ===================================================
// מציג רשימה של workflows מובנים עם תיאור
// המשתמש בוחר workflow, מזין קלט, ומריץ
// ===================================================

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../../state/AppContext';
import type { Workflow } from '../../../shared/types';

export function WorkflowPicker() {
  const { state, dispatch, sendMessage } = useApp();
  const { t } = useTranslation();
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [input, setInput] = useState('');

  const dialogRef = useRef<HTMLDivElement>(null);

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

  // --- Focus trap for dialog ---
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      close();
      return;
    }
    if (e.key !== 'Tab') return;

    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable || focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-backdrop-in" role="presentation">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('workflow.title')}
        className="w-96 max-w-[90vw] rounded-lg shadow-xl animate-dialog-in"
        style={{ background: 'var(--vscode-editor-background)', border: '1px solid var(--vscode-panel-border)' }}
        onKeyDown={handleKeyDown}
      >
        {/* כותרת */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: 'var(--vscode-panel-border)' }}
        >
          <h3 className="text-sm font-semibold" style={{ color: 'var(--vscode-foreground)' }}>
            {t('workflow.title')}
          </h3>
          <button className="text-lg opacity-50 hover:opacity-100" onClick={close} aria-label={t('workflow.closeDialog')}>
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
                  className="w-full text-start px-3 py-2.5 rounded-lg transition-smooth hover-lift hover:opacity-90"
                  style={{
                    background: 'var(--vscode-list-hoverBackground)',
                    border: '1px solid var(--vscode-panel-border)',
                  }}
                  onClick={() => setSelectedWorkflow(wf)}
                  aria-label={`${wf.name} — ${wf.description}`}
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
                          <span className="text-[10px] opacity-40">{'\u2192'}</span>
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
                  aria-label={t('workflow.backToList')}
                >
                  {'\u2190'} {t('workflow.back')}
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
                aria-label={t('workflow.taskDescription')}
                placeholder={t('workflow.taskPlaceholder')}
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
                  className="px-3 py-1.5 text-xs rounded transition-smooth click-shrink"
                  style={{
                    background: 'var(--vscode-button-secondaryBackground)',
                    color: 'var(--vscode-button-secondaryForeground)',
                  }}
                  onClick={close}
                >
                  {t('workflow.cancel')}
                </button>
                <button
                  className="px-3 py-1.5 text-xs rounded font-medium transition-smooth click-shrink"
                  style={{
                    background: 'var(--vscode-button-background)',
                    color: 'var(--vscode-button-foreground)',
                    opacity: input.trim() ? 1 : 0.5,
                  }}
                  disabled={!input.trim()}
                  onClick={run}
                >
                  {t('workflow.run')}
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
              <span className="animate-spin text-sm">{'\u23F3'}</span>
              <span className="text-xs font-medium">
                {t('workflow.stepRunning', { step: state.workflowRun.currentStep + 1 })}
              </span>
            </div>
            <button
              className="text-xs text-red-400 hover:text-red-300"
              onClick={() => sendMessage({ type: 'cancelWorkflow' })}
              aria-label={t('workflow.cancelWorkflow')}
            >
              {t('workflow.cancelWorkflow')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
