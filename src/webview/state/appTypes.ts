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
  DiffFile,
  FileAttachment,
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
  /** הודעת התקדמות — מה Claude עושה עכשיו */
  statusMessage: string | null;

  // --- הגדרות ---
  settings: UserSettings | null;

  // --- Git ---
  gitInfo: GitInfo | null;
  fileDiffs: FileDiff[];
  /** תוכן diff מלא עם hunks — לתצוגת DiffViewer */
  diffFiles: DiffFile[];
  /** האם ה-diff הוא staged */
  diffStaged: boolean;

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
  /** האם סרגל החיפוש פתוח */
  searchOpen: boolean;
  /** אינדקסים של הודעות תואמות (באינדקס של messages[]) */
  searchMatchIndices: number[];
  /** אינדקס התוצאה הנוכחית בתוך searchMatchIndices */
  searchCurrentMatch: number;
  activeFile: string | null;
  fileTree: FileTreeNode[];

  // --- עלות ---
  sessionCost: number;
  totalTokens: number;

  // --- Onboarding ---
  onboardingSeen: boolean;

  // --- Images ---
  imageAttachments: string[];

  // --- File Attachments ---
  fileAttachments: FileAttachment[];

  // --- Tool Permissions ---
  pendingToolPermissions: Array<{
    toolUseId: string;
    toolName: string;
    input: Record<string, unknown>;
  }>;

  // --- Workflow Picker ---
  workflowPickerOpen: boolean;

  // --- Offline / Connection ---
  /** האם המשתמש במצב אופליין (אין חיבור לרשת) */
  isOffline: boolean;
  /** הודעות שנכשלו בגלל בעיית חיבור — לשליחה חוזרת */
  queuedMessages: Array<{ content: string; images?: string[] }>;

  // --- שמירה אוטומטית ושחזור ---
  /** חותמת זמן שמירה אחרונה */
  lastAutoSave: string | null;
  /** האם להציג אינדיקטור שמירה */
  showSaveIndicator: boolean;
  /** האם המושב שוחזר */
  sessionRestored: boolean;
  /** מיקום גלילה לשחזור */
  restoreScrollPosition: number;
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
  | { type: 'SET_DIFF_CONTENT'; payload: { files: DiffFile[]; staged: boolean } }

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
  | { type: 'SET_SEARCH_OPEN'; payload: boolean }
  | { type: 'SET_SEARCH_MATCHES'; payload: number[] }
  | { type: 'SET_SEARCH_CURRENT_MATCH'; payload: number }
  | { type: 'SET_ACTIVE_FILE'; payload: string | null }
  | { type: 'SET_FILE_TREE'; payload: FileTreeNode[] }

  // עלות
  | { type: 'SET_COST'; payload: { sessionCost: number; totalTokens: number } }

  // תמונות
  | { type: 'ADD_IMAGE'; payload: string }
  | { type: 'REMOVE_IMAGE'; payload: number }
  | { type: 'CLEAR_IMAGES' }

  // קבצים מצורפים
  | { type: 'ADD_FILE_ATTACHMENT'; payload: FileAttachment }
  | { type: 'UPDATE_FILE_ATTACHMENT'; payload: { id: string; updates: Partial<FileAttachment> } }
  | { type: 'REMOVE_FILE_ATTACHMENT'; payload: string }
  | { type: 'CLEAR_FILE_ATTACHMENTS' }

  // Onboarding
  | { type: 'SET_ONBOARDING_SEEN'; payload: boolean }

  // Tool Permissions
  | { type: 'ADD_TOOL_PERMISSION'; payload: { toolUseId: string; toolName: string; input: Record<string, unknown> } }
  | { type: 'REMOVE_TOOL_PERMISSION'; payload: string }

  // Workflow Picker
  | { type: 'TOGGLE_WORKFLOW_PICKER' }

  // שמירה אוטומטית ושחזור מושב
  | { type: 'SET_AUTO_SAVE'; payload: { timestamp: string } }
  | { type: 'HIDE_SAVE_INDICATOR' }
  | { type: 'SET_SESSION_RESTORED'; payload: { scrollPosition: number } }
  | { type: 'CLEAR_SESSION_RESTORED' }
  | { type: 'SET_DRAFT'; payload: { conversationId: string; text: string } }

  // Offline / Connection
  | { type: 'SET_OFFLINE'; payload: boolean }
  | { type: 'QUEUE_MESSAGE'; payload: { content: string; images?: string[] } }
  | { type: 'CLEAR_QUEUED_MESSAGES' }

  // שגיאה
  | { type: 'SET_ERROR'; payload: string | null };
