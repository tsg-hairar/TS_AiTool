// ===================================================
// DiffViewer — תצוגת שינויים ויזואלית (Git Diff)
// ===================================================
// תומך בתצוגה מפוצלת (side-by-side) ותצוגה מאוחדת (unified)
// עם הדגשת syntax, מספרי שורות, וקיפול שורות ללא שינוי
// ===================================================

import React, { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { DiffFile, DiffHunk, DiffLine } from '../../../shared/types';
import { TIMEOUTS } from '../../../shared/constants';

// -------------------------------------------------
// Props
// -------------------------------------------------
interface DiffViewerProps {
  /** קבצי diff לתצוגה */
  files: DiffFile[];
  /** האם staged diff */
  staged?: boolean;
  /** מספר שורות ללא שינוי שנשארות גלויות סביב שינויים */
  contextLines?: number;
  /** גובה מקסימלי (CSS) */
  maxHeight?: string;
}

/** מצב תצוגה */
type ViewMode = 'unified' | 'split';

// -------------------------------------------------
// DiffViewer — קומפוננטה ראשית
// -------------------------------------------------
export function DiffViewer({
  files,
  staged = false,
  contextLines = 3,
  maxHeight = '500px',
}: DiffViewerProps) {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<ViewMode>('unified');
  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(new Set());

  const toggleFile = useCallback((filename: string) => {
    setCollapsedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(filename)) next.delete(filename);
      else next.add(filename);
      return next;
    });
  }, []);

  // סטטיסטיקות כלליות
  const totalStats = useMemo(() => {
    let additions = 0;
    let deletions = 0;
    for (const file of files) {
      additions += file.additions;
      deletions += file.deletions;
    }
    return { additions, deletions, fileCount: files.length };
  }, [files]);

  if (files.length === 0) {
    return (
      <div className="diff-viewer-empty rounded-lg px-4 py-8 text-center animate-fade-in"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--vscode-panel-border, rgba(255,255,255,0.08))' }}>
        <div className="text-2xl mb-2 opacity-40">
          {staged ? '\u2705' : '\uD83D\uDCC4'}
        </div>
        <p className="text-xs opacity-50">
          {staged ? t('diff.noStagedChanges', 'No staged changes') : t('diff.noChanges', 'No changes detected')}
        </p>
      </div>
    );
  }

  return (
    <div className="diff-viewer animate-fade-in" style={{ maxHeight, overflowY: 'auto' }}>
      {/* כותרת כללית */}
      <div
        className="diff-viewer-header flex items-center justify-between px-3 py-2 rounded-t-lg"
        style={{
          background: 'rgba(255,255,255,0.04)',
          borderBottom: '1px solid var(--vscode-panel-border, rgba(255,255,255,0.08))',
        }}
      >
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium opacity-70">
            {t('diff.filesChanged', '{{count}} files changed', { count: totalStats.fileCount })}
          </span>
          <span className="diff-stat-additions text-[11px] font-mono">
            +{totalStats.additions}
          </span>
          <span className="diff-stat-deletions text-[11px] font-mono">
            -{totalStats.deletions}
          </span>
          {staged && (
            <span className="text-[10px] px-1.5 py-0.5 rounded diff-staged-badge">
              {t('diff.staged', 'Staged')}
            </span>
          )}
        </div>

        {/* מתג תצוגה */}
        <div className="flex items-center gap-1 rounded-md p-0.5"
          style={{ background: 'rgba(255,255,255,0.06)' }}>
          <button
            className={`diff-view-toggle text-[10px] px-2 py-1 rounded transition-all duration-150 ${
              viewMode === 'unified' ? 'diff-view-toggle-active' : 'opacity-50 hover:opacity-80'
            }`}
            onClick={() => setViewMode('unified')}
            title={t('diff.unifiedView', 'Unified view')}
          >
            {t('diff.unified', 'Unified')}
          </button>
          <button
            className={`diff-view-toggle text-[10px] px-2 py-1 rounded transition-all duration-150 ${
              viewMode === 'split' ? 'diff-view-toggle-active' : 'opacity-50 hover:opacity-80'
            }`}
            onClick={() => setViewMode('split')}
            title={t('diff.splitView', 'Split view')}
          >
            {t('diff.split', 'Split')}
          </button>
        </div>
      </div>

      {/* רשימת קבצים */}
      <div className="diff-files-list">
        {files.map((file) => (
          <DiffFileCard
            key={file.filename}
            file={file}
            viewMode={viewMode}
            contextLines={contextLines}
            isCollapsed={collapsedFiles.has(file.filename)}
            onToggle={() => toggleFile(file.filename)}
          />
        ))}
      </div>
    </div>
  );
}

