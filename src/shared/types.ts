// ===================================================
// Shared Types — טיפוסים משותפים לכל האפליקציה
// ===================================================
// קובץ זה מכיל את כל ה-interfaces וה-enums
// משמש גם את ה-Extension (Node.js) וגם את ה-Webview (React)
// ===================================================

// -------------------------------------------------
// פרויקטים
// -------------------------------------------------

/** מידע על פרויקט — היחידה המרכזית באפליקציה */
export interface Project {
  /** מזהה ייחודי (UUID) */
  id: string;
  /** שם הפרויקט */
  name: string;
  /** נתיב מלא לתיקיית הפרויקט */
  path: string;
  /** תיאור קצר */
  description?: string;
  /** טכנולוגיות שזוהו אוטומטית */
  techStack: string[];
  /** ציון בריאות 0-100 */
  healthScore: number;
  /** תאריך יצירה */
  createdAt: string;
  /** תאריך עדכון אחרון */
  lastOpenedAt: string;
  /** מספר שיחות בפרויקט */
  chatCount: number;
  /** אייקון (אימוג'י) */
  icon: string;
  /** צבע כרטיס */
  color: string;
  /** תוכן CLAUDE.md אם קיים */
  claudeMd?: string;
  /** הגדרות ספציפיות לפרויקט */
  settings: ProjectSettings;
}

/** הגדרות ספציפיות לפרויקט */
export interface ProjectSettings {
  /** מודל ברירת מחדל */
  defaultModel?: ModelId;
  /** system prompt מותאם */
  customSystemPrompt?: string;
  /** סוכן ברירת מחדל */
  defaultAgent?: AgentId;
  /** קבצים להתעלם מהם */
  ignoredFiles?: string[];
}

// -------------------------------------------------
// סוכנים (Agents)
// -------------------------------------------------

/** מזהי סוכנים מובנים */
export type AgentId =
  | 'manager'
  | 'architect'
  | 'developer'
  | 'qa'
  | 'designer'
  | 'security'
  | 'writer';

/** הגדרת סוכן */
export interface Agent {
  /** מזהה ייחודי */
  id: AgentId;
  /** שם תצוגה (בשפת הממשק) */
  name: string;
  /** תיאור התפקיד */
  description: string;
  /** אייקון */
  icon: string;
  /** צבע ייחודי */
  color: string;
  /** system prompt ייחודי */
  systemPrompt: string;
  /** כלים מותרים לסוכן */
  allowedTools: ToolName[];
  /** מקסימום turns */
  maxTurns: number;
}

/** כלים זמינים */
export type ToolName =
  | 'read_file'
  | 'write_file'
  | 'edit_file'
  | 'search_files'
  | 'search_content'
  | 'run_command'
  | 'list_files'
  | 'web_search'
  | 'web_fetch';

// -------------------------------------------------
// Workflows — שרשרות סוכנים
// -------------------------------------------------

/** הגדרת workflow */
export interface Workflow {
  /** מזהה ייחודי */
  id: string;
  /** שם תצוגה */
  name: string;
  /** תיאור */
  description: string;
  /** אייקון */
  icon: string;
  /** שלבים */
  steps: WorkflowStep[];
}

/** שלב בודד ב-workflow */
export interface WorkflowStep {
  /** מזהה הסוכן שמבצע */
  agentId: AgentId;
  /** הנחיה לסוכן (תומך ב-{{variables}}) */
  input: string;
  /** שם המשתנה לשמור את הפלט */
  outputVar: string;
  /** שלבים שצריכים להסתיים לפני */
  dependsOn?: string[];
}

/** סטטוס הרצת workflow */
export interface WorkflowRun {
  /** מזהה ה-workflow */
  workflowId: string;
  /** סטטוס כללי */
  status: 'idle' | 'running' | 'completed' | 'failed';
  /** שלב נוכחי (אינדקס) */
  currentStep: number;
  /** תוצאות כל שלב */
  stepResults: Record<string, string>;
  /** שגיאה אם נכשל */
  error?: string;
}

// -------------------------------------------------
// הודעות צ'אט
// -------------------------------------------------

/** תפקיד שולח ההודעה */
export type MessageRole = 'user' | 'assistant' | 'system';

