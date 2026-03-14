// ===================================================
// App Reducer — ניהול State גלובלי
// ===================================================
// useReducer pattern — כל שינוי ב-State עובר דרך פה
// ===================================================

import type { AppState, AppAction } from './appTypes';
import { QUICK_ACTIONS } from '../../shared/constants';

// -------------------------------------------------
// Initial State — מצב התחלתי
// -------------------------------------------------
export const initialState: AppState = {
  currentView: 'projects',
  projects: [],
  activeProject: null,
  projectHealth: null,
  agents: [],
  activeAgentId: 'developer',
  workflows: [],
  workflowRun: null,
  messages: [],
  conversations: [],
  inputText: '',
  status: 'idle',
  errorMessage: null,
  statusMessage: null,
  settings: null,
  gitInfo: null,
  fileDiffs: [],
  diffFiles: [],
  diffStaged: false,
  skills: [],
  notifications: [],
  quickActions: QUICK_ACTIONS,
  quickActionsVisible: true,
  templates: [],
  timelineEvents: [],
  sidebarOpen: false,
  sidebarTab: 'history',
  searchQuery: '',
  searchOpen: false,
  searchMatchIndices: [],
  searchCurrentMatch: 0,
  activeFile: null,
  fileTree: [],
  sessionCost: 0,
  totalTokens: 0,
  onboardingSeen: false,
  imageAttachments: [],
  fileAttachments: [],
  pendingToolPermissions: [],
  workflowPickerOpen: false,
  isOffline: false,
  queuedMessages: [],
  lastAutoSave: null,
  showSaveIndicator: false,
  sessionRestored: false,
  restoreScrollPosition: 0,
};

