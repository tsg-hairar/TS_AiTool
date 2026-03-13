// ===================================================
// ProjectCard — כרטיס פרויקט
// ===================================================
// מציג מידע על פרויקט: שם, tech stack, בריאות, פעילות
// ===================================================

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Project } from '../../../shared/types';
import { ConfirmDialog } from '../common/ConfirmDialog';

interface ProjectCardProps {
  project: Project;
  onOpen: () => void;
  onDelete: () => void;
  onRefresh: () => void;
}

export function ProjectCard({ project, onOpen, onDelete, onRefresh }: ProjectCardProps) {
  const { t, i18n } = useTranslation();
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // חישוב צבע ציון הבריאות
  const healthColor =
    project.healthScore >= 80 ? '#10b981' :
    project.healthScore >= 50 ? '#f59e0b' :
    '#ef4444';

  return (
    <div
      role="article"
      aria-label={t('projects.projectAria', { name: project.name })}
      className="card cursor-pointer group"
      onClick={onOpen}
      style={{ borderRightColor: project.color, borderRightWidth: 3 }}
    >
      <div className="flex items-start justify-between">
        {/* מידע ראשי */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">{project.icon}</span>
            <h3 className="text-sm font-semibold truncate">{project.name}</h3>
          </div>

          {/* תיאור */}
          {project.description && (
            <p className="text-xs opacity-50 truncate mb-2">
              {project.description}
            </p>
          )}

          {/* Tech Stack */}
          <div className="flex flex-wrap gap-1 mb-2">
            {project.techStack.slice(0, 5).map((tech) => (
              <span
                key={tech}
                className="text-[10px] px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(255,255,255,0.08)' }}
              >
                {tech}
              </span>
            ))}
            {project.techStack.length > 5 && (
              <span className="text-[10px] opacity-40">
                +{project.techStack.length - 5}
              </span>
            )}
          </div>

          {/* סטטיסטיקות */}
          <div className="flex items-center gap-3 text-[10px] opacity-50">
            <span>{project.chatCount} {t('projects.conversations')}</span>
            <span>{t('projects.updatedAt', { date: formatDate(project.lastOpenedAt, t, i18n.language) })}</span>
          </div>
        </div>

        {/* ציון בריאות */}
        <div className="flex flex-col items-center gap-1 mr-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold"
            style={{
              border: `2px solid ${healthColor}`,
              color: healthColor,
            }}
          >
            {project.healthScore}
          </div>

          {/* תפריט */}
          <div className="relative">
            <button
              className="btn-ghost text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              aria-label={t('projects.projectMenu')}
              aria-haspopup="true"
              aria-expanded={showMenu}
            >
              ⋮
            </button>

            {showMenu && (
              <div
                role="menu"
                aria-label={t('projects.projectActions')}
                className="absolute left-0 top-full mt-1 rounded-md shadow-lg py-1 z-10 menu-enter"
                style={{ background: 'var(--vscode-input-background)' }}
              >
                <button
                  role="menuitem"
                  className="block w-full text-right px-3 py-1 text-xs hover:bg-white/10 transition-smooth"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRefresh();
                    setShowMenu(false);
                  }}
                >
                  {t('projects.refresh')}
                </button>
                <button
                  role="menuitem"
                  className="block w-full text-right px-3 py-1 text-xs hover:bg-white/10 text-red-400 transition-smooth"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeleteConfirm(true);
                    setShowMenu(false);
                  }}
                >
                  {t('projects.delete')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* דיאלוג אישור מחיקה */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title={t('projects.deleteConfirmTitle')}
        message={t('projects.deleteConfirmMessage', { name: project.name })}
        confirmLabel={t('projects.deleteLabel')}
        cancelLabel={t('projects.cancelLabel')}
        variant="danger"
        onConfirm={() => {
          setShowDeleteConfirm(false);
          onDelete();
        }}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}

// -------------------------------------------------
// formatDate — עיצוב תאריך יחסי
// -------------------------------------------------
function formatDate(dateStr: string, t: (key: string, opts?: any) => string, lang: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return t('projects.now');
  if (diffMins < 60) return t('projects.minutesAgo', { count: diffMins });
  if (diffHours < 24) return t('projects.hoursAgo', { count: diffHours });
  if (diffDays < 7) return t('projects.daysAgo', { count: diffDays });
  return date.toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US');
}