/** הודעה בודדת בשיחה */
export interface ChatMessage {
  /** מזהה ייחודי */
  id: string;
  /** תפקיד */
  role: MessageRole;
  /** תוכן טקסט */
  content: string;
  /** חותמת זמן */
  timestamp: string;
  /** מזהה הסוכן ששלח (אם assistant) */
  agentId?: AgentId;
  /** כלים שהופעלו */
  toolUses?: ToolUse[];
  /** האם ההודעה מסומנת (bookmark) */
  isBookmarked?: boolean;
  /** האם ההודעה מוצמדת (pinned) */
  isPinned?: boolean;
  /** תמונות מצורפות */
  images?: ImageAttachment[];
  /** קבצים מצורפים */
  files?: FileAttachment[];
  /** טוקנים שנצרכו */
  tokenCount?: number;
  /** מצב streaming */
  isStreaming?: boolean;
}

/** שימוש בכלי */
export interface ToolUse {
  /** מזהה */
  id: string;
  /** שם הכלי */
  name: ToolName;
  /** פרמטרים */
  input: Record<string, unknown>;
  /** תוצאה */
  output?: string;
  /** סטטוס */
  status: 'pending' | 'running' | 'completed' | 'failed' | 'approved' | 'denied';
}

/** הודעה מוצמדת — מידע נוסף על הצמדה */
export interface PinnedMessage {
  /** מזהה ההודעה המקורית */
  messageId: string;
  /** הערה אופציונלית של המשתמש */
  note?: string;
  /** חותמת זמן הצמדה */
  pinnedAt: string;
  /** תוכן מקוצר להצגה מהירה */
  preview: string;
}

/** תמונה מצורפת */
export interface ImageAttachment {
  /** מזהה */
  id: string;
  /** שם קובץ */
  name: string;
  /** סוג MIME */
  mimeType: string;
  /** נתונים base64 */
  data: string;
}

/** קובץ מצורף לצ'אט */
export interface FileAttachment {
  /** מזהה ייחודי */
  id: string;
  /** שם הקובץ */
  name: string;
  /** נתיב מלא (אם זמין) */
  path?: string;
  /** סוג MIME */
  mimeType: string;
  /** גודל בבתים */
  size: number;
  /** סיומת קובץ (ללא נקודה) */
  extension: string;
  /** תוכן הקובץ (טקסט/base64) */
  content?: string;
  /** האם התוכן הוא base64 (תמונות/בינאריים) */
  isBase64?: boolean;
  /** שורות תצוגה מקדימה (ל-code files) */
  previewLines?: string[];
  /** סטטוס קריאה */
  status: 'pending' | 'reading' | 'ready' | 'error';
  /** הודעת שגיאה */
  errorMessage?: string;
}

/** קטגוריות קבצים מותרות לגרירה */
export type FileCategory = 'code' | 'text' | 'image' | 'data' | 'config' | 'unknown';

// -------------------------------------------------
// שיחה (Conversation)
// -------------------------------------------------

/** שיחה שלמה */
export interface Conversation {
  /** מזהה ייחודי */
  id: string;
  /** מזהה פרויקט */
  projectId: string;
  /** מזהה סוכן */
  agentId: AgentId;
  /** כותרת השיחה */
  title: string;
  /** הודעות */
  messages: ChatMessage[];
  /** תאריך יצירה */
  createdAt: string;
  /** תאריך עדכון */
  updatedAt: string;
  /** סה"כ טוקנים */
  totalTokens: number;
  /** עלות משוערת */
  estimatedCost: number;
}

// -------------------------------------------------
// Skills — מיומנויות
// -------------------------------------------------

/** קטגוריות Skills */
export type SkillCategory =
  | 'coding'
  | 'testing'
  | 'devops'
  | 'design'
  | 'security'
  | 'docs';

/** הגדרת Skill */
export interface Skill {
  /** מזהה ייחודי */
  id: string;
  /** שם */
  name: string;
  /** גרסה */
  version: string;
  /** תיאור */
  description: string;
  /** קטגוריה */
  category: SkillCategory;
  /** תגיות */
  tags: string[];
  /** system prompt שמתווסף */
  systemPrompt: string;
  /** אייקון */
  icon?: string;
  /** מחבר */
  author?: string;
  /** דירוג */
  rating?: number;
  /** האם מותקן */
  isInstalled?: boolean;
  /** האם פעיל */
  isEnabled?: boolean;
}

// -------------------------------------------------
// התראות
// -------------------------------------------------

/** קטגוריות התראות */
export type NotificationCategory =
  | 'chat'
  | 'build'
  | 'git'
  | 'security'
  | 'system'
  | 'skill';

