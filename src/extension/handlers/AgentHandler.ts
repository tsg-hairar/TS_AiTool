// ===================================================
// AgentHandler — טיפול בסוכנים ו-workflows
// ===================================================
// כולל הרצת workflow אמיתית דרך ChatHandler
// כל שלב שולח הודעה ל-Claude ומחכה לתגובה מלאה
// ===================================================

import * as vscode from 'vscode';
import type { ExtensionToWebviewMessage } from '../../shared/messages';
import type { AgentId, WorkflowRun } from '../../shared/types';
import { BUILT_IN_AGENTS, BUILT_IN_WORKFLOWS } from '../../shared/constants';
import { ClaudeService } from '../services/ClaudeService';
import { ConversationStore } from '../services/ConversationStore';
import { SettingsService } from '../services/SettingsService';

export class AgentHandler {
  private currentAgentId: AgentId = 'developer';
  private workflowRun: WorkflowRun | null = null;
  // שירות Claude ייעודי ל-workflows — נפרד מהצ'אט הרגיל
  private claudeService: ClaudeService;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly settingsService: SettingsService,
    private readonly conversationStore: ConversationStore,
    private readonly postMessage: (msg: ExtensionToWebviewMessage) => void,
  ) {
    // אתחול שירות Claude ל-workflows
    this.claudeService = new ClaudeService();
    const apiKey = settingsService.getApiKey();
    this.claudeService.initialize(apiKey || undefined);
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
  // runWorkflow — הרצת workflow אמיתית
  // -------------------------------------------------
  // כל שלב שולח הודעה ל-Claude עם system prompt של הסוכן המתאים
  // התוצאה נשמרת ב-stepResults ומועברת לשלבים הבאים
  // -------------------------------------------------
  public async runWorkflow(workflowId: string, input: string): Promise<void> {
    const workflow = BUILT_IN_WORKFLOWS.find((w) => w.id === workflowId);
    if (!workflow) {
      this.postMessage({
        type: 'error',
        payload: { message: `Workflow "${workflowId}" not found` },
      });
      return;
    }

    // וידוא ש-Claude מוכן
    if (!this.claudeService.isReady()) {
      const apiKey = this.settingsService.getApiKey();
      this.claudeService.initialize(apiKey || undefined);
    }

    // אתחול ריצה
    this.workflowRun = {
      workflowId,
      status: 'running',
      currentStep: 0,
      stepResults: { userInput: input },
    };

    this.postMessage({ type: 'workflowUpdate', payload: this.workflowRun });

    // הודעת התחלה בצ'אט
    this.postMessage({
      type: 'addMessage',
      payload: {
        id: `wf-start-${Date.now()}`,
        role: 'system',
        content: `⚡ מריץ workflow: **${workflow.name}** (${workflow.steps.length} שלבים)`,
        timestamp: new Date().toISOString(),
      },
    });

    // הרצת כל שלב בסדר
    for (let i = 0; i < workflow.steps.length; i++) {
      if (this.workflowRun.status === 'failed') break;

      const step = workflow.steps[i];
      const agent = BUILT_IN_AGENTS[step.agentId];
      this.workflowRun.currentStep = i;
      this.postMessage({ type: 'workflowUpdate', payload: { ...this.workflowRun } });

      // החלפת משתנים בתבנית
      let stepInput = step.input;
      for (const [varName, value] of Object.entries(this.workflowRun.stepResults)) {
        stepInput = stepInput.replace(`{{${varName}}}`, value);
      }

      // החלפה לסוכן המתאים
      await this.switchAgent(step.agentId);

      // הודעת שלב בצ'אט — מראים מי עובד
      const stepMsgId = `wf-step-${Date.now()}-${i}`;
      this.postMessage({
        type: 'addMessage',
        payload: {
          id: `wf-user-${Date.now()}-${i}`,
          role: 'user',
          content: `[שלב ${i + 1}/${workflow.steps.length}] ${agent.icon} ${agent.name}: ${stepInput}`,
          timestamp: new Date().toISOString(),
        },
      });

      // הודעת assistant ריקה ל-streaming
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

      // שליחה ל-Claude ומחכים לתגובה מלאה
      try {
        const result = await this.executeStep(stepInput, agent.systemPrompt, stepMsgId);
        this.workflowRun.stepResults[step.outputVar] = result;
      } catch (error) {
        // שגיאה בשלב — עוצרים את ה-workflow
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        this.workflowRun.status = 'failed';
        this.workflowRun.error = `Step ${i + 1} failed: ${errMsg}`;
        this.postMessage({ type: 'workflowUpdate', payload: { ...this.workflowRun } });
        this.postMessage({
          type: 'error',
          payload: { message: `Workflow failed at step ${i + 1}: ${errMsg}` },
        });
        return;
      }
    }

    // סיום מוצלח
    this.workflowRun.status = 'completed';
    this.postMessage({ type: 'workflowUpdate', payload: { ...this.workflowRun } });

    // הודעת סיום
    this.postMessage({
      type: 'addMessage',
      payload: {
        id: `wf-done-${Date.now()}`,
        role: 'system',
        content: `✅ Workflow **${workflow.name}** הושלם בהצלחה!`,
        timestamp: new Date().toISOString(),
      },
    });
  }

  // -------------------------------------------------
  // executeStep — שליחת שלב בודד ל-Claude וקבלת תגובה
  // -------------------------------------------------
  // מחזיר Promise שמתפתר עם הטקסט המלא של התגובה
  // -------------------------------------------------
  private executeStep(input: string, systemPrompt: string, msgId: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const settings = this.settingsService.getSettings();

      this.claudeService.sendMessage(
        [{ id: 'wf', role: 'user', content: input, timestamp: new Date().toISOString() }],
        systemPrompt,
        settings.model,
        settings.maxTokens,
        {
          onToken: (token) => {
            // Streaming — מעדכנים את ה-UI בזמן אמת
            this.postMessage({
              type: 'streamToken',
              payload: { messageId: msgId, token },
            });
          },
          onComplete: (fullText, tokenCount) => {
            // סיום — עדכון ה-UI ושמירת התוצאה
            this.postMessage({
              type: 'streamComplete',
              payload: { messageId: msgId, fullContent: fullText, tokenCount },
            });
            resolve(fullText);
          },
          onToolUse: (_toolUse) => {
            // כלים ב-workflow — לא נתמכים כרגע, ממשיכים
          },
          onError: (error) => {
            reject(error);
          },
        },
      );
    });
  }

  // ביטול workflow
  public cancelWorkflow(): void {
    if (this.workflowRun) {
      this.workflowRun.status = 'failed';
      this.workflowRun.error = 'Cancelled by user';
      this.postMessage({ type: 'workflowUpdate', payload: { ...this.workflowRun } });
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
