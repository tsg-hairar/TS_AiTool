// ===================================================
// Message Protocol — פרוטוקול הודעות Extension ↔ Webview
// ===================================================
// כל התקשורת בין ה-Extension (Node.js) לבין ה-Webview (React)
// עוברת דרך postMessage עם הטיפוסים האלה
// ===================================================

import type {
  Agent,
  AgentId,
  ChatMessage,
  Conversation,
  FileDiff,
  GitInfo,
  ModelId,
  Project,
  ProjectHealth,
  QuickAction,
  Skill,
  SmartNotification,
  UserSettings,
  Workflow,
  WorkflowRun,
  ChatTemplate,
  TimelineEvent,
} from './types';

// -------------------------------------------------
// הודעות מה-Webview אל ה-Extension
// (המשתמש לחץ משהו → שולח ל-Extension לטפל)
// -------------------------------------------------

export type WebviewToExtensionMessage =
  // --- צ'אט ---
  | { type: 'sendMessage'; payload: { content: string; images?: string[] } }
  | { type: 'cancelRequest' }
  | { type: 'clearChat' }
  | { type: 'newChat' }
  | { type: 'loadConversation'; payload: { conversationId: string } }
  | { type: 'deleteConversation'; payload: { conversationId: string } }
  | { type: 'toggleBookmark'; payload: { messageId: string } }
  | { type: 'togglePin'; payload: { messageId: string } }

  // --- פרויקטים ---
  | { type: 'createProject'; payload: { name: string; path: string; description?: string } }
  | { type: 'openProject'; payload: { projectId: string } }
  | { type: 'deleteProject'; payload: { projectId: string } }
  | { type: 'refreshProject'; payload: { projectId: string } }
  | { type: 'importProject' }
  | { type: 'getProjects' }
  | { type: 'getProjectHealth'; payload: { projectId: string } }

  // --- סוכנים ---
  | { type: 'switchAgent'; payload: { agentId: AgentId } }
  | { type: 'runWorkflow'; payload: { workflowId: string; input: string } }
  | { type: 'cancelWorkflow' }

  // --- הגדרות ---
  | { type: 'getSettings' }
  | { type: 'updateSettings'; payload: Partial<UserSettings> }
  | { type: 'switchModel'; payload: { model: ModelId } }

  // --- Git ---
  | { type: 'getGitInfo' }
  | { type: 'getGitDiff' }
  | { type: 'gitCommit'; payload: { message: string } }
  | { type: 'gitPush' }

  // --- Skills ---
  | { type: 'getSkills' }
  | { type: 'installSkill'; payload: { skillId: string } }
  | { type: 'uninstallSkill'; payload: { skillId: string } }
  | { type: 'toggleSkill'; payload: { skillId: string } }

  // --- כלים ---
  | { type: 'approveToolUse'; payload: { toolUseId: string } }
  | { type: 'denyToolUse'; payload: { toolUseId: string } }

  // --- Slash Commands ---
  | { type: 'slashCommand'; payload: { command: string; args?: string } }

  // --- Quick Actions ---
  | { type: 'executeQuickAction'; payload: { actionId: string } }

  // --- תבניות ---
  | { type: 'saveTemplate'; payload: { name: string; content: string; tags: string[] } }
  | { type: 'deleteTemplate'; payload: { templateId: string } }
  | { type: 'getTemplates' }

  // --- Terminal ---
  | { type: 'runTerminalCommand'; payload: { command: string } }

  // --- Screenshot to Code ---
  | { type: 'screenshotToCode'; payload: { imageData: string } }

  // --- Voice Input ---
  | { type: 'voiceInputResult'; payload: { text: string } }

  // --- Dependencies ---
  | { type: 'scanDependencies' }

  // --- Timeline ---
  | { type: 'getTimeline'; payload: { projectId: string } }

  // --- חיפוש ---
  | { type: 'searchMessages'; payload: { query: string } }

  // --- ייצוא ---
  | { type: 'exportChat'; payload: { format: 'markdown' | 'html' | 'clipboard' } }

  // --- Webview מוכן ---
  | { type: 'webviewReady' };