/** התראה חכמה */
export interface SmartNotification {
  /** מזהה */
  id: string;
  /** סוג */
  type: 'success' | 'error' | 'info' | 'warning';
  /** קטגוריה */
  category: NotificationCategory;
  /** כותרת */
  title: string;
  /** תוכן */
  message: string;
  /** עדיפות */
  priority: 'low' | 'normal' | 'high';
  /** כפתור פעולה */
  action?: {
    label: string;
    command: string;
  };
  /** חותמת זמן */
  timestamp: string;
  /** האם ההתראה נסגרה */
  dismissed?: boolean;
}

// -------------------------------------------------
// מודלים
// -------------------------------------------------

/** מזהי מודלים */
export type ModelId =
  | 'claude-sonnet-4-20250514'
  | 'claude-opus-4-20250514'
  | 'claude-haiku-4-5-20251001';

/** מידע על מודל */
export interface ModelInfo {
  id: ModelId;
  name: string;
  description: string;
  maxTokens: number;
  costPer1kInput: number;
  costPer1kOutput: number;
}

// -------------------------------------------------
// הגדרות
// -------------------------------------------------

/** הגדרות משתמש */
export interface UserSettings {
  /** Whether an API key is stored in SecretStorage (never contains the actual key) */
  hasApiKey: boolean;
  model: ModelId;
  language: 'he' | 'en';
  theme: 'auto' | 'dark' | 'light';
  fontSize: number;
  maxTokens: number;
  learningMode: boolean;
  permissionPreset: 'conservative' | 'normal' | 'full';
  quickActionsVisible: boolean;
  autoContext: boolean;
  voiceLanguage: string;
}

// -------------------------------------------------
// Git
// -------------------------------------------------

/** מידע על Git repo */
export interface GitInfo {
  /** ענף נוכחי */
  branch: string;
  /** שינויים לא committed */
  uncommittedChanges: number;
  /** remote URL */
  remoteUrl?: string;
  /** commit אחרון */
  lastCommit?: {
    hash: string;
    message: string;
    date: string;
    author: string;
  };
}

/** Diff של קובץ */
export interface FileDiff {
  /** נתיב הקובץ */
  filePath: string;
  /** סטטוס */
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  /** שורות שנוספו */
  additions: number;
  /** שורות שנמחקו */
  deletions: number;
  /** תוכן ה-diff */
  patch?: string;
}

/** שורה בודדת ב-diff */
export interface DiffLine {
  /** סוג השורה */
  type: 'added' | 'removed' | 'unchanged' | 'header';
  /** תוכן השורה */
  content: string;
  /** מספר שורה בקובץ הישן */
  oldLineNumber?: number;
  /** מספר שורה בקובץ החדש */
  newLineNumber?: number;
}

/** Hunk — קטע בודד ב-diff */
export interface DiffHunk {
  /** כותרת ה-hunk (למשל @@ -10,5 +10,7 @@) */
  header: string;
  /** שורת התחלה בקובץ הישן */
  oldStart: number;
  /** מספר שורות בקובץ הישן */
  oldCount: number;
  /** שורת התחלה בקובץ החדש */
  newStart: number;
  /** מספר שורות בקובץ החדש */
  newCount: number;
  /** שורות ב-hunk */
  lines: DiffLine[];
}

/** קובץ diff מלא עם hunks */
export interface DiffFile {
  /** שם הקובץ */
  filename: string;
  /** שם הקובץ הישן (במקרה של rename) */
  oldFilename?: string;
  /** סטטוס */
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  /** שורות שנוספו */
  additions: number;
  /** שורות שנמחקו */
  deletions: number;
  /** קטעי diff */
  hunks: DiffHunk[];
}

// -------------------------------------------------
// בריאות פרויקט
// -------------------------------------------------

/** ניתוח בריאות פרויקט */
export interface ProjectHealth {
  /** ציון כללי 0-100 */
  score: number;
  /** סטטוס build */
  buildStatus: 'passing' | 'failing' | 'unknown';
  /** בעיות אבטחה */
  securityIssues: number;
  /** שינויים לא committed */
  uncommittedChanges: number;
  /** האם יש CLAUDE.md */
  hasClaudeMd: boolean;
  /** האם יש טסטים */
  hasTests: boolean;
  /** חבילות לא מעודכנות */
  outdatedDependencies: number;
  /** המלצות */
  suggestions: string[];
}

// -------------------------------------------------
// Quick Actions
// -------------------------------------------------

