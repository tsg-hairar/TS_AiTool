// ===================================================
// App State Types — טיפוסי ה-State הגלובלי
// ===================================================

import type {
  Project,
  Agent,
  AgentId,
  ChatMessage,
  Conversation,
  Workflow,
  WorkflowRun,
  UserSettings,
  GitInfo,
  FileDiff,
  Skill,
  SmartNotification,
  QuickAction,
  ProjectHealth,
  ChatTemplate,
  TimelineEvent,
  ModelId,
} from '../../shared/types';
import type { FileTreeNode } from '../../shared/messages';

// -------------------------------------------------
// State — המצב הגלובלי של האפליקציה
// -------------------------------------------------
export interface AppState {
  // --- תצוגה נוכחית ---
  currentView: 'projects' | 'chat' | 'settings' | 'skills' | 'onboarding';

  // --- פרויקטים ---
  projects: Project[];
  activeProject: Project | null;
  projectHealth: ProjectHealth | null;

  // --- סוכנים ---
  agents: Agent[];
  activeAgentId: AgentId;
  workflows: Workflow[];
  workflowRun: WorkflowRun | null;

  // --- צ'אט ---
  messages: ChatMessage[];
  conversations: Conversation[];
  inputText: string;
  status: 'idle' | 'thinking' | 'streaming' | 'error';
  errorMessage: string | null;

  // --- הגדרות ---
  settings: UserSettings | null;

  // --- Git ---
  gitInfo: GitInfo | null;
  fileDiffs: FileDiff[];

  // --- Skills ---
  skills: Skill[];

  // --- התראות ---
  notifications: SmartNotification[];

  // --- Quick Actions ---
  quickActions: QuickAction[];
  quickActionsVisible: boolean;

  // --- תבניות ---
  templates: ChatTemplate[];

  // --- Timeline ---
  timelineEvents: TimelineEvent[];

  // --- UI State ---
  sidebarOpen: boolean;
  sidebarTab: 'history' | 'files' | 'search' | 'bookmarks';
  searchQuery: string;
  activeFile: string | null;
  fileTree: FileTreeNode[];

  // --- עלות ---
  sessionCost: number;
  totalTokens: number;

  // --- Onboarding ---
  onboardingSeen: boolean;

  // --- Images ---
  imageAttachments: string[];

  // --- Tool Permissions ---
  pendingToolPermissions: Array<{
    toolUseId: string;
    toolName: string;
    input: Record<string, unknown>;
  }>;

  // --- Workflow Picker ---
  workflowPickerOpen: boolean;
}

// -------------------------------------------------
// Actions — כל הפעולות האפשריות על ה-State
// -------------------------------------------------
export type AppAction =
  // תצוגה
  | { type: 'SET_VIEW'; payload: AppState['currentView'] }

  // פרויקטים
  | { type: 'SET_PROJECTS'; payload: Project[] }
  | { type: 'SET_ACTIVE_PROJECT'; payload: Project | null }
  | { type: 'ADD_PROJECT'; payload: Project }
  | { type: 'REMOVE_PROJECT'; payload: string }
  | { type: 'SET_PROJECT_HEALTH'; payload: ProjectHealth }

  // סוכנים
  | { type: 'SET_AGENTS'; payload: Agent[] }
  | { type: 'SET_ACTIVE_AGENT'; payload: AgentId }
  | { type: 'SET_WORKFLOWS'; payload: Workflow[] }
  | { type: 'SET_WORKFLOW_RUN'; payload: WorkflowRun | null }

  // צ'אט
  | { type: 'ADD_MESSAGE'; payload: ChatMessage }
  | { type: 'UPDATE_MESSAGE'; payload: { id: string; updates: Partial<ChatMessage> } }
  | { type: 'STREAM_TOKEN'; payload: { messageId: string; token: string } }
  | { type: 'STREAM_COMPLETE'; payload: { messageId: string; fullContent: string; tokenCount: number } }
  | { type: 'CLEAR_MESSAGES' }
  | { type: 'LOAD_CONVERSATION'; payload: Conversation }
  | { type: 'SET_CONVERSATIONS'; payload: Conversation[] }
  | { type: 'SET_INPUT'; payload: string }
  | { type: 'SET_STATUS'; payload: { status: AppState['status']; message?: string } }

  // הגדרות
  | { type: 'SET_SETTINGS'; payload: UserSettings }
  | { type: 'SET_MODEL'; payload: ModelId }

  // Git
  | { type: 'SET_GIT_INFO'; payload: GitInfo }
  | { type: 'SET_FILE_DIFFS'; payload: FileDiff[] }

  // Skills
  | { type: 'SET_SKILLS'; payload: Skill[] }

  // התראות
  | { type: 'ADD_NOTIFICATION'; payload: SmartNotification }
  | { type: 'REMOVE_NOTIFICATION'; payload: string }

  // Quick Actions
  | { type: 'SET_QUICK_ACTIONS'; payload: QuickAction[] }
  | { type: 'TOGGLE_QUICK_ACTIONS' }

  // תבניות
  | { type: 'SET_TEMPLATES'; payload: ChatTemplate[] }

  // Timeline
  | { type: 'SET_TIMELINE'; payload: TimelineEvent[] }

  // UI
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'SET_SIDEBAR_TAB'; payload: AppState['sidebarTab'] }
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  | { type: 'SET_ACTIVE_FILE'; payload: string | null }
  | { type: 'SET_FILE_TREE'; payload: FileTreeNode[] }

  // עלות
  | { type: 'SET_COST'; payload: { sessionCost: number; totalTokens: number } }

  // תמונות
  | { type: 'ADD_IMAGE'; payload: string }
  | { type: 'REMOVE_IMAGE'; payload: number }
  | { type: 'CLEAR_IMAGES' }

  // Onboarding
  | { type: 'SET_ONBOARDING_SEEN'; payload: boolean }

  // Tool Permissions
  | { type: 'ADD_TOOL_PERMISSION'; payload: { toolUseId: string; toolName: string; input: Record<string, unknown> } }
  | { type: 'REMOVE_TOOL_PERMISSION'; payload: string }

  // Workflow Picker
  | { type: 'TOGGLE_WORKFLOW_PICKER' }

  // שגיאה
  | { type: 'SET_ERROR'; payload: string | null };
