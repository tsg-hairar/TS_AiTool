// ===================================================
// AgentHandler — טיפול בסוכנים ו-workflows
// ===================================================
// כולל הרצת workflow אמיתית דרך ChatHandler
// כל שלב שולח הודעה ל-Claude ומחכה לתגובה מלאה
// תמיכה ב:
// - graceful degradation: אם שלב נכשל, ממשיכים עם השאר
// - partial success: מראים אילו שלבים הצליחו ואילו נכשלו
// - workflow state: שמירת מצב בין שלבים לשחזור
// ===================================================

import * as vscode from 'vscode';
import type { ExtensionToWebviewMessage } from '../../shared/messages';
import type { AgentId, Workflow, WorkflowRun } from '../../shared/types';
import { BUILT_IN_AGENTS, BUILT_IN_WORKFLOWS, TIMEOUTS } from '../../shared/constants';
import { ClaudeService } from '../services/ClaudeService';
import { ConversationStore } from '../services/ConversationStore';
import { SettingsService } from '../services/SettingsService';
import { ToolExecutor } from '../services/ToolExecutor';
import { generateId } from '../../shared/utils/generateId';
import { createLogger } from '../utils/logger';

const log = createLogger('AgentHandler');

// -------------------------------------------------
// StepResult — תוצאת שלב בודד
// -------------------------------------------------
interface StepResult {
  stepIndex: number;
  stepName: string;
  agentId: AgentId;
  status: 'completed' | 'failed' | 'skipped';
  output?: string;
  error?: string;
  durationMs: number;
}

// -------------------------------------------------
// WorkflowState — מצב workflow לשחזור
// -------------------------------------------------
// נשמר ב-globalState כדי לאפשר המשך לאחר הפסקה
// -------------------------------------------------
interface WorkflowState {
  workflowId: string;
  input: string;
  stepResults: Record<string, string>;
  completedSteps: number[];
  failedSteps: number[];
  skippedSteps: number[];
  startedAt: string;
  lastUpdatedAt: string;
}

const WORKFLOW_STATE_KEY = 'tsAiTool.workflowState';