/** פעולה מהירה */
export interface QuickAction {
  /** מזהה */
  id: string;
  /** תווית */
  label: string;
  /** אייקון */
  icon: string;
  /** תבנית prompt */
  promptTemplate: string;
  /** קטגוריה */
  category: 'code' | 'review' | 'test' | 'doc' | 'git' | 'other';
}

// -------------------------------------------------
// Chat Templates
// -------------------------------------------------

/** תבנית צ'אט לשימוש חוזר */
export interface ChatTemplate {
  /** מזהה */
  id: string;
  /** שם */
  name: string;
  /** תוכן ה-prompt */
  content: string;
  /** תגיות */
  tags: string[];
  /** תאריך יצירה */
  createdAt: string;
}

// -------------------------------------------------
// Prompt Templates — תבניות פרומפט לשימוש חוזר
// -------------------------------------------------

/** קטגוריות תבניות פרומפט */
export type PromptTemplateCategory =
  | 'general'
  | 'code'
  | 'review'
  | 'debug'
  | 'security'
  | 'custom';

/** תבנית פרומפט */
export interface PromptTemplate {
  /** מזהה ייחודי */
  id: string;
  /** כותרת התבנית */
  title: string;
  /** תוכן הפרומפט (תומך ב-{{variable}} placeholders) */
  content: string;
  /** קטגוריה */
  category: PromptTemplateCategory;
  /** אייקון */
  icon: string;
  /** משתנים — רשימת placeholders כמו {{code}}, {{file}}, {{language}} */
  variables: string[];
  /** האם תבנית מובנית (לא ניתנת למחיקה/עריכה) */
  isBuiltIn: boolean;
  /** תאריך יצירה */
  createdAt: string;
}

// -------------------------------------------------
// Session State — שחזור מושב
// -------------------------------------------------

/** מצב מושב לשחזור לאחר קריסה/טעינה מחדש */
export interface SessionState {
  /** מזהה השיחה הפעילה */
  activeConversationId: string | null;
  /** מזהה הפרויקט הפעיל */
  activeProjectId: string | null;
  /** הפאנל הפעיל */
  activePanel: 'projects' | 'chat' | 'settings' | 'skills' | 'onboarding';
  /** מזהה הסוכן הפעיל */
  activeAgentId: AgentId;
  /** מיקום גלילה בשיחה */
  scrollPosition: number;
  /** חותמת זמן השמירה */
  savedAt: string;
  /** דגל dirty — האם יש שינויים שלא נשמרו */
  isDirty: boolean;
}

// -------------------------------------------------
// Timeline
// -------------------------------------------------

/** אירוע בציר הזמן */
export interface TimelineEvent {
  /** מזהה */
  id: string;
  /** סוג */
  type: 'commit' | 'chat' | 'build' | 'deploy' | 'review' | 'milestone';
  /** כותרת */
  title: string;
  /** תיאור */
  description?: string;
  /** חותמת זמן */
  timestamp: string;
  /** סוכן שביצע */
  agentId?: AgentId;
  /** מטא-דאטה */
  metadata?: Record<string, unknown>;
}

// -------------------------------------------------
// Analytics — סטטיסטיקות שימוש
// -------------------------------------------------

/** סטטיסטיקות מסוכמות לתצוגה בדשבורד */
export interface AnalyticsSummary {
  /** סה"כ הודעות */
  totalMessages: number;
  /** סה"כ טוקנים */
  totalTokens: number;
  /** סה"כ עלות ($) */
  totalCost: number;
  /** זמן תגובה ממוצע (מילישניות) */
  avgResponseTime: number;
  /** מגמת הודעות (אחוז שינוי שבועי) */
  messageTrend: number;
  /** מגמת טוקנים */
  tokenTrend: number;
  /** מגמת עלות */
  costTrend: number;
  /** הודעות יומיות (7 ימים אחרונים) */
  dailyMessages: Array<{ date: string; sent: number; received: number }>;
  /** שימוש לפי סוכן */
  agentUsage: Array<{ agentId: string; count: number }>;
  /** פקודות פופולריות */
  topCommands: Array<{ command: string; count: number }>;
  /** פרויקטים לפי פעילות */
  topProjects: Array<{ projectId: string; count: number }>;
  /** משך סשן נוכחי (דקות) */
  sessionDuration: number;
  /** הודעות בסשן הנוכחי */
  sessionMessages: number;
  /** מודל נוכחי */
  currentModel: string;
  /** טוקנים יומיים (7 ימים אחרונים) */
  dailyTokens: Array<{ date: string; tokens: number }>;
}
