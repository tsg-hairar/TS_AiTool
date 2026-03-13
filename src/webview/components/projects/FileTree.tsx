// ===================================================
// FileTree — עץ קבצים אינטראקטיבי
// ===================================================
// מציג מבנה עץ קבצים של פרויקט בסגנון VS Code
// עם חיפוש, אייקונים לפי סוג קובץ, ו-RTL
// ===================================================

import React, { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Folder,
  FolderOpen,
  File,
  FileCode,
  FileText,
  FileJson,
  Image,
  FileType,
  Search,
  ChevronLeft,
  ChevronDown,
  RefreshCw,
  Package,
  FileSpreadsheet,
  Braces,
  Hash,
  Palette,
  Settings,
  Database,
  Globe,
  Terminal,
  Lock,
} from 'lucide-react';
import type { FileTreeNode } from '../../../shared/messages';

// -------------------------------------------------
// אייקון לפי סיומת קובץ
// -------------------------------------------------
function getFileIcon(extension?: string, name?: string): React.ReactNode {
  const iconClass = 'w-4 h-4 flex-shrink-0';

  // בדיקת שמות קבצים מיוחדים
  if (name) {
    const lowerName = name.toLowerCase();
    if (lowerName === 'package.json' || lowerName === 'package-lock.json') {
      return <Package className={iconClass} style={{ color: '#e8274b' }} />;
    }
    if (lowerName === 'tsconfig.json' || lowerName === 'jsconfig.json') {
      return <Settings className={iconClass} style={{ color: '#3178c6' }} />;
    }
    if (lowerName === '.gitignore' || lowerName === '.gitattributes') {
      return <FileText className={iconClass} style={{ color: '#f05033' }} />;
    }
    if (lowerName === 'dockerfile' || lowerName === 'docker-compose.yml') {
      return <Database className={iconClass} style={{ color: '#2496ed' }} />;
    }
    if (lowerName === '.env' || lowerName.startsWith('.env.')) {
      return <Lock className={iconClass} style={{ color: '#ecd53f' }} />;
    }
  }

  switch (extension) {
    // TypeScript
    case 'ts':
    case 'tsx':
      return <FileCode className={iconClass} style={{ color: '#3178c6' }} />;
    // JavaScript
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
      return <FileCode className={iconClass} style={{ color: '#f7df1e' }} />;
    // JSON
    case 'json':
    case 'jsonc':
      return <FileJson className={iconClass} style={{ color: '#292929' }} />;
    // CSS / Styles
    case 'css':
      return <Palette className={iconClass} style={{ color: '#1572b6' }} />;
    case 'scss':
    case 'sass':
    case 'less':
      return <Palette className={iconClass} style={{ color: '#cd6799' }} />;
    // HTML
    case 'html':
    case 'htm':
      return <Globe className={iconClass} style={{ color: '#e44d26' }} />;
    // Markdown
    case 'md':
    case 'mdx':
      return <FileText className={iconClass} style={{ color: '#083fa1' }} />;
    // Images
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
    case 'ico':
    case 'webp':
      return <Image className={iconClass} style={{ color: '#a074c4' }} />;
    // Config
    case 'yaml':
    case 'yml':
    case 'toml':
    case 'ini':
    case 'cfg':
      return <Settings className={iconClass} style={{ color: '#6d8086' }} />;
    // Python
    case 'py':
    case 'pyx':
      return <FileCode className={iconClass} style={{ color: '#3776ab' }} />;
    // Rust
    case 'rs':
      return <FileCode className={iconClass} style={{ color: '#dea584' }} />;
    // Go
    case 'go':
      return <FileCode className={iconClass} style={{ color: '#00add8' }} />;
    // Java / Kotlin
    case 'java':
      return <FileCode className={iconClass} style={{ color: '#b07219' }} />;
    case 'kt':
    case 'kts':
      return <FileCode className={iconClass} style={{ color: '#7f52ff' }} />;
    // C / C++
    case 'c':
    case 'h':
      return <Hash className={iconClass} style={{ color: '#555555' }} />;
    case 'cpp':
    case 'cxx':
    case 'hpp':
      return <Hash className={iconClass} style={{ color: '#f34b7d' }} />;
    // Shell
    case 'sh':
    case 'bash':
    case 'zsh':
    case 'bat':
    case 'cmd':
    case 'ps1':
      return <Terminal className={iconClass} style={{ color: '#89e051' }} />;
    // CSV / Excel
    case 'csv':
    case 'xls':
    case 'xlsx':
      return <FileSpreadsheet className={iconClass} style={{ color: '#217346' }} />;
    // Data
    case 'sql':
    case 'db':
    case 'sqlite':
      return <Database className={iconClass} style={{ color: '#e38c00' }} />;
    // XML
    case 'xml':
    case 'xsl':
      return <Braces className={iconClass} style={{ color: '#e37933' }} />;
    // Font
    case 'woff':
    case 'woff2':
    case 'ttf':
    case 'otf':
    case 'eot':
      return <FileType className={iconClass} style={{ color: '#a8b1ff' }} />;
    // Lock files
    case 'lock':
      return <Lock className={iconClass} style={{ color: '#6d8086' }} />;
    default:
      return <File className={iconClass} style={{ color: '#6d8086' }} />;
  }
}