export class AgentHandler {
  private currentAgentId: AgentId = 'developer';
  private workflowRun: WorkflowRun | null = null;
  // שירות Claude משותף — אותו instance כמו ב-ChatHandler
  private claudeService: ClaudeService;
  // מנוע הפעלת כלים — משותף לכל האייג'נטים
  private toolExecutor: ToolExecutor;
  // תוצאות שלבים לדיווח חלקי
  private stepResultLog: StepResult[] = [];

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly settingsService: SettingsService,
    private readonly conversationStore: ConversationStore,
    private readonly postMessage: (msg: ExtensionToWebviewMessage) => void,
    claudeService: ClaudeService,
    toolExecutor?: ToolExecutor,
  ) {
    // שימוש ב-instance משותף שנוצר ב-SidebarProvider/FullScreenPanel
    this.claudeService = claudeService;
    // ToolExecutor — אם לא סופק, יוצרים חדש
    this.toolExecutor = toolExecutor ?? new ToolExecutor(context);
  }

  // שליחת רשימת סוכנים
  public sendAgentList(): void {
    const agents = Object.values(BUILT_IN_AGENTS);
    this.postMessage({ type: 'agentList', payload: agents });
  }

  // שליחת רשימת workflows
  public sendWorkflowList(): void {
    this.postMessage({ type: 'workflowList', payload: BUILT_IN_WORKFLOWS });
  }

  // החלפת סוכן
  public async switchAgent(agentId: AgentId): Promise<void> {
    this.currentAgentId = agentId;
    this.postMessage({ type: 'agentSwitched', payload: { agentId } });
  }

  // קבלת סוכן נוכחי
  public getCurrentAgent(): AgentId {
    return this.currentAgentId;
  }

  // -------------------------------------------------
  // saveWorkflowState — שמירת מצב workflow לשחזור
  // -------------------------------------------------
  private async saveWorkflowState(state: WorkflowState): Promise<void> {
    try {
      await this.context.globalState.update(WORKFLOW_STATE_KEY, state);
    } catch (err) {
      log.error('Failed to save workflow state:', err);
    }
  }

  // -------------------------------------------------
  // loadWorkflowState — טעינת מצב workflow שנשמר
  // -------------------------------------------------
  public loadWorkflowState(): WorkflowState | undefined {
    try {
      return this.context.globalState.get<WorkflowState>(WORKFLOW_STATE_KEY);
    } catch (err) {
      log.error('Failed to load workflow state:', err);
      return undefined;
    }
  }

  // -------------------------------------------------
  // hasCircularDependencies — בדיקת תלויות מעגליות
  // -------------------------------------------------
  // מונע מצב של workflow שנתקע בלולאה אינסופית
  // -------------------------------------------------
  private hasCircularDependencies(workflow: Workflow): boolean {
    const outputVarToStep: Record<string, string> = {};
    for (const step of workflow.steps) {
      outputVarToStep[step.outputVar] = step.outputVar;
    }

    // DFS cycle detection
    const visited = new Set<string>();
    const inStack = new Set<string>();

    const hasCycle = (outputVar: string): boolean => {
      if (inStack.has(outputVar)) return true;
      if (visited.has(outputVar)) return false;

      visited.add(outputVar);
      inStack.add(outputVar);

      const step = workflow.steps.find((s) => s.outputVar === outputVar);
      if (step) {
        for (const dep of step.dependsOn ?? []) {
          if (hasCycle(dep)) return true;
        }
      }

      inStack.delete(outputVar);
      return false;
    };

    return workflow.steps.some((step) => hasCycle(step.outputVar));
  }

  // -------------------------------------------------
  // clearWorkflowState — ניקוי מצב workflow
  // -------------------------------------------------
  private async clearWorkflowState(): Promise<void> {
    try {
      await this.context.globalState.update(WORKFLOW_STATE_KEY, undefined);
    } catch (err) {
      log.error('Failed to clear workflow state:', err);
    }
  }

  // -------------------------------------------------
  // buildStepSummary — בניית סיכום תוצאות שלבים
  // -------------------------------------------------
  private buildStepSummary(results: StepResult[]): string {
    if (results.length === 0) return '';

    const completed = results.filter((r) => r.status === 'completed');
    const failed = results.filter((r) => r.status === 'failed');
    const skipped = results.filter((r) => r.status === 'skipped');

    let summary = `\n---\n**Workflow Summary** (${completed.length}/${results.length} steps succeeded)\n\n`;

    for (const result of results) {
      const icon = result.status === 'completed' ? '✅'
        : result.status === 'failed' ? '❌'
        : '⏭️';
      const duration = `${(result.durationMs / 1000).toFixed(1)}s`;
      summary += `${icon} Step ${result.stepIndex + 1}: ${result.stepName} (${duration})`;
      if (result.error) {
        summary += ` — ${result.error}`;
      }
      summary += '\n';
    }

    if (failed.length > 0) {
      summary += `\n⚠️ ${failed.length} step(s) failed. Workflow continued with available results.`;
    }
    if (skipped.length > 0) {
      summary += `\n⏭️ ${skipped.length} step(s) skipped (depended on failed steps).`;
    }

    return summary;
  }

  // -------------------------------------------------
  // runWorkflow — הרצת workflow עם graceful degradation
  // -------------------------------------------------
  // שיפורים:
  // 1. אם שלב נכשל, ממשיכים עם שלבים שלא תלויים בו
  // 2. מדווחים אילו שלבים הצליחו ואילו נכשלו
  // 3. שומרים מצב בין שלבים לשחזור
  // -------------------------------------------------
  public async runWorkflow(workflowId: string, input: string, resumeFrom?: number): Promise<void> {
    const workflow = BUILT_IN_WORKFLOWS.find((w) => w.id === workflowId);
    if (!workflow) {
      this.postMessage({
        type: 'error',
        payload: { message: `Workflow "${workflowId}" not found` },
      });
      return;
    }

    // בדיקת תלויות מעגליות (circular dependencies)
    if (this.hasCircularDependencies(workflow)) {
      this.postMessage({
        type: 'error',
        payload: { message: `Workflow "${workflow.name}" has circular dependencies between steps` },
      });
      return;
    }

    // וידוא ש-Claude מוכן
    if (!this.claudeService.isReady()) {
      const apiKey = await this.settingsService.getApiKey();
      await this.claudeService.initialize(apiKey || undefined);
    }

    // --- שחזור מצב אם ממשיכים ---
    let savedState: WorkflowState | undefined;
    if (resumeFrom !== undefined) {
      savedState = this.loadWorkflowState();
      if (!savedState || savedState.workflowId !== workflowId) {
        savedState = undefined; // מצב לא רלוונטי — מתחילים מחדש
      }
    }

    // אתחול ריצה
    this.stepResultLog = [];
    this.workflowRun = {
      workflowId,
      status: 'running',
      currentStep: resumeFrom ?? 0,
      stepResults: savedState?.stepResults ?? { userInput: input },
    };

    // שמירת מצב התחלתי
    const workflowState: WorkflowState = {
      workflowId,
      input,
      stepResults: { ...this.workflowRun.stepResults },
      completedSteps: savedState?.completedSteps ?? [],
      failedSteps: savedState?.failedSteps ?? [],
      skippedSteps: savedState?.skippedSteps ?? [],
      startedAt: savedState?.startedAt ?? new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
    };

    this.postMessage({ type: 'workflowUpdate', payload: this.workflowRun });

    // הודעת התחלה בצ'אט
    const startMsg = resumeFrom !== undefined
      ? `⚡ ממשיך workflow: **${workflow.name}** (משלב ${(resumeFrom ?? 0) + 1}/${workflow.steps.length})`
      : `⚡ מריץ workflow: **${workflow.name}** (${workflow.steps.length} שלבים)`;

    this.postMessage({
      type: 'addMessage',
      payload: {
        id: `wf-start-${generateId()}`,
        role: 'system',
        content: startMsg,
        timestamp: new Date().toISOString(),
      },
    });

    // -------------------------------------------------
    // Dependency-based execution using dependsOn
    // -------------------------------------------------
    // Build a map: outputVar -> step index for dependency resolution
    const outputVarToIndex: Record<string, number> = {};
    for (let i = 0; i < workflow.steps.length; i++) {
      outputVarToIndex[workflow.steps[i].outputVar] = i;
    }

    // Track state
    const failedOutputVars = new Set<string>();
    // For resumed workflows, mark already-failed/skipped outputVars
    for (const fi of workflowState.failedSteps) {
      failedOutputVars.add(workflow.steps[fi].outputVar);
    }
    for (const si of workflowState.skippedSteps) {
      failedOutputVars.add(workflow.steps[si].outputVar);
    }

    const allProcessed = new Set<number>([
      ...workflowState.completedSteps,
      ...workflowState.failedSteps,
      ...workflowState.skippedSteps,
    ]);

    // --- Execution loop: process steps in dependency order ---
    // Each iteration finds all steps whose dependsOn are satisfied
    // and runs them concurrently via Promise.all.
    let madeProgress = true;
    while (madeProgress) {
      if (!this.workflowRun || this.workflowRun.status === 'failed') break;

      madeProgress = false;

      // Find ready steps: not yet processed, all deps satisfied
      const readySteps: number[] = [];
      for (let i = 0; i < workflow.steps.length; i++) {
        if (allProcessed.has(i)) continue;
        const step = workflow.steps[i];
        const deps = step.dependsOn ?? [];
        // All dependency outputVars must be from already-processed steps
        const allDepsMet = deps.every((depVar) => {
          const depIdx = outputVarToIndex[depVar];
          return depIdx === undefined || allProcessed.has(depIdx);
        });
        if (allDepsMet) {
          readySteps.push(i);
        }
      }

      if (readySteps.length === 0) break;
      madeProgress = true;

      // Run ready steps concurrently
      const stepPromises = readySteps.map(async (i) => {
        const step = workflow.steps[i];
        const agent = BUILT_IN_AGENTS[step.agentId];

        // Check if any dependency failed/was skipped
        const deps = step.dependsOn ?? [];
        const hasMissingDep = deps.some((depVar) => failedOutputVars.has(depVar));

        if (hasMissingDep) {
          // Skip — depends on a failed step
          const skipResult: StepResult = {
            stepIndex: i,
            stepName: `${agent.name}: ${step.input.slice(0, 40)}`,
            agentId: step.agentId,
            status: 'skipped',
            error: 'Depends on a failed step',
            durationMs: 0,
          };
          this.stepResultLog.push(skipResult);
          failedOutputVars.add(step.outputVar);
          workflowState.skippedSteps.push(i);
          workflowState.lastUpdatedAt = new Date().toISOString();
          await this.saveWorkflowState(workflowState);

          this.postMessage({
            type: 'addMessage',
            payload: {
              id: `wf-skip-${generateId()}`,
              role: 'system',
              content: `⏭️ [שלב ${i + 1}/${workflow.steps.length}] דילוג — תלוי בשלב שנכשל`,
              timestamp: new Date().toISOString(),
            },
          });
          allProcessed.add(i);
          return;
        }

        // Replace template variables
        let stepInput = step.input;
        if (!this.workflowRun) {
          console.error('[AgentHandler] workflowRun is null');
          return;
        }
        for (const [varName, value] of Object.entries(this.workflowRun.stepResults)) {
          stepInput = stepInput.replace(`{{${varName}}}`, value);
        }

        // Switch agent
        await this.switchAgent(step.agentId);

        if (!this.workflowRun) {
          console.error('[AgentHandler] workflowRun is null');
          return;
        }
        this.workflowRun.currentStep = i;
        this.postMessage({ type: 'workflowUpdate', payload: { ...this.workflowRun } });

        const stepMsgId = `wf-step-${generateId()}`;
        this.postMessage({
          type: 'addMessage',
          payload: {
            id: `wf-user-${generateId()}`,
            role: 'user',
            content: `[שלב ${i + 1}/${workflow.steps.length}] ${agent.icon} ${agent.name}: ${stepInput}`,
            timestamp: new Date().toISOString(),
          },
        });

        this.postMessage({
          type: 'addMessage',
          payload: {
            id: stepMsgId,
            role: 'assistant',
            content: '',
            timestamp: new Date().toISOString(),
            agentId: step.agentId,
            isStreaming: true,
          },
        });

        const stepStartTime = Date.now();
        try {
          const result = await this.executeStep(stepInput, agent.systemPrompt, stepMsgId);
          const durationMs = Date.now() - stepStartTime;

          if (!this.workflowRun) {
            console.error('[AgentHandler] workflowRun is null');
            return;
          }
          this.workflowRun.stepResults[step.outputVar] = result;

          const stepResult: StepResult = {
            stepIndex: i,
            stepName: `${agent.name}`,
            agentId: step.agentId,
            status: 'completed',
            output: result.slice(0, 200),
            durationMs,
          };
          this.stepResultLog.push(stepResult);

          workflowState.stepResults[step.outputVar] = result;
          workflowState.completedSteps.push(i);
          workflowState.lastUpdatedAt = new Date().toISOString();
          await this.saveWorkflowState(workflowState);
        } catch (error) {
          const durationMs = Date.now() - stepStartTime;
          const errMsg = error instanceof Error ? error.message : 'Unknown error';

          const stepResult: StepResult = {
            stepIndex: i,
            stepName: `${agent.name}`,
            agentId: step.agentId,
            status: 'failed',
            error: errMsg,
            durationMs,
          };
          this.stepResultLog.push(stepResult);
          failedOutputVars.add(step.outputVar);

          workflowState.failedSteps.push(i);
          workflowState.lastUpdatedAt = new Date().toISOString();
          await this.saveWorkflowState(workflowState);

          this.postMessage({
            type: 'addMessage',
            payload: {
              id: `wf-err-${generateId()}`,
              role: 'system',
              content: `❌ שלב ${i + 1} נכשל: ${errMsg}\n\nממשיך עם השלבים הבאים...`,
              timestamp: new Date().toISOString(),
            },
          });

          this.postMessage({
            type: 'streamComplete',
            payload: {
              messageId: stepMsgId,
              fullContent: `[Step failed: ${errMsg}]`,
              tokenCount: 0,
            },
          });
        }

        allProcessed.add(i);
      });

      // Wait for all parallel steps in this batch to complete
      await Promise.all(stepPromises);
    }

    // --- סיכום ה-workflow ---
    const completed = this.stepResultLog.filter((r) => r.status === 'completed');
    const failed = this.stepResultLog.filter((r) => r.status === 'failed');
    const skipped = this.stepResultLog.filter((r) => r.status === 'skipped');

    // קביעת סטטוס סופי
    if (!this.workflowRun) {
      console.error('[AgentHandler] workflowRun is null');
      return;
    }
    if (failed.length === 0 && skipped.length === 0) {
      // הכל הצליח
      this.workflowRun.status = 'completed';
    } else if (completed.length === 0) {
      // הכל נכשל
      this.workflowRun.status = 'failed';
      this.workflowRun.error = `All ${failed.length} steps failed`;
    } else {
      // הצלחה חלקית — מסמנים כ-completed עם הערה
      this.workflowRun.status = 'completed';
      this.workflowRun.error = `Partial: ${completed.length} succeeded, ${failed.length} failed, ${skipped.length} skipped`;
    }

    this.postMessage({ type: 'workflowUpdate', payload: { ...this.workflowRun } });

    // הודעת סיכום מפורטת בצ'אט
    const summary = this.buildStepSummary(this.stepResultLog);
    const statusIcon = failed.length === 0 ? '✅' : completed.length > 0 ? '⚠️' : '❌';
    const statusText = failed.length === 0
      ? `הושלם בהצלחה!`
      : completed.length > 0
        ? `הושלם חלקית (${completed.length}/${this.stepResultLog.length} שלבים)`
        : `נכשל`;

    this.postMessage({
      type: 'addMessage',
      payload: {
        id: `wf-done-${generateId()}`,
        role: 'system',
        content: `${statusIcon} Workflow **${workflow.name}** ${statusText}${summary}`,
        timestamp: new Date().toISOString(),
      },
    });

    // ניקוי מצב workflow לאחר סיום מוצלח מלא
    if (failed.length === 0) {
      await this.clearWorkflowState();
    }
  }

  // -------------------------------------------------
  // resumeWorkflow — המשך workflow שהופסק
  // -------------------------------------------------
  // טוען מצב שנשמר וממשיך מהשלב שנעצר
  // -------------------------------------------------
  public async resumeWorkflow(): Promise<void> {
    const savedState = this.loadWorkflowState();
    if (!savedState) {
      this.postMessage({
        type: 'error',
        payload: { message: 'No saved workflow state to resume' },
      });
      return;
    }

    // מוצאים את השלב הבא שלא הושלם
    const allDone = new Set([
      ...savedState.completedSteps,
      ...savedState.failedSteps,
      ...savedState.skippedSteps,
    ]);

    const workflow = BUILT_IN_WORKFLOWS.find((w) => w.id === savedState.workflowId);
    if (!workflow) {
      this.postMessage({
        type: 'error',
        payload: { message: `Workflow "${savedState.workflowId}" not found for resume` },
      });
      return;
    }

    // מוצאים שלב ראשון שלא הושלם
    let resumeFrom = workflow.steps.length; // default: הכל הושלם
    for (let i = 0; i < workflow.steps.length; i++) {
      if (!allDone.has(i)) {
        resumeFrom = i;
        break;
      }
    }

    if (resumeFrom >= workflow.steps.length) {
      this.postMessage({
        type: 'addMessage',
        payload: {
          id: `wf-resume-done-${generateId()}`,
          role: 'system',
          content: `Workflow **${workflow.name}** already completed. No steps to resume.`,
          timestamp: new Date().toISOString(),
        },
      });
      await this.clearWorkflowState();
      return;
    }

    await this.runWorkflow(savedState.workflowId, savedState.input, resumeFrom);
  }

  // -------------------------------------------------
  // executeStep — שליחת שלב בודד ל-Claude וקבלת תגובה
  // -------------------------------------------------
  // מחזיר Promise שמתפתר עם הטקסט המלא של התגובה
  // תומך בלולאת tool-use: כש-Claude מבקש כלי, מפעילים
  // אותו דרך ToolExecutor ושולחים את התוצאה חזרה ל-Claude
  // -------------------------------------------------
  private executeStep(input: string, systemPrompt: string, msgId: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const settings = this.settingsService.getSettings();

      // --- מצב שיחה: כל ההודעות בשלב הזה (כולל tool results) ---
      const conversationMessages: Array<{
        id: string;
        role: 'user' | 'assistant' | 'system';
        content: string;
        timestamp: string;
      }> = [
        { id: 'wf', role: 'user', content: input, timestamp: new Date().toISOString() },
      ];

      // --- מונה turns למניעת לולאה אינסופית ---
      let toolTurnCount = 0;
      const MAX_TOOL_TURNS = TIMEOUTS.MAX_TOOL_TURNS;

      // --- טקסט מצטבר מכל ה-turns ---
      let accumulatedText = '';

      // --- פונקציה רקורסיבית: שולחת הודעה ל-Claude ומטפלת בתגובה ---
      const sendToClaude = () => {
        // --- pending tool uses שנאספו ב-turn הנוכחי ---
        const pendingToolUses: Array<{
          id: string;
          name: string;
          input: Record<string, unknown>;
        }> = [];

        this.claudeService.sendMessage(
          conversationMessages,
          systemPrompt,
          settings.model,
          settings.maxTokens,
          {
            onToken: (token) => {
              // Streaming — מעדכנים את ה-UI בזמן אמת
              accumulatedText += token;
              this.postMessage({
                type: 'streamToken',
                payload: { messageId: msgId, token },
              });
            },
            onComplete: (fullText, tokenCount) => {
              // --- בדיקה: האם יש tool uses שצריך להפעיל? ---
              if (pendingToolUses.length > 0 && toolTurnCount < MAX_TOOL_TURNS) {
                toolTurnCount++;

                // הוספת תגובת ה-assistant לשיחה
                conversationMessages.push({
                  id: `wf-assistant-${generateId()}`,
                  role: 'assistant',
                  content: fullText,
                  timestamp: new Date().toISOString(),
                });

                // הפעלת כל הכלים והחזרת תוצאות ל-Claude
                this.executeToolsAndContinue(
                  pendingToolUses,
                  conversationMessages,
                  msgId,
                  sendToClaude,
                  reject,
                );
              } else {
                // סיום — אין יותר tool uses או הגענו למקסימום
                this.postMessage({
                  type: 'streamComplete',
                  payload: { messageId: msgId, fullContent: accumulatedText || fullText, tokenCount },
                });
                resolve(accumulatedText || fullText);
              }
            },
            onToolUse: (toolUse) => {
              // אוספים את ה-tool use — נפעיל אחרי ש-onComplete ייקרא
              pendingToolUses.push({
                id: toolUse.id,
                name: toolUse.name as string,
                input: toolUse.input,
              });

              // מציגים ב-UI שכלי מופעל
              const toolNotice = `\n[Tool: ${toolUse.name}] Executing...\n`;
              this.postMessage({
                type: 'streamToken',
                payload: { messageId: msgId, token: toolNotice },
              });
            },
            onError: (error) => {
              reject(error);
            },
          },
        );
      };

      // --- התחלת השיחה ---
      sendToClaude();
    });
  }

  // -------------------------------------------------
  // executeToolsAndContinue — הפעלת כלים והמשך שיחה
  // -------------------------------------------------
  // מפעיל את כל הכלים שנדרשו, מוסיף את התוצאות כהודעות
  // user לשיחה, וקורא ל-callback להמשך שיחה עם Claude
  // -------------------------------------------------
  private async executeToolsAndContinue(
    toolUses: Array<{ id: string; name: string; input: Record<string, unknown> }>,
    conversationMessages: Array<{
      id: string;
      role: 'user' | 'assistant' | 'system';
      content: string;
      timestamp: string;
    }>,
    msgId: string,
    continueConversation: () => void,
    onError: (error: Error) => void,
  ): Promise<void> {
    try {
      // --- אישור משתמש לכלים מסוכנים ---
      const onApproval = async (toolName: string, input: Record<string, unknown>): Promise<boolean> => {
        const inputSummary = JSON.stringify(input).substring(0, 200);
        const answer = await vscode.window.showWarningMessage(
          `Agent wants to use tool: ${toolName}\n${inputSummary}`,
          { modal: true },
          'Allow',
          'Deny',
        );
        return answer === 'Allow';
      };

      // הפעלת כל הכלים
      const toolResults: string[] = [];

      for (const toolUse of toolUses) {
        const result = await this.toolExecutor.executeTool(
          toolUse.name,
          toolUse.input,
          toolUse.id,
          onApproval,
        );

        // מציגים תוצאה ב-UI
        const statusIcon = result.success ? '\u2705' : '\u274C';
        const resultNotice = `\n${statusIcon} [${toolUse.name}] (${result.durationMs}ms): ${
          result.success
            ? result.output.substring(0, 500)
            : `Error: ${result.error}`
        }\n`;

        this.postMessage({
          type: 'streamToken',
          payload: { messageId: msgId, token: resultNotice },
        });

        // בניית תוצאה לשליחה חזרה ל-Claude
        const toolResultText = result.success
          ? result.output
          : `Error: ${result.error}`;
        toolResults.push(`[Tool Result: ${toolUse.name} (id: ${toolUse.id})]\n${toolResultText}`);
      }

      // הוספת תוצאות הכלים כהודעת user לשיחה
      const toolResultsMessage = toolResults.join('\n\n');
      conversationMessages.push({
        id: `wf-toolresult-${generateId()}`,
        role: 'user',
        content: toolResultsMessage,
        timestamp: new Date().toISOString(),
      });

      // המשך השיחה עם Claude — עכשיו עם תוצאות הכלים
      continueConversation();
    } catch (error) {
      onError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  // ביטול workflow
  public cancelWorkflow(): void {
    if (this.workflowRun) {
      this.workflowRun.status = 'failed';
      this.workflowRun.error = 'Cancelled by user';
      this.postMessage({ type: 'workflowUpdate', payload: { ...this.workflowRun } });

      // שומרים מצב לפני ביטול — אפשר להמשיך אחר כך
      const workflowState: WorkflowState = {
        workflowId: this.workflowRun.workflowId,
        input: this.workflowRun.stepResults['userInput'] ?? '',
        stepResults: { ...this.workflowRun.stepResults },
        completedSteps: this.stepResultLog
          .filter((r) => r.status === 'completed')
          .map((r) => r.stepIndex),
        failedSteps: this.stepResultLog
          .filter((r) => r.status === 'failed')
          .map((r) => r.stepIndex),
        skippedSteps: this.stepResultLog
          .filter((r) => r.status === 'skipped')
          .map((r) => r.stepIndex),
        startedAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
      };
      void this.saveWorkflowState(workflowState);

      // סיכום חלקי
      if (this.stepResultLog.length > 0) {
        const summary = this.buildStepSummary(this.stepResultLog);
        this.postMessage({
          type: 'addMessage',
          payload: {
            id: `wf-cancel-summary-${generateId()}`,
            role: 'system',
            content: `Workflow cancelled by user.${summary}\n\nYou can resume this workflow later.`,
            timestamp: new Date().toISOString(),
          },
        });
      }

      this.workflowRun = null;
      // ביטול בקשה נוכחית
      this.claudeService.cancel();
    }
  }

  // ניקוי משאבים
  public dispose(): void {
    this.claudeService.dispose();
  }
}
