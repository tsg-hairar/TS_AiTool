// ===================================================
// App — קומפוננטת השורש
// ===================================================
// מנתב בין תצוגות: פרויקטים, צ'אט, הגדרות, Skills
// כולל דיאלוגים גלובליים: Tool Permissions, Workflow Picker
// ===================================================

import React from 'react';
import { useApp } from './state/AppContext';
import { ProjectDashboard } from './components/projects/ProjectDashboard';
import { ChatPanel } from './components/chat/ChatPanel';
import { SettingsPanel } from './components/settings/SettingsPanel';
import { Toolbar } from './components/common/Toolbar';
import { Toast } from './components/common/Toast';
import { ToolPermissionDialog } from './components/common/ToolPermissionDialog';
import { WorkflowPicker } from './components/agents/WorkflowPicker';

export function App() {
  const { state } = useApp();

  // --- ניתוב תצוגות ---
  function renderView() {
    switch (state.currentView) {
      case 'projects':
        return <ProjectDashboard />;
      case 'chat':
        return <ChatPanel />;
      case 'settings':
        return <SettingsPanel />;
      case 'skills':
        return <div className="p-4">Skills Marketplace — בקרוב</div>;
      default:
        return <ProjectDashboard />;
    }
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* סרגל כלים עליון */}
      <Toolbar />

      {/* תוכן ראשי */}
      <main className="flex-1 overflow-y-auto">
        {renderView()}
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