// -------------------------------------------------
// עיצוב גודל קובץ
// -------------------------------------------------
function formatFileSize(bytes?: number): string {
  if (bytes === undefined || bytes === null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// -------------------------------------------------
// סינון עץ — מחזיר עותק מסונן לפי שאילתת חיפוש
// -------------------------------------------------
function filterTree(nodes: FileTreeNode[], query: string): FileTreeNode[] {
  if (!query.trim()) return nodes;
  const lowerQuery = query.toLowerCase();

  return nodes.reduce<FileTreeNode[]>((acc, node) => {
    const nameMatch = node.name.toLowerCase().includes(lowerQuery);

    if (node.type === 'folder' && node.children) {
      const filteredChildren = filterTree(node.children, query);
      if (filteredChildren.length > 0 || nameMatch) {
        acc.push({
          ...node,
          children: filteredChildren,
        });
      }
    } else if (nameMatch) {
      acc.push(node);
    }

    return acc;
  }, []);
}

// -------------------------------------------------
// FileTreeItem — פריט בודד בעץ (רקורסיבי)
// -------------------------------------------------
interface FileTreeItemProps {
  node: FileTreeNode;
  depth: number;
  activeFile: string | null;
  expandedFolders: Set<string>;
  onToggleFolder: (path: string) => void;
  onClickFile: (path: string) => void;
  isRTL: boolean;
  searchQuery: string;
}

function FileTreeItem({
  node,
  depth,
  activeFile,
  expandedFolders,
  onToggleFolder,
  onClickFile,
  isRTL,
  searchQuery,
}: FileTreeItemProps) {
  const isFolder = node.type === 'folder';
  const isExpanded = expandedFolders.has(node.path);
  const isActive = activeFile === node.path;

  // הדגשת מילת חיפוש בשם הקובץ
  const highlightedName = useMemo(() => {
    if (!searchQuery.trim()) return node.name;
    const lowerName = node.name.toLowerCase();
    const lowerQuery = searchQuery.toLowerCase();
    const index = lowerName.indexOf(lowerQuery);
    if (index === -1) return node.name;

    const before = node.name.slice(0, index);
    const match = node.name.slice(index, index + searchQuery.length);
    const after = node.name.slice(index + searchQuery.length);

    return (
      <>
        {before}
        <span className="bg-yellow-500/30 text-yellow-200 rounded-sm px-0.5">{match}</span>
        {after}
      </>
    );
  }, [node.name, searchQuery]);

  const handleClick = useCallback(() => {
    if (isFolder) {
      onToggleFolder(node.path);
    } else {
      onClickFile(node.path);
    }
  }, [isFolder, node.path, onToggleFolder, onClickFile]);

  // חישוב הזחה — משתנה בהתאם לכיוון RTL/LTR
  const indentPx = depth * 16;

  return (
    <>
      <div
        role="treeitem"
        aria-expanded={isFolder ? isExpanded : undefined}
        aria-selected={isActive}
        className={`
          flex items-center gap-1.5 py-[3px] cursor-pointer select-none
          text-[12px] leading-[22px]
          transition-colors duration-75
          hover:bg-[var(--vscode-list-hoverBackground,rgba(255,255,255,0.05))]
          ${isActive ? 'bg-[var(--vscode-list-activeSelectionBackground,rgba(255,255,255,0.1))] text-[var(--vscode-list-activeSelectionForeground)]' : ''}
        `}
        style={{
          [isRTL ? 'paddingRight' : 'paddingLeft']: `${indentPx + 8}px`,
          [isRTL ? 'paddingLeft' : 'paddingRight']: '8px',
        }}
        onClick={handleClick}
      >
        {/* קווי חיבור — נקודות לרמות עומק */}
        {depth > 0 && (
          <div
            className="absolute opacity-20"
            style={{
              [isRTL ? 'right' : 'left']: `${indentPx - 4}px`,
              top: 0,
              bottom: 0,
              width: '1px',
              background: 'var(--vscode-tree-indentGuidesStroke, rgba(255,255,255,0.15))',
            }}
          />
        )}

        {/* חץ פתיחה/סגירה לתיקיות */}
        {isFolder ? (
          <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center opacity-70">
            {isRTL ? (
              isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />
            ) : (
              isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5 rotate-180" />
            )}
          </span>
        ) : (
          <span className="w-4 flex-shrink-0" />
        )}

        {/* אייקון */}
        {isFolder ? (
          isExpanded ? (
            <FolderOpen className="w-4 h-4 flex-shrink-0" style={{ color: '#dcb67a' }} />
          ) : (
            <Folder className="w-4 h-4 flex-shrink-0" style={{ color: '#dcb67a' }} />
          )
        ) : (
          getFileIcon(node.extension, node.name)
        )}

        {/* שם הקובץ/תיקייה */}
        <span className="truncate flex-1 min-w-0" dir="ltr">
          {highlightedName}
        </span>

        {/* גודל קובץ */}
        {!isFolder && node.size !== undefined && (
          <span className="text-[10px] opacity-40 flex-shrink-0 tabular-nums" dir="ltr">
            {formatFileSize(node.size)}
          </span>
        )}
      </div>

      {/* ילדים — עם אנימציה */}
      {isFolder && isExpanded && node.children && (
        <div
          role="group"
          className="animate-expand-in relative"
        >
          {node.children.map((child) => (
            <FileTreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              activeFile={activeFile}
              expandedFolders={expandedFolders}
              onToggleFolder={onToggleFolder}
              onClickFile={onClickFile}
              isRTL={isRTL}
              searchQuery={searchQuery}
            />
          ))}
        </div>
      )}
    </>
  );
}

// -------------------------------------------------
// FileTree — קומפוננטה ראשית
// -------------------------------------------------
interface FileTreeProps {
  tree: FileTreeNode[];
  activeFile: string | null;
  onOpenFile: (filePath: string) => void;
  onRefresh: () => void;
  isLoading?: boolean;
}

export function FileTree({ tree, activeFile, onOpenFile, onRefresh, isLoading }: FileTreeProps) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.dir() === 'rtl';

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => {
    // פתיחה אוטומטית של תיקיית שורש
    const initial = new Set<string>();
    tree.forEach((node) => {
      if (node.type === 'folder') initial.add(node.path);
    });
    return initial;
  });

  // סינון לפי חיפוש
  const filteredTree = useMemo(() => filterTree(tree, searchQuery), [tree, searchQuery]);

  // כאשר יש חיפוש — פתיחת כל התיקיות
  const effectiveExpanded = useMemo(() => {
    if (!searchQuery.trim()) return expandedFolders;
    // כשמחפשים — פותחים את כל התיקיות
    const allFolders = new Set<string>();
    function collectFolders(nodes: FileTreeNode[]) {
      for (const node of nodes) {
        if (node.type === 'folder') {
          allFolders.add(node.path);
          if (node.children) collectFolders(node.children);
        }
      }
    }
    collectFolders(filteredTree);
    return allFolders;
  }, [searchQuery, filteredTree, expandedFolders]);

  const handleToggleFolder = useCallback((folderPath: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  }, []);

  const handleClickFile = useCallback((filePath: string) => {
    onOpenFile(filePath);
  }, [onOpenFile]);

  // ספירת קבצים ותיקיות
  const counts = useMemo(() => {
    let files = 0;
    let folders = 0;
    function count(nodes: FileTreeNode[]) {
      for (const node of nodes) {
        if (node.type === 'folder') {
          folders++;
          if (node.children) count(node.children);
        } else {
          files++;
        }
      }
    }
    count(tree);
    return { files, folders };
  }, [tree]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* כותרת + חיפוש */}
      <div className="flex-shrink-0 p-2 border-b border-[var(--vscode-panel-border,rgba(255,255,255,0.1))]">
        {/* שורת כותרת */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider opacity-70">
            {t('fileTree.title', 'Explorer')}
          </span>
          <div className="flex items-center gap-1">
            <span className="text-[10px] opacity-40 tabular-nums">
              {counts.folders}F / {counts.files}f
            </span>
            <button
              className="p-0.5 rounded opacity-50 hover:opacity-100 hover:bg-white/10 transition-opacity"
              onClick={onRefresh}
              title={t('fileTree.refresh', 'Refresh')}
              disabled={isLoading}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* שדה חיפוש */}
        <div className="relative">
          <Search className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-40"
            style={{ [isRTL ? 'right' : 'left']: '6px' }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('fileTree.searchPlaceholder', 'Filter files...')}
            className="w-full text-[11px] py-1 rounded border
              bg-[var(--vscode-input-background)]
              border-[var(--vscode-input-border,transparent)]
              text-[var(--vscode-input-foreground)]
              placeholder:opacity-40
              focus:outline-none focus:border-[var(--vscode-focusBorder)]"
            style={{
              [isRTL ? 'paddingRight' : 'paddingLeft']: '24px',
              [isRTL ? 'paddingLeft' : 'paddingRight']: '8px',
            }}
            dir="ltr"
          />
        </div>
      </div>

      {/* עץ הקבצים */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden" role="tree">
        {isLoading ? (
          <div className="flex flex-col gap-1.5 p-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2" style={{ paddingInlineStart: `${(i % 3) * 16 + 8}px` }}>
                <div className="w-4 h-4 rounded bg-white/5 animate-pulse" />
                <div
                  className="h-3 rounded bg-white/5 animate-pulse"
                  style={{ width: `${60 + Math.random() * 80}px` }}
                />
              </div>
            ))}
          </div>
        ) : filteredTree.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 opacity-40 text-center">
            <File className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-[11px]">
              {searchQuery
                ? t('fileTree.noResults', 'No files found')
                : t('fileTree.empty', 'No files to display')
              }
            </p>
          </div>
        ) : (
          <div className="py-1">
            {filteredTree.map((node) => (
              <FileTreeItem
                key={node.path}
                node={node}
                depth={0}
                activeFile={activeFile}
                expandedFolders={effectiveExpanded}
                onToggleFolder={handleToggleFolder}
                onClickFile={handleClickFile}
                isRTL={isRTL}
                searchQuery={searchQuery}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