// -------------------------------------------------
// Reducer — מטפל בכל ה-actions
// -------------------------------------------------
export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    // --- תצוגה ---
    case 'SET_VIEW':
      return { ...state, currentView: action.payload };

    // --- פרויקטים ---
    case 'SET_PROJECTS':
      return { ...state, projects: action.payload };

    case 'SET_ACTIVE_PROJECT':
      return {
        ...state,
        activeProject: action.payload,
        // מעבר אוטומטי לתצוגת צ'אט כשפותחים פרויקט
        currentView: action.payload ? 'chat' : 'projects',
        // מנקים messages כדי למנוע flash של הודעות מפרויקט קודם
        // LOAD_CONVERSATION יטען את ההיסטוריה של הפרויקט החדש
        messages: [],
      };

    case 'ADD_PROJECT':
      return { ...state, projects: [...state.projects, action.payload] };

    case 'REMOVE_PROJECT':
      return {
        ...state,
        projects: state.projects.filter((p) => p.id !== action.payload),
        // אם הפרויקט שנמחק הוא הפעיל — חזרה לדשבורד
        activeProject:
          state.activeProject?.id === action.payload ? null : state.activeProject,
        currentView:
          state.activeProject?.id === action.payload ? 'projects' : state.currentView,
      };

    case 'SET_PROJECT_HEALTH':
      return { ...state, projectHealth: action.payload };

    // --- סוכנים ---
    case 'SET_AGENTS':
      return { ...state, agents: action.payload };

    case 'SET_ACTIVE_AGENT':
      return {
        ...state,
        activeAgentId: action.payload,
        // מנקים messages כדי למנוע flash של הודעות מהסוכן הקודם
        // LOAD_CONVERSATION יטען את ההיסטוריה של הסוכן החדש
        messages: [],
      };

    case 'SET_WORKFLOWS':
      return { ...state, workflows: action.payload };

    case 'SET_WORKFLOW_RUN':
      return { ...state, workflowRun: action.payload };

    // --- צ'אט ---
    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.payload] };

    case 'UPDATE_MESSAGE':
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.payload.id ? { ...m, ...action.payload.updates } : m,
        ),
      };

    case 'STREAM_TOKEN':
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.payload.messageId
            ? { ...m, content: m.content + action.payload.token }
            : m,
        ),
      };

    case 'STREAM_COMPLETE':
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.payload.messageId
            ? {
                ...m,
                content: action.payload.fullContent,
                tokenCount: action.payload.tokenCount,
                isStreaming: false,
              }
            : m,
        ),
      };

    case 'CLEAR_MESSAGES':
      return { ...state, messages: [] };

    case 'LOAD_CONVERSATION':
      return {
        ...state,
        messages: action.payload.messages,
        activeAgentId: action.payload.agentId,
      };

    case 'SET_CONVERSATIONS':
      return { ...state, conversations: action.payload };

    case 'SET_INPUT':
      return { ...state, inputText: action.payload };

    case 'SET_STATUS':
      return {
        ...state,
        status: action.payload.status,
        // אם הסטטוס הוא error — שומרים ב-errorMessage
        // אחרת — שומרים ב-statusMessage (progress/info)
        errorMessage: action.payload.status === 'error'
          ? (action.payload.message ?? null)
          : state.errorMessage,
        statusMessage: action.payload.status !== 'error'
          ? (action.payload.message ?? null)
          : null,
      };

    // --- הגדרות ---
    case 'SET_SETTINGS':
      return {
        ...state,
        settings: action.payload,
        quickActionsVisible: action.payload.quickActionsVisible,
      };

    case 'SET_MODEL':
      return state.settings
        ? { ...state, settings: { ...state.settings, model: action.payload } }
        : state;

    // --- Git ---
    case 'SET_GIT_INFO':
      return { ...state, gitInfo: action.payload };

    case 'SET_FILE_DIFFS':
      return { ...state, fileDiffs: action.payload };

    case 'SET_DIFF_CONTENT':
      return {
        ...state,
        diffFiles: action.payload.files,
        diffStaged: action.payload.staged,
      };

    // --- Skills ---
    case 'SET_SKILLS':
      return { ...state, skills: action.payload };

    // --- התראות ---
    case 'ADD_NOTIFICATION':
      return {
        ...state,
        notifications: [...state.notifications, action.payload].slice(-50),
      };

    case 'REMOVE_NOTIFICATION':
      return {
        ...state,
        notifications: state.notifications.filter((n) => n.id !== action.payload),
      };

    // --- Quick Actions ---
    case 'SET_QUICK_ACTIONS':
      return { ...state, quickActions: action.payload };

    case 'TOGGLE_QUICK_ACTIONS':
      return { ...state, quickActionsVisible: !state.quickActionsVisible };

    // --- תבניות ---
    case 'SET_TEMPLATES':
      return { ...state, templates: action.payload };

    // --- Timeline ---
    case 'SET_TIMELINE':
      return { ...state, timelineEvents: action.payload };

    // --- UI ---
    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarOpen: !state.sidebarOpen };

    case 'SET_SIDEBAR_TAB':
      return { ...state, sidebarTab: action.payload, sidebarOpen: true };

    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.payload };

    case 'SET_SEARCH_OPEN':
      return {
        ...state,
        searchOpen: action.payload,
        // כשסוגרים — מנקים את החיפוש
        ...(action.payload
          ? {}
          : { searchQuery: '', searchMatchIndices: [], searchCurrentMatch: 0 }),
      };

    case 'SET_SEARCH_MATCHES':
      return { ...state, searchMatchIndices: action.payload, searchCurrentMatch: 0 };

    case 'SET_SEARCH_CURRENT_MATCH':
      return { ...state, searchCurrentMatch: action.payload };

    case 'SET_ACTIVE_FILE':
      return { ...state, activeFile: action.payload };

    case 'SET_FILE_TREE':
      return { ...state, fileTree: action.payload };

    // --- עלות ---
    // אם messageId קיים — נשתמש בו למניעת ספירה כפולה
    // אם לא — נוסיף ישירות (תאימות אחורה)
    case 'SET_COST':
      return {
        ...state,
        sessionCost: action.payload.absolute
          ? action.payload.sessionCost
          : state.sessionCost + action.payload.sessionCost,
        totalTokens: action.payload.absolute
          ? action.payload.totalTokens
          : state.totalTokens + action.payload.totalTokens,
      };

    // --- תמונות ---
    case 'ADD_IMAGE':
      return { ...state, imageAttachments: [...state.imageAttachments, action.payload] };

    case 'REMOVE_IMAGE':
      return {
        ...state,
        imageAttachments: state.imageAttachments.filter((_, i) => i !== action.payload),
      };

    case 'CLEAR_IMAGES':
      return { ...state, imageAttachments: [] };

    // --- קבצים מצורפים ---
    case 'ADD_FILE_ATTACHMENT':
      return { ...state, fileAttachments: [...state.fileAttachments, action.payload] };

    case 'UPDATE_FILE_ATTACHMENT':
      return {
        ...state,
        fileAttachments: state.fileAttachments.map((f) =>
          f.id === action.payload.id ? { ...f, ...action.payload.updates } : f,
        ),
      };

    case 'REMOVE_FILE_ATTACHMENT':
      return {
        ...state,
        fileAttachments: state.fileAttachments.filter((f) => f.id !== action.payload),
      };

    case 'CLEAR_FILE_ATTACHMENTS':
      return { ...state, fileAttachments: [] };

    // --- Onboarding ---
    case 'SET_ONBOARDING_SEEN':
      return { ...state, onboardingSeen: action.payload };

    // --- Tool Permissions ---
    case 'ADD_TOOL_PERMISSION':
      return {
        ...state,
        pendingToolPermissions: [...state.pendingToolPermissions, action.payload],
      };

    case 'REMOVE_TOOL_PERMISSION':
      return {
        ...state,
        pendingToolPermissions: state.pendingToolPermissions.filter(
          (p) => p.toolUseId !== action.payload,
        ),
      };

    // --- Workflow Picker ---
    case 'TOGGLE_WORKFLOW_PICKER':
      return { ...state, workflowPickerOpen: !state.workflowPickerOpen };

    // --- שמירה אוטומטית ושחזור ---
    case 'SET_AUTO_SAVE':
      return {
        ...state,
        lastAutoSave: action.payload.timestamp,
        showSaveIndicator: true,
      };

    case 'HIDE_SAVE_INDICATOR':
      return { ...state, showSaveIndicator: false };

    case 'SET_SESSION_RESTORED':
      return {
        ...state,
        sessionRestored: true,
        restoreScrollPosition: action.payload.scrollPosition,
      };

    case 'CLEAR_SESSION_RESTORED':
      return { ...state, sessionRestored: false };

    case 'SET_DRAFT':
      return { ...state, inputText: action.payload.text };

    // --- Offline / Connection ---
    case 'SET_OFFLINE':
      return { ...state, isOffline: action.payload };

    case 'QUEUE_MESSAGE':
      return { ...state, queuedMessages: [...state.queuedMessages, action.payload] };

    case 'CLEAR_QUEUED_MESSAGES':
      return { ...state, queuedMessages: [] };

    // --- שגיאה ---
    // מחרוזת ריקה או null = ניקוי שגיאה
    case 'SET_ERROR':
      return { ...state, errorMessage: action.payload || null };

    default:
      return state;
  }
}
