// ===================================================
// ProjectDashboard — דשבורד פרויקטים
// ===================================================
// מסך ראשי — מציג כרטיסיות של כל הפרויקטים
// + עץ קבצים כשיש פרויקט פעיל
// ===================================================

import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { FolderTree, ChevronDown, ChevronLeft, GitBranch } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { ProjectCard } from './ProjectCard';
import { ProjectCardSkeleton } from '../common/SkeletonLoader';
import { TIMEOUTS } from '../../../shared/constants';

// Lazy loading — טעינה עצלה של קומפוננטות כבדות
const FileTree = lazy(() =>
  import('./FileTree').then(m => ({ default: m.FileTree })),
);
const DiffViewer = lazy(() =>
  import('../common/DiffViewer').then(m => ({ default: m.DiffViewer })),
);

/** Skeleton fallback — מוצג בזמן טעינת קומפוננטה lazy */
function LazyFallback() {
  return (
    <div className="flex items-center justify-center py-6 opacity-40">
      <div className="flex gap-1">
        <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#888', animationDelay: '0ms' }} />
        <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#888', animationDelay: '150ms' }} />
        <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#888', animationDelay: '300ms' }} />
      </div>
    </div>
  );
}

export function ProjectDashboard() {
  const { state, sendMessage } = useApp();
  const { t, i18n } = useTranslation();
  const isRTL = i18n.dir() === 'rtl';

  // --- מצב טעינה: מוצג בטעינה ראשונית עד שהפרויקטים נטענים ---
  const [isLoading, setIsLoading] = useState(true);
  // --- מצב עץ קבצים ---
  const [fileTreeOpen, setFileTreeOpen] = useState(false);
  const [fileTreeLoading, setFileTreeLoading] = useState(false);
  // --- מצב diff viewer ---
  const [diffOpen, setDiffOpen] = useState(false);
  const [diffStaged, setDiffStaged] = useState(false);

  useEffect(() => {
    // ברגע שה-projectList מגיע מה-Extension, מפסיקים להציג שלדים
    // timeout כ-fallback למקרה שאין פרויקטים (מצב ריק לגיטימי)
    if (state.projects.length > 0) {
      setIsLoading(false);
    } else {
      const timer = setTimeout(() => setIsLoading(false), TIMEOUTS.LOADING_FALLBACK_MS);
      return () => clearTimeout(timer);
    }
  }, [state.projects]);

  // --- בקשת עץ קבצים כשנפתח ---
  useEffect(() => {
    if (fileTreeOpen && state.activeProject) {
      setFileTreeLoading(true);
      sendMessage({
        type: 'getFileTree',
        payload: { projectPath: state.activeProject.path },
      });
    }
  }, [fileTreeOpen, state.activeProject, sendMessage]);

  // --- כשעץ הקבצים מתעדכן — מפסיקים טעינה ---
  useEffect(() => {
    if (state.fileTree.length > 0 || !fileTreeLoading) {
      setFileTreeLoading(false);
    }
  }, [state.fileTree]);

  const handleRefreshFileTree = useCallback(() => {
    if (state.activeProject) {
      setFileTreeLoading(true);
      sendMessage({
        type: 'getFileTree',
        payload: { projectPath: state.activeProject.path },
      });
    }
  }, [state.activeProject, sendMessage]);

  const handleOpenFile = useCallback((filePath: string) => {
    sendMessage({ type: 'openFile', payload: { filePath } });
  }, [sendMessage]);

  // --- בקשת diff כשנפתח ---
  useEffect(() => {
    if (diffOpen && state.activeProject) {
      sendMessage({ type: 'getDiffContent', payload: { staged: diffStaged } });
    }
  }, [diffOpen, diffStaged, state.activeProject, sendMessage]);

  const handleRefreshDiff = useCallback(() => {
    sendMessage({ type: 'getDiffContent', payload: { staged: diffStaged } });
  }, [diffStaged, sendMessage]);

  return (
    <div className="p-4 view-enter">
      {/* כותרת */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-lg font-bold">{t('projects.title')}</h1>
          <p className="text-xs opacity-60 mt-1">
            {isLoading ? t('projects.loading') : t('projects.projectCount', { count: state.projects.length })}
          </p>
        </div>

        {/* כפתור הוספת פרויקט */}
        <button
          className="btn-primary flex items-center gap-2"
          onClick={() => sendMessage({ type: 'importProject' })}
          aria-label={t('projects.newProject')}
        >
          <span>+</span>
          <span>{t('projects.newProject')}</span>
        </button>
      </div>

      {/* רשימת פרויקטים — שלדי טעינה או תוכן אמיתי */}
      {isLoading ? (
        <div className="grid gap-4">
          <ProjectCardSkeleton />
          <ProjectCardSkeleton />
          <ProjectCardSkeleton />
        </div>
      ) : state.projects.length === 0 ? (
        <EmptyState onImport={() => sendMessage({ type: 'importProject' })} />
      ) : (
        <div className="grid gap-4 stagger-children">
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

      {/* --- עץ קבצים — מוצג רק כשיש פרויקט פעיל --- */}
      {state.activeProject && (
        <div className="mt-4">
          {/* כותרת סקציה מתקפלת */}
          <button
            className="w-full flex items-center gap-2 py-2 ps-3 pe-3 rounded-md text-[12px] font-semibold
              hover:bg-[var(--vscode-list-hoverBackground,rgba(255,255,255,0.05))]
              transition-colors duration-100"
            onClick={() => setFileTreeOpen(!fileTreeOpen)}
            aria-expanded={fileTreeOpen}
            aria-label={t('fileTree.sectionTitle', 'Project Files')}
          >
            <span className="flex-shrink-0 opacity-60">
              {fileTreeOpen ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4 rotate-180" />
              )}
            </span>
            <FolderTree className="w-4 h-4 opacity-70" style={{ color: '#dcb67a' }} />
            <span className="flex-1 text-start">
              {t('fileTree.sectionTitle', 'Project Files')}
            </span>
            <span className="text-[10px] opacity-40 font-normal truncate max-w-[120px]" dir="ltr">
              {state.activeProject.name}
            </span>
          </button>

          {/* תוכן עץ הקבצים */}
          {fileTreeOpen && (
            <div
              className="mt-1 rounded-md border overflow-hidden animate-expand-in"
              style={{
                borderColor: 'var(--glass-border)',
                background: 'var(--glass-bg)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                maxHeight: '400px',
              }}
            >
              <Suspense fallback={<LazyFallback />}>
                <FileTree
                  tree={state.fileTree}
                  activeFile={state.activeFile}
                  onOpenFile={handleOpenFile}
                  onRefresh={handleRefreshFileTree}
                  isLoading={fileTreeLoading}
                />
              </Suspense>
            </div>
          )}
        </div>
      )}

      {/* --- Git Diff Viewer — מוצג רק כשיש פרויקט פעיל --- */}
      {state.activeProject && (
        <div className="mt-4">
          {/* כותרת סקציה מתקפלת */}
          <button
            className="w-full flex items-center gap-2 py-2 ps-3 pe-3 rounded-md text-[12px] font-semibold
              hover:bg-[var(--vscode-list-hoverBackground,rgba(255,255,255,0.05))]
              transition-colors duration-100"
            onClick={() => setDiffOpen(!diffOpen)}
            aria-expanded={diffOpen}
            aria-label={t('diff.sectionTitle', 'Git Changes')}
          >
            <span className="flex-shrink-0 opacity-60">
              {diffOpen ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4 rotate-180" />
              )}
            </span>
            <GitBranch className="w-4 h-4 opacity-70" style={{ color: '#f14c4c' }} />
            <span className="flex-1 text-start">
              {t('diff.sectionTitle', 'Git Changes')}
            </span>

            {/* מתג staged/unstaged */}
            {diffOpen && (
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <button
                  className={`text-[10px] px-1.5 py-0.5 rounded transition-all duration-100 ${
                    !diffStaged ? 'diff-view-toggle-active' : 'opacity-40 hover:opacity-70'
                  }`}
                  onClick={() => setDiffStaged(false)}
                  aria-label={t('diff.unstaged', 'Working')}
                  aria-pressed={!diffStaged}
                >
                  {t('diff.unstaged', 'Working')}
                </button>
                <button
                  className={`text-[10px] px-1.5 py-0.5 rounded transition-all duration-100 ${
                    diffStaged ? 'diff-view-toggle-active' : 'opacity-40 hover:opacity-70'
                  }`}
                  onClick={() => setDiffStaged(true)}
                  aria-label={t('diff.staged', 'Staged')}
                  aria-pressed={diffStaged}
                >
                  {t('diff.staged', 'Staged')}
                </button>
                <button
                  className="text-[10px] opacity-40 hover:opacity-80 px-1 transition-opacity"
                  onClick={handleRefreshDiff}
                  title={t('diff.refresh', 'Refresh diff')}
                  aria-label={t('diff.refresh', 'Refresh diff')}
                >
                  {'\u21BB'}
                </button>
              </div>
            )}
          </button>

          {/* תוכן ה-diff */}
          {diffOpen && (
            <div
              className="mt-1 rounded-md border overflow-hidden animate-expand-in"
              style={{
                borderColor: 'var(--glass-border)',
                background: 'var(--glass-bg)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
              }}
            >
              <Suspense fallback={<LazyFallback />}>
                <DiffViewer
                  files={state.diffFiles}
                  staged={state.diffStaged}
                  maxHeight="500px"
                />
              </Suspense>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------
// EmptyState — כשאין פרויקטים
// -------------------------------------------------
function EmptyState({ onImport }: { onImport: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center py-16 opacity-60 animate-scale-in"
      style={{
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: '1px solid var(--glass-border)',
        borderRadius: 'var(--radius-lg)',
      }}
    >
      <div className="text-4xl mb-4">📁</div>
      <h2 className="text-base font-medium mb-2">{t('projects.emptyTitle')}</h2>
      <p className="text-xs mb-6 text-center max-w-xs">
        {t('projects.emptyDescription')}
      </p>
      <button className="btn-primary" onClick={onImport}>
        {t('projects.importFromFolder')}
      </button>
    </div>
  );
}