// -------------------------------------------------
// DiffFileCard — כרטיס קובץ בודד
// -------------------------------------------------
interface DiffFileCardProps {
  file: DiffFile;
  viewMode: ViewMode;
  contextLines: number;
  isCollapsed: boolean;
  onToggle: () => void;
}

function DiffFileCard({ file, viewMode, contextLines, isCollapsed, onToggle }: DiffFileCardProps) {
  const { t } = useTranslation();
  const [copiedSide, setCopiedSide] = useState<'old' | 'new' | null>(null);

  const statusIcon = {
    added: '\u2795',
    modified: '\u270F\uFE0F',
    deleted: '\u274C',
    renamed: '\u27A1\uFE0F',
  }[file.status];

  const statusColor = {
    added: '#4ec9b0',
    modified: '#dcdcaa',
    deleted: '#f14c4c',
    renamed: '#569cd6',
  }[file.status];

  // העתקה לצד אחד
  const handleCopy = useCallback(async (side: 'old' | 'new') => {
    const content = file.hunks
      .flatMap((h) => h.lines)
      .filter((l) => {
        if (side === 'old') return l.type === 'unchanged' || l.type === 'removed';
        return l.type === 'unchanged' || l.type === 'added';
      })
      .map((l) => l.content)
      .join('\n');

    await navigator.clipboard.writeText(content);
    setCopiedSide(side);
    setTimeout(() => setCopiedSide(null), TIMEOUTS.UI_FEEDBACK_MS);
  }, [file.hunks]);

  return (
    <div
      className="diff-file-card"
      style={{
        border: '1px solid var(--vscode-panel-border, rgba(255,255,255,0.08))',
        borderTop: 'none',
      }}
    >
      {/* כותרת קובץ */}
      <button
        className="diff-file-header w-full flex items-center gap-2 px-3 py-2 text-left transition-colors duration-100"
        onClick={onToggle}
        style={{ background: 'rgba(255,255,255,0.03)' }}
        aria-expanded={!isCollapsed}
      >
        <span className="text-[10px] transition-transform duration-150"
          style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', display: 'inline-block' }}>
          {'\u25BC'}
        </span>
        <span className="text-xs" style={{ color: statusColor }}>
          {statusIcon}
        </span>
        <span className="text-xs font-mono flex-1 truncate" dir="ltr" style={{ textAlign: 'left' }}>
          {file.oldFilename && file.oldFilename !== file.filename
            ? `${file.oldFilename} \u2192 ${file.filename}`
            : file.filename}
        </span>
        <span className="diff-stat-additions text-[10px] font-mono">+{file.additions}</span>
        <span className="diff-stat-deletions text-[10px] font-mono">-{file.deletions}</span>

        {/* כפתורי העתקה */}
        <span
          className="diff-copy-btn text-[10px] opacity-0 group-hover:opacity-60 hover:opacity-100 transition-opacity"
          onClick={(e) => { e.stopPropagation(); handleCopy('new'); }}
          title={t('diff.copyNew', 'Copy new version')}
        >
          {copiedSide === 'new' ? '\u2705' : '\uD83D\uDCCB'}
        </span>
      </button>

      {/* תוכן ה-diff */}
      {!isCollapsed && (
        <div className="diff-file-content" dir="ltr" style={{ textAlign: 'left' }}>
          {viewMode === 'unified' ? (
            <UnifiedDiffView file={file} contextLines={contextLines} />
          ) : (
            <SplitDiffView file={file} contextLines={contextLines} />
          )}
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------
// CollapsedSection — מראה "... X lines hidden ..."
// -------------------------------------------------
interface CollapsedSectionProps {
  lineCount: number;
  onExpand: () => void;
}

function CollapsedSection({ lineCount, onExpand }: CollapsedSectionProps) {
  const { t } = useTranslation();
  return (
    <tr className="diff-collapsed-row" onClick={onExpand} style={{ cursor: 'pointer' }}>
      <td
        colSpan={4}
        className="text-center text-[10px] py-1 diff-collapsed-cell"
      >
        <span className="diff-collapsed-text">
          {'\u2022\u2022\u2022'} {t('diff.linesHidden', '{{count}} lines hidden', { count: lineCount })} {'\u2022\u2022\u2022'}
        </span>
      </td>
    </tr>
  );
}

// -------------------------------------------------
// useCollapsibleLines — קיפול שורות ללא שינוי
// -------------------------------------------------
function useCollapsibleLines(lines: DiffLine[], contextLines: number) {
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());

  const sections = useMemo(() => {
    const result: Array<
      | { type: 'lines'; lines: DiffLine[]; startIndex: number }
      | { type: 'collapsed'; lineCount: number; sectionIndex: number; lines: DiffLine[] }
    > = [];

    let unchangedStart = -1;
    let unchangedLines: DiffLine[] = [];

    const flushUnchanged = () => {
      if (unchangedLines.length <= contextLines * 2 + 1) {
        // Not enough to collapse
        result.push({ type: 'lines', lines: [...unchangedLines], startIndex: unchangedStart });
      } else {
        // Show first contextLines, collapse middle, show last contextLines
        const top = unchangedLines.slice(0, contextLines);
        const bottom = unchangedLines.slice(-contextLines);
        const middle = unchangedLines.slice(contextLines, -contextLines);
        const sectionIdx = unchangedStart + contextLines;

        if (top.length > 0) result.push({ type: 'lines', lines: top, startIndex: unchangedStart });
        result.push({ type: 'collapsed', lineCount: middle.length, sectionIndex: sectionIdx, lines: middle });
        if (bottom.length > 0) result.push({ type: 'lines', lines: bottom, startIndex: unchangedStart + unchangedLines.length - contextLines });
      }
      unchangedLines = [];
      unchangedStart = -1;
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.type === 'unchanged') {
        if (unchangedStart === -1) unchangedStart = i;
        unchangedLines.push(line);
      } else {
        if (unchangedLines.length > 0) flushUnchanged();
        // Find or extend current changed section
        const last = result[result.length - 1];
        if (last && last.type === 'lines') {
          last.lines.push(line);
        } else {
          result.push({ type: 'lines', lines: [line], startIndex: i });
        }
      }
    }
    if (unchangedLines.length > 0) flushUnchanged();

    return result;
  }, [lines, contextLines]);

  const expandSection = useCallback((sectionIndex: number) => {
    setExpandedSections((prev) => new Set([...prev, sectionIndex]));
  }, []);

  return { sections, expandedSections, expandSection };
}

// -------------------------------------------------
// UnifiedDiffView — תצוגה מאוחדת
// -------------------------------------------------
function UnifiedDiffView({ file, contextLines }: { file: DiffFile; contextLines: number }) {
  const allLines = useMemo(() => file.hunks.flatMap((h) => h.lines), [file.hunks]);
  const { sections, expandedSections, expandSection } = useCollapsibleLines(allLines, contextLines);

  return (
    <div className="diff-table-wrapper" style={{ overflowX: 'auto' }}>
      <table className="diff-table diff-table-unified w-full" style={{ borderCollapse: 'collapse', fontSize: '12px', fontFamily: 'var(--vscode-editor-font-family, Consolas, monospace)' }}>
        <tbody>
          {sections.map((section, sIdx) => {
            if (section.type === 'collapsed' && !expandedSections.has(section.sectionIndex)) {
              return (
                <CollapsedSection
                  key={`collapsed-${sIdx}`}
                  lineCount={section.lineCount}
                  onExpand={() => expandSection(section.sectionIndex)}
                />
              );
            }

            const linesToRender = section.type === 'collapsed' ? section.lines : section.lines;

            return linesToRender.map((line, lIdx) => (
              <tr
                key={`${sIdx}-${lIdx}`}
                className={`diff-line diff-line-${line.type}`}
              >
                <td className="diff-line-number diff-line-number-old">
                  {line.oldLineNumber ?? ''}
                </td>
                <td className="diff-line-number diff-line-number-new">
                  {line.newLineNumber ?? ''}
                </td>
                <td className="diff-line-marker">
                  {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                </td>
                <td className="diff-line-content">
                  <pre className="diff-line-pre">{line.content || ' '}</pre>
                </td>
              </tr>
            ));
          })}
        </tbody>
      </table>
    </div>
  );
}

// -------------------------------------------------
// SplitDiffView — תצוגה מפוצלת (side-by-side)
// -------------------------------------------------
function SplitDiffView({ file, contextLines }: { file: DiffFile; contextLines: number }) {
  const pairedLines = useMemo(() => {
    const pairs: Array<{
      left: DiffLine | null;
      right: DiffLine | null;
      type: 'unchanged' | 'changed';
    }> = [];

    for (const hunk of file.hunks) {
      let i = 0;
      while (i < hunk.lines.length) {
        const line = hunk.lines[i];

        if (line.type === 'unchanged') {
          pairs.push({ left: line, right: line, type: 'unchanged' });
          i++;
        } else {
          // Gather consecutive removed and added lines
          const removed: DiffLine[] = [];
          const added: DiffLine[] = [];

          while (i < hunk.lines.length && hunk.lines[i].type === 'removed') {
            removed.push(hunk.lines[i]);
            i++;
          }
          while (i < hunk.lines.length && hunk.lines[i].type === 'added') {
            added.push(hunk.lines[i]);
            i++;
          }

          const maxLen = Math.max(removed.length, added.length);
          for (let j = 0; j < maxLen; j++) {
            pairs.push({
              left: j < removed.length ? removed[j] : null,
              right: j < added.length ? added[j] : null,
              type: 'changed',
            });
          }
        }
      }
    }

    return pairs;
  }, [file.hunks]);

  // Build pseudo DiffLine[] for collapsing
  const pseudoLines: DiffLine[] = pairedLines.map((p) => ({
    type: p.type === 'unchanged' ? 'unchanged' : (p.left ? 'removed' : 'added'),
    content: '',
    oldLineNumber: p.left?.oldLineNumber,
    newLineNumber: p.right?.newLineNumber,
  }));

  const { sections, expandedSections, expandSection } = useCollapsibleLines(pseudoLines, contextLines);

  // Map section indices back to pairedLines
  let pairIndex = 0;

  return (
    <div className="diff-table-wrapper" style={{ overflowX: 'auto' }}>
      <table className="diff-table diff-table-split w-full" style={{ borderCollapse: 'collapse', fontSize: '12px', fontFamily: 'var(--vscode-editor-font-family, Consolas, monospace)' }}>
        <tbody>
          {(() => {
            let globalIdx = 0;
            return sections.map((section, sIdx) => {
              if (section.type === 'collapsed' && !expandedSections.has(section.sectionIndex)) {
                const count = section.lineCount;
                globalIdx += count;
                return (
                  <CollapsedSection
                    key={`collapsed-${sIdx}`}
                    lineCount={count}
                    onExpand={() => expandSection(section.sectionIndex)}
                  />
                );
              }

              const lineCount = section.type === 'collapsed' ? section.lines.length : section.lines.length;
              const startIdx = globalIdx;
              globalIdx += lineCount;

              return Array.from({ length: lineCount }, (_, lIdx) => {
                const pIdx = startIdx + lIdx;
                if (pIdx >= pairedLines.length) return null;
                const pair = pairedLines[pIdx];

                return (
                  <tr key={`${sIdx}-${lIdx}`} className="diff-split-row">
                    {/* צד שמאל (ישן) */}
                    <td className="diff-line-number diff-line-number-old">
                      {pair.left?.oldLineNumber ?? ''}
                    </td>
                    <td className={`diff-line-content diff-split-left ${
                      pair.left?.type === 'removed' ? 'diff-line-removed' : pair.type === 'unchanged' ? '' : 'diff-line-empty'
                    }`}>
                      <pre className="diff-line-pre">{pair.left?.content ?? ''}</pre>
                    </td>

                    {/* מפריד */}
                    <td className="diff-split-divider" />

                    {/* צד ימין (חדש) */}
                    <td className="diff-line-number diff-line-number-new">
                      {pair.right?.newLineNumber ?? ''}
                    </td>
                    <td className={`diff-line-content diff-split-right ${
                      pair.right?.type === 'added' ? 'diff-line-added' : pair.type === 'unchanged' ? '' : 'diff-line-empty'
                    }`}>
                      <pre className="diff-line-pre">{pair.right?.content ?? ''}</pre>
                    </td>
                  </tr>
                );
              });
            });
          })()}
        </tbody>
      </table>
    </div>
  );
}