// -------------------------------------------------
// הודעות מה-Extension אל ה-Webview
// (ה-Extension מעדכן את ה-UI)
// -------------------------------------------------

export type ExtensionToWebviewMessage =
  // --- צ'אט ---
  | { type: 'addMessage'; payload: ChatMessage }
  | { type: 'updateMessage'; payload: { id: string; updates: Partial<ChatMessage> } }
  | { type: 'streamToken'; payload: { messageId: string; token: string } }
  | { type: 'streamComplete'; payload: { messageId: string; fullContent: string; tokenCount: number } }
  | { type: 'chatCleared' }
  | { type: 'conversationLoaded'; payload: Conversation }
  | { type: 'conversationList'; payload: Conversation[] }

  // --- פרויקטים ---
  | { type: 'projectList'; payload: Project[] }
  | { type: 'projectOpened'; payload: Project }
  | { type: 'projectHealth'; payload: ProjectHealth }
  | { type: 'projectCreated'; payload: Project }
  | { type: 'projectDeleted'; payload: { projectId: string } }

  // --- סוכנים ---
  | { type: 'agentList'; payload: Agent[] }
  | { type: 'agentSwitched'; payload: { agentId: AgentId } }
  | { type: 'workflowList'; payload: Workflow[] }
  | { type: 'workflowUpdate'; payload: WorkflowRun }

  // --- הגדרות ---
  | { type: 'settingsLoaded'; payload: UserSettings }
  | { type: 'modelSwitched'; payload: { model: ModelId } }

  // --- Git ---
  | { type: 'gitInfo'; payload: GitInfo }
  | { type: 'gitDiff'; payload: FileDiff[] }
  | { type: 'gitResult'; payload: { success: boolean; message: string } }

  // --- Skills ---
  | { type: 'skillList'; payload: Skill[] }
  | { type: 'skillInstalled'; payload: { skillId: string } }
  | { type: 'skillUninstalled'; payload: { skillId: string } }

  // --- כלים ---
  | { type: 'toolPermissionRequest'; payload: { toolUseId: string; toolName: string; input: Record<string, unknown> } }
  | { type: 'toolResult'; payload: { toolUseId: string; output: string; status: 'completed' | 'failed' } }

  // --- התראות ---
  | { type: 'notification'; payload: SmartNotification }

  // --- Quick Actions ---
  | { type: 'quickActionList'; payload: QuickAction[] }

  // --- תבניות ---
  | { type: 'templateList'; payload: ChatTemplate[] }

  // --- Terminal ---
  | { type: 'terminalOutput'; payload: { output: string; exitCode: number } }

  // --- Dependencies ---
  | { type: 'dependencyScanResult'; payload: { outdated: number; vulnerable: number; details: string } }

  // --- Timeline ---
  | { type: 'timelineEvents'; payload: TimelineEvent[] }

  // --- חיפוש ---
  | { type: 'searchResults'; payload: { matches: ChatMessage[]; total: number } }

  // --- סטטוס ---
  | { type: 'statusUpdate'; payload: { status: 'idle' | 'thinking' | 'streaming' | 'error'; message?: string } }
  | { type: 'costUpdate'; payload: { sessionCost: number; totalTokens: number } }
  | { type: 'error'; payload: { message: string; code?: string } }

  // --- File Explorer ---
  | { type: 'fileTree'; payload: FileTreeNode[] }
  | { type: 'activeFileChanged'; payload: { filePath: string } };

// -------------------------------------------------
// File Tree
// -------------------------------------------------

/** צומת בעץ הקבצים */
export interface FileTreeNode {
  /** שם הקובץ/תיקייה */
  name: string;
  /** נתיב מלא */
  path: string;
  /** האם תיקייה */
  isDirectory: boolean;
  /** ילדים (אם תיקייה) */
  children?: FileTreeNode[];
  /** סוג קובץ (לאייקון) */
  fileType?: string;
}
