// ===================================================
// App — קומפוננטת השורש
// ===================================================
// מנתב בין תצוגות: פרויקטים, צ'אט, הגדרות, Skills
// כולל דיאלוגים גלובליים: Tool Permissions, Workflow Picker
// תמיכה ב-RTL אוטומטית לפי שפה
// ===================================================

import React, { useEffect, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from './state/AppContext';
import { ProjectDashboard } from './components/projects/ProjectDashboard';
import { ChatPanel } from './components/chat/ChatPanel';
import { Toolbar } from './components/common/Toolbar';
import { Toast } from './components/common/Toast';
import { ToolPermissionDialog } from './components/common/ToolPermissionDialog';
import { WorkflowPicker } from './components/agents/WorkflowPicker';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { WelcomeScreen } from './components/common/WelcomeScreen';
import { getDirection } from './i18n';

// Lazy loading — הגדרות נטענות רק כשנכנסים לדף
const SettingsPanel = lazy(() =>
  import('./components/settings/SettingsPanel').then(m => ({ default: m.SettingsPanel })),
);

export function App() {
  const { state, dispatch } = useApp();
  const { t, i18n } = useTranslation();

  // Onboarding status is now received from the extension host via
  // the 'onboardingStatus' message (stored in globalState, not localStorage).

  // --- סנכרון שפת i18n עם הגדרות המשתמש ---
  useEffect(() => {
    if (state.settings?.language && i18n.language !== state.settings.language) {
      i18n.changeLanguage(state.settings.language);
    }
  }, [state.settings?.language, i18n]);

  // --- עדכון כיוון הדף (RTL/LTR) לפי שפה ---
  useEffect(() => {
    const dir = getDirection(i18n.language);
    document.documentElement.setAttribute('dir', dir);
    document.documentElement.setAttribute('lang', i18n.language);
  }, [i18n.language]);

  // --- הצגת אשף onboarding למשתמש חדש ---
  if (!state.onboardingSeen) {
    return <WelcomeScreen />;
  }

  // --- ניתוב תצוגות — כל תצוגה עטופה ב-ErrorBoundary ---
  function renderView() {
    switch (state.currentView) {
      case 'projects':
        return (
          <ErrorBoundary fallbackMessage={t('errorBoundary.projectsDashboard')}>
            <ProjectDashboard />
          </ErrorBoundary>
        );
      case 'chat':
        return (
          <ErrorBoundary fallbackMessage={t('errorBoundary.chat')}>
            <ChatPanel />
          </ErrorBoundary>
        );
      case 'settings':
        return (
          <ErrorBoundary fallbackMessage={t('errorBoundary.settings')}>
            <Suspense fallback={
              <div className="p-4 text-center opacity-40">
                {t('chat.lazyLoading', 'Loading...')}
              </div>
            }>
              <SettingsPanel />
            </Suspense>
          </ErrorBoundary>
        );
      case 'skills':
        return <div className="p-4">{t('app.skillsComingSoon')}</div>;
      default:
        return (
          <ErrorBoundary fallbackMessage={t('errorBoundary.projectsDashboard')}>
            <ProjectDashboard />
          </ErrorBoundary>
        );
    }
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* סרגל כלים עליון */}
      <Toolbar />

      {/* תוכן ראשי — view-enter animation applied per view */}
      <main className="flex-1 overflow-y-auto" key={state.currentView}>
        <div className="view-enter h-full">
          {renderView()}
        </div>
      </main>

      {/* התראות Toast */}
      <Toast />

      {/* דיאלוג אישור כלים — מוצג מעל הכל */}
      <ToolPermissionDialog />

      {/* דיאלוג בחירת Workflow */}
      <WorkflowPicker />
    </div>
  );
}
