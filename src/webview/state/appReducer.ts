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
  settings: null,
  gitInfo: null,
  fileDiffs: [],
  skills: [],
  notifications: [],
  quickActions: QUICK_ACTIONS,
  quickActionsVisible: true,
  templates: [],
  timelineEvents: [],
  sidebarOpen: false,
  sidebarTab: 'history',
  searchQuery: '',
  activeFile: null,
  fileTree: [],
  sessionCost: 0,
  totalTokens: 0,
  onboardingSeen: false,
  imageAttachments: [],
  pendingToolPermissions: [],
  workflowPickerOpen: false,
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
        // ניקוי הודעות כשעוברים פרויקט
        messages: action.payload ? [] : state.messages,
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
        // ניקוי הודעות כשמחליפים סוכן (כל סוכן = צ'אט נפרד)
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
        errorMessage: action.payload.message ?? null,
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

    case 'SET_ACTIVE_FILE':
      return { ...state, activeFile: action.payload };

    case 'SET_FILE_TREE':
      return { ...state, fileTree: action.payload };

    // --- עלות ---
    case 'SET_COST':
      return {
        ...state,
        sessionCost: state.sessionCost + action.payload.sessionCost,
        totalTokens: state.totalTokens + action.payload.totalTokens,
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

    // --- שגיאה ---
    case 'SET_ERROR':
      return { ...state, errorMessage: action.payload };

    default:
      return state;
  }
}
