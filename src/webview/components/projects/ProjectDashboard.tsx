// ===================================================
// ProjectDashboard — דשבורד פרויקטים
// ===================================================
// מסך ראשי — מציג כרטיסיות של כל הפרויקטים
// ===================================================

import React from 'react';
import { useApp } from '../../state/AppContext';
import { ProjectCard } from './ProjectCard';

export function ProjectDashboard() {
  const { state, sendMessage } = useApp();

  return (
    <div className="p-4 animate-fade-in">
      {/* כותרת */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-bold">הפרויקטים שלי</h1>
          <p className="text-xs opacity-60 mt-1">
            {state.projects.length} פרויקטים
          </p>
        </div>

        {/* כפתור הוספת פרויקט */}
        <button
          className="btn-primary flex items-center gap-2"
          onClick={() => sendMessage({ type: 'importProject' })}
        >
          <span>+</span>
          <span>פרויקט חדש</span>
        </button>
      </div>

      {/* רשימת פרויקטים */}
      {state.projects.length === 0 ? (
        <EmptyState onImport={() => sendMessage({ type: 'importProject' })} />
      ) : (
        <div className="grid gap-3">
          {state.projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onOpen={() => sendMessage({ type: 'openProject', payload: { projectId: project.id } })}
              onDelete={() => sendMessage({ type: 'deleteProject', payload: { projectId: project.id } })}
              onRefresh={() => sendMessage({ type: 'refreshProject', payload: { projectId: project.id } })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------
// EmptyState — כשאין פרויקטים
// -------------------------------------------------
function EmptyState({ onImport }: { onImport: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 opacity-60">
      <div className="text-4xl mb-4">📁</div>
      <h2 className="text-base font-medium mb-2">אין פרויקטים עדיין</h2>
      <p className="text-xs mb-6 text-center max-w-xs">
        הוסף את הפרויקט הראשון שלך כדי להתחיל לעבוד עם סוכני AI
      </p>
      <button className="btn-primary" onClick={onImport}>
        ייבוא פרויקט מתיקייה
      </button>
    </div>
  );
}
