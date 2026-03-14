// ===================================================
// AppContext — React Context Provider
// ===================================================
// מספק את ה-State וה-Dispatch לכל הקומפוננטות
// + חיבור לפרוטוקול ההודעות של VS Code
// ===================================================

import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import type { AppState, AppAction } from './appTypes';
import { appReducer, initialState } from './appReducer';
import type { ExtensionToWebviewMessage, WebviewToExtensionMessage } from '../../shared/messages';

// -------------------------------------------------
// Context Types
// -------------------------------------------------
interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  /** שליחת הודעה ל-Extension */
  sendMessage: (message: WebviewToExtensionMessage) => void;
}

// יצירת ה-Context
const AppContext = createContext<AppContextType | null>(null);

// -------------------------------------------------
// VS Code API — ממשק התקשורת עם ה-Extension
// -------------------------------------------------
declare function acquireVsCodeApi(): {
  postMessage: (message: unknown) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
};

// שמירת ה-API כ-singleton — נקרא רק פעם אחת
let vscodeApi: ReturnType<typeof acquireVsCodeApi> | null = null;

function getVsCodeApi() {
  if (!vscodeApi) {
    try {
      vscodeApi = acquireVsCodeApi();
    } catch {
      // לא בתוך VS Code (לדוגמה: פיתוח בדפדפן)
      console.warn('Not running inside VS Code webview');
    }
  }
  return vscodeApi;
}

// -------------------------------------------------
// Provider Component
// -------------------------------------------------
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // שליחת הודעה ל-Extension
  const sendMessage = useCallback((message: WebviewToExtensionMessage) => {
    getVsCodeApi()?.postMessage(message);
  }, []);

  // -------------------------------------------------
  // זיהוי מצב אופליין — navigator.onLine + אירועים
  // -------------------------------------------------
  useEffect(() => {
    // עדכון ראשוני
    dispatch({ type: 'SET_OFFLINE', payload: !navigator.onLine });

    const goOffline = () => dispatch({ type: 'SET_OFFLINE', payload: true });
    const goOnline = () => {
      dispatch({ type: 'SET_OFFLINE', payload: false });
      // כשחוזר אונליין — שולחים הודעות שבתור
      // (ה-ChatPanel ידאג לשלוח מחדש)
    };

    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  // -------------------------------------------------
  // האזנה להודעות מה-Extension
  // -------------------------------------------------
  useEffect(() => {
    // רשימת timers לניקוי בעת unmount
    const pendingTimers: ReturnType<typeof setTimeout>[] = [];

    function handleMessage(event: MessageEvent<ExtensionToWebviewMessage>) {
      try {
      const message = event.data;

      switch (message.type) {
        // --- צ'אט ---
        case 'addMessage':
          dispatch({ type: 'ADD_MESSAGE', payload: message.payload });
          break;
        case 'updateMessage':
          dispatch({ type: 'UPDATE_MESSAGE', payload: message.payload });
          break;
        case 'streamToken':
          dispatch({ type: 'STREAM_TOKEN', payload: message.payload });
          break;
        case 'streamComplete':
          dispatch({ type: 'STREAM_COMPLETE', payload: message.payload });
          break;
        case 'chatCleared':
          dispatch({ type: 'CLEAR_MESSAGES' });
          break;
        case 'conversationLoaded':
          dispatch({ type: 'LOAD_CONVERSATION', payload: message.payload });
          break;
        case 'conversationList':
          dispatch({ type: 'SET_CONVERSATIONS', payload: message.payload });
          break;

        // --- פרויקטים ---
        case 'projectList':
          dispatch({ type: 'SET_PROJECTS', payload: message.payload });
          break;
        case 'projectOpened':
          dispatch({ type: 'SET_ACTIVE_PROJECT', payload: message.payload });
          break;
        case 'projectHealth':
          dispatch({ type: 'SET_PROJECT_HEALTH', payload: message.payload });
          break;
        case 'projectCreated':
          dispatch({ type: 'ADD_PROJECT', payload: message.payload });
          break;
        case 'projectDeleted':
          dispatch({ type: 'REMOVE_PROJECT', payload: message.payload.projectId });
          break;

        // --- סוכנים ---
        case 'agentList':
          dispatch({ type: 'SET_AGENTS', payload: message.payload });
          break;
        case 'agentSwitched':
          dispatch({ type: 'SET_ACTIVE_AGENT', payload: message.payload.agentId });
          break;
        case 'workflowList':
          dispatch({ type: 'SET_WORKFLOWS', payload: message.payload });
          break;
        case 'workflowUpdate':
          dispatch({ type: 'SET_WORKFLOW_RUN', payload: message.payload });
          break;

        // --- הגדרות ---
        case 'settingsLoaded':
          dispatch({ type: 'SET_SETTINGS', payload: message.payload });
          break;
        case 'modelSwitched':
          dispatch({ type: 'SET_MODEL', payload: message.payload.model });
          break;

        // --- Git ---
        case 'gitInfo':
          dispatch({ type: 'SET_GIT_INFO', payload: message.payload });
          break;
        case 'gitDiff':
          dispatch({ type: 'SET_FILE_DIFFS', payload: message.payload });
          break;
        case 'diffContent':
          dispatch({ type: 'SET_DIFF_CONTENT', payload: message.payload });
          break;

        // --- Skills ---
        case 'skillList':
          dispatch({ type: 'SET_SKILLS', payload: message.payload });
          break;

        // --- התראות ---
        case 'notification':
          dispatch({ type: 'ADD_NOTIFICATION', payload: message.payload });
          break;

        // --- סטטוס ---
        case 'statusUpdate':
          dispatch({
            type: 'SET_STATUS',
            payload: { status: message.payload.status, message: message.payload.message },
          });
          break;
        case 'costUpdate':
          dispatch({ type: 'SET_COST', payload: message.payload });
          break;
        case 'error':
          dispatch({ type: 'SET_ERROR', payload: message.payload.message });
          break;

        // --- File Explorer ---
        case 'fileTree':
          dispatch({ type: 'SET_FILE_TREE', payload: message.payload });
          break;
        case 'activeFileChanged':
          dispatch({ type: 'SET_ACTIVE_FILE', payload: message.payload.filePath });
          break;

        // --- Templates ---
        case 'templateList':
          dispatch({ type: 'SET_TEMPLATES', payload: message.payload });
          break;

        // --- Timeline ---
        case 'timelineEvents':
          dispatch({ type: 'SET_TIMELINE', payload: message.payload });
          break;

        // --- חיפוש ---
        case 'searchResults':
          // התוצאות מגיעות מה-Extension — מעדכנים את ה-state
          // (בפועל החיפוש המקומי בשיחה הנוכחית מתבצע ב-ChatPanel)
          break;

        // --- Tool Permissions ---
        case 'toolPermissionRequest':
          dispatch({ type: 'ADD_TOOL_PERMISSION', payload: message.payload });
          break;
        case 'toolResult':
          dispatch({ type: 'REMOVE_TOOL_PERMISSION', payload: message.payload.toolUseId });
          break;

        // --- Onboarding ---
        case 'onboardingStatus':
          if (message.payload.completed) {
            dispatch({ type: 'SET_ONBOARDING_SEEN', payload: true });
          }
          break;

        // --- שמירה אוטומטית ושחזור מושב ---
        case 'draftLoaded':
          dispatch({ type: 'SET_DRAFT', payload: message.payload });
          break;
        case 'autoSaveStatus':
          dispatch({ type: 'SET_AUTO_SAVE', payload: { timestamp: message.payload.timestamp } });
          // הסתרת אינדיקטור שמירה אחרי 2 שניות
          pendingTimers.push(setTimeout(() => {
            dispatch({ type: 'HIDE_SAVE_INDICATOR' });
          }, 2_000));
          break;
        case 'sessionRestored':
          dispatch({
            type: 'SET_SESSION_RESTORED',
            payload: { scrollPosition: message.payload.scrollPosition },
          });
          // ניקוי דגל שחזור אחרי 3 שניות
          pendingTimers.push(setTimeout(() => {
            dispatch({ type: 'CLEAR_SESSION_RESTORED' });
          }, 3_000));
          break;
      }
      } catch (err) {
        console.error('[AppContext] Error handling message:', err);
      }
    }

    // רישום listener
    window.addEventListener('message', handleMessage);

    // הודעה ל-Extension שה-Webview מוכן
    sendMessage({ type: 'webviewReady' });

    // ניקוי — הסרת listener וטיימרים כשהקומפוננטה נהרסת
    return () => {
      window.removeEventListener('message', handleMessage);
      pendingTimers.forEach(clearTimeout);
    };
  }, [sendMessage]);

  return (
    <AppContext.Provider value={{ state, dispatch, sendMessage }}>
      {children}
    </AppContext.Provider>
  );
}

// -------------------------------------------------
// useApp — Hook לגישה ל-Context
// -------------------------------------------------
export function useApp(): AppContextType {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
