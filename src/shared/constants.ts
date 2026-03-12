// ===================================================
// Constants — קבועים משותפים
// ===================================================

import type { Agent, AgentId, ModelInfo, Workflow, QuickAction, Skill } from './types';

// -------------------------------------------------
// מודלים זמינים
// -------------------------------------------------

export const MODELS: Record<string, ModelInfo> = {
  'claude-sonnet-4-20250514': {
    id: 'claude-sonnet-4-20250514',
    name: 'Claude Sonnet 4',
    description: 'מאוזן — מהיר וחכם (מומלץ)',
    maxTokens: 64000,
    costPer1kInput: 0.003,
    costPer1kOutput: 0.015,
  },
  'claude-opus-4-20250514': {
    id: 'claude-opus-4-20250514',
    name: 'Claude Opus 4',
    description: 'החזק ביותר — למשימות מורכבות',
    maxTokens: 200000,
    costPer1kInput: 0.015,
    costPer1kOutput: 0.075,
  },
  'claude-haiku-4-5-20251001': {
    id: 'claude-haiku-4-5-20251001',
    name: 'Claude Haiku 4.5',
    description: 'המהיר ביותר — למשימות פשוטות',
    maxTokens: 64000,
    costPer1kInput: 0.001,
    costPer1kOutput: 0.005,
  },
};

// -------------------------------------------------
// סוכנים מובנים — 7 סוכנים עם תפקידים ייחודיים
// -------------------------------------------------

export const BUILT_IN_AGENTS: Record<AgentId, Agent> = {
  manager: {
    id: 'manager',
    name: 'מנהל פרויקט',
    description: 'מנתח משימות, מחלק עבודה, מתאם בין סוכנים',
    icon: '👔',
    color: '#8b5cf6',
    systemPrompt: `You are a Project Manager agent. Your role is to:
- Analyze tasks and break them down into smaller steps
- Decide which agent should handle each step
- Coordinate between agents for complex tasks
- Track progress and report status
- Make architectural decisions when needed
Always respond in the user's language (Hebrew/English).`,
    allowedTools: ['read_file', 'search_files', 'search_content', 'list_files'],
    maxTurns: 10,
  },
  architect: {
    id: 'architect',
    name: 'ארכיטקט',
    description: 'מתכנן מבנה מערכת, דפוסי עיצוב, החלטות טכנולוגיות',
    icon: '🏗️',
    color: '#06b6d4',
    systemPrompt: `You are a Software Architect agent. Your role is to:
- Design system architecture and data flow
- Choose appropriate design patterns
- Plan file structure and module organization
- Review code for architectural consistency
- Suggest technology stack decisions
Always provide diagrams in ASCII when helpful. Respond in the user's language.`,
    allowedTools: ['read_file', 'write_file', 'search_files', 'search_content', 'list_files'],
    maxTurns: 15,
  },
  developer: {
    id: 'developer',
    name: 'מפתח',
    description: 'כותב קוד, מתקן באגים, מממש פיצ\'רים',
    icon: '💻',
    color: '#10b981',
    systemPrompt: `You are a Developer agent. Your role is to:
- Write clean, well-documented code
- Fix bugs and implement features
- Follow project conventions and patterns
- Use existing utilities and avoid duplication
- Add comments in Hebrew when learning mode is enabled
Always write production-quality code. Respond in the user's language.`,
    allowedTools: ['read_file', 'write_file', 'edit_file', 'search_files', 'search_content', 'run_command', 'list_files'],
    maxTurns: 30,
  },
  qa: {
    id: 'qa',
    name: 'בודק איכות',
    description: 'כותב טסטים, מוצא באגים, מבטיח איכות',
    icon: '🧪',
    color: '#f59e0b',
    systemPrompt: `You are a QA Engineer agent. Your role is to:
- Write comprehensive unit and integration tests
- Find edge cases and potential bugs
- Review code for correctness and reliability
- Run existing tests and report results
- Suggest improvements for testability
Always aim for high coverage. Respond in the user's language.`,
    allowedTools: ['read_file', 'write_file', 'search_files', 'search_content', 'run_command', 'list_files'],
    maxTurns: 20,
  },
  designer: {
    id: 'designer',
    name: 'מעצב UI/UX',
    description: 'מעצב ממשקים, מתכנן חוויית משתמש, נגישות',
    icon: '🎨',
    color: '#ec4899',
    systemPrompt: `You are a UI/UX Designer agent. Your role is to:
- Design user interfaces with modern aesthetics
- Ensure RTL support for Hebrew interfaces
- Create responsive layouts (mobile-first)
- Follow accessibility guidelines (WCAG)
- Use Tailwind CSS and component composition
Always consider the end-user experience. Respond in the user's language.`,
    allowedTools: ['read_file', 'write_file', 'edit_file', 'search_files', 'list_files'],
    maxTurns: 20,
  },
  security: {
    id: 'security',
    name: 'מומחה אבטחה',
    description: 'סורק פגיעויות, בודק אבטחה, OWASP',
    icon: '🔒',
    color: '#ef4444',
    systemPrompt: `You are a Security Expert agent. Your role is to:
- Scan code for security vulnerabilities (OWASP Top 10)
- Check for exposed secrets and credentials
- Review authentication and authorization logic
- Validate input sanitization and output encoding
- Suggest security best practices
Always prioritize security. Respond in the user's language.`,
    allowedTools: ['read_file', 'search_files', 'search_content', 'run_command', 'list_files'],
    maxTurns: 15,
  },
  writer: {
    id: 'writer',
    name: 'כותב תיעוד',
    description: 'כותב תיעוד, README, הערות, API docs',
    icon: '✍️',
    color: '#6366f1',
    systemPrompt: `You are a Technical Writer agent. Your role is to:
- Write clear README files and documentation
- Add JSDoc/TSDoc comments to code
- Create API documentation
- Write user guides and tutorials
- Maintain CHANGELOG and migration guides
Always write clearly and concisely. Support Hebrew and English.`,
    allowedTools: ['read_file', 'write_file', 'edit_file', 'search_files', 'list_files'],
    maxTurns: 15,
  },
};

// -------------------------------------------------
// Workflows מובנים
// -------------------------------------------------

export const BUILT_IN_WORKFLOWS: Workflow[] = [
  {
    id: 'new-feature',
    name: 'פיצ\'ר חדש',
    description: 'ארכיטקט → מפתח → QA → אבטחה → תיעוד',
    icon: '🚀',
    steps: [
      {
        agentId: 'architect',
        input: 'Plan the architecture for: {{userInput}}',
        outputVar: 'plan',
      },
      {
        agentId: 'developer',
        input: 'Implement based on this plan:\n{{plan}}',
        outputVar: 'code',
        dependsOn: ['plan'],
      },
      {
        agentId: 'qa',
        input: 'Write tests for the new code:\n{{code}}',
        outputVar: 'tests',
        dependsOn: ['code'],
      },
      {
        agentId: 'security',
        input: 'Review security of:\n{{code}}',
        outputVar: 'securityReview',
        dependsOn: ['code'],
      },
      {
        agentId: 'writer',
        input: 'Document the new feature:\n{{plan}}\n{{code}}',
        outputVar: 'docs',
        dependsOn: ['code'],
      },
    ],
  },
  {
    id: 'bug-fix',
    name: 'תיקון באג',
    description: 'מפתח (ניתוח) → מפתח (תיקון) → QA',
    icon: '🐛',
    steps: [
      {
        agentId: 'developer',
        input: 'Investigate and find the root cause of: {{userInput}}',
        outputVar: 'analysis',
      },
      {
        agentId: 'developer',
        input: 'Fix the bug based on analysis:\n{{analysis}}',
        outputVar: 'fix',
        dependsOn: ['analysis'],
      },
      {
        agentId: 'qa',
        input: 'Verify the fix and write regression tests:\n{{fix}}',
        outputVar: 'verification',
        dependsOn: ['fix'],
      },
    ],
  },
  {
    id: 'code-review',
    name: 'סקירת קוד',
    description: 'אבטחה → QA → כותב',
    icon: '🔍',
    steps: [
      {
        agentId: 'security',
        input: 'Security review of the current changes: {{userInput}}',
        outputVar: 'securityReview',
      },
      {
        agentId: 'qa',
        input: 'Quality review:\n{{securityReview}}\n\nOriginal: {{userInput}}',
        outputVar: 'qaReview',
        dependsOn: ['securityReview'],
      },
      {
        agentId: 'writer',
        input: 'Summarize review findings:\nSecurity: {{securityReview}}\nQA: {{qaReview}}',
        outputVar: 'summary',
        dependsOn: ['qaReview'],
      },
    ],
  },
  {
    id: 'release',
    name: 'שחרור גרסה',
    description: 'QA → אבטחה → מפתח (bump) → תיעוד',
    icon: '📦',
    steps: [
      {
        agentId: 'qa',
        input: 'Run all tests and verify quality for release: {{userInput}}',
        outputVar: 'qaReport',
      },
      {
        agentId: 'security',
        input: 'Final security scan before release',
        outputVar: 'securityReport',
        dependsOn: ['qaReport'],
      },
      {
        agentId: 'developer',
        input: 'Bump version and prepare release:\nQA: {{qaReport}}\nSecurity: {{securityReport}}',
        outputVar: 'release',
        dependsOn: ['securityReport'],
      },
      {
        agentId: 'writer',
        input: 'Write release notes and update CHANGELOG:\n{{release}}',
        outputVar: 'releaseNotes',
        dependsOn: ['release'],
      },
    ],
  },
];

// -------------------------------------------------
// Quick Actions — פעולות מהירות
// -------------------------------------------------

export const QUICK_ACTIONS: QuickAction[] = [
  { id: 'explain', label: 'הסבר קוד', icon: '💡', promptTemplate: 'Explain the selected code in detail', category: 'code' },
  { id: 'fix', label: 'תקן באג', icon: '🐛', promptTemplate: 'Find and fix bugs in the current file', category: 'code' },
  { id: 'refactor', label: 'שפר קוד', icon: '♻️', promptTemplate: 'Refactor the selected code for better quality', category: 'code' },
  { id: 'review', label: 'סקירת קוד', icon: '🔍', promptTemplate: 'Review the current file for issues and improvements', category: 'review' },
  { id: 'test', label: 'כתוב טסטים', icon: '🧪', promptTemplate: 'Write comprehensive tests for the current file', category: 'test' },
  { id: 'doc', label: 'תעד', icon: '📝', promptTemplate: 'Add documentation and comments to the current code', category: 'doc' },
  { id: 'optimize', label: 'אופטימיזציה', icon: '⚡', promptTemplate: 'Optimize the current code for performance', category: 'code' },
  { id: 'security', label: 'בדיקת אבטחה', icon: '🔒', promptTemplate: 'Check the current file for security vulnerabilities', category: 'review' },
  { id: 'typescript', label: 'הוסף טיפוסים', icon: '📘', promptTemplate: 'Add TypeScript types and interfaces to the code', category: 'code' },
  { id: 'a11y', label: 'נגישות', icon: '♿', promptTemplate: 'Check and improve accessibility in the current component', category: 'review' },
  { id: 'commit', label: 'צור commit', icon: '📌', promptTemplate: 'Suggest a commit message for the current changes', category: 'git' },
  { id: 'readme', label: 'צור README', icon: '📄', promptTemplate: 'Generate a README.md for this project', category: 'doc' },
];

// -------------------------------------------------
// Skills מובנים
// -------------------------------------------------

export const BUILT_IN_SKILLS: Skill[] = [
  {
    id: 'hebrew-code-review',
    name: 'סקירת קוד בעברית',
    version: '1.0.0',
    description: 'סקירת קוד עם הערות מפורטות בעברית',
    category: 'coding',
    tags: ['hebrew', 'review', 'quality'],
    systemPrompt: 'When reviewing code, always provide feedback in Hebrew with detailed explanations.',
    icon: '🔍',
    author: 'TS_AiTool',
    rating: 5,
  },
  {
    id: 'git-workflow',
    name: 'Git Workflow',
    version: '1.0.0',
    description: 'ניהול Git מתקדם — branches, PRs, conventional commits',
    category: 'devops',
    tags: ['git', 'workflow', 'ci'],
    systemPrompt: 'Help with Git operations. Use conventional commits (feat:, fix:, refactor:). Create meaningful branch names.',
    icon: '🌿',
    author: 'TS_AiTool',
    rating: 4.5,
  },
  {
    id: 'testing-strategy',
    name: 'אסטרטגיית טסטים',
    version: '1.0.0',
    description: 'תכנון וכתיבת טסטים — unit, integration, e2e',
    category: 'testing',
    tags: ['testing', 'jest', 'vitest', 'coverage'],
    systemPrompt: 'Focus on testing strategy. Write tests using the testing framework already in the project. Aim for high coverage.',
    icon: '🧪',
    author: 'TS_AiTool',
    rating: 4.5,
  },
  {
    id: 'security-checklist',
    name: 'רשימת אבטחה',
    version: '1.0.0',
    description: 'בדיקת OWASP Top 10, סודות חשופים, הרשאות',
    category: 'security',
    tags: ['security', 'owasp', 'audit'],
    systemPrompt: 'Perform security audits. Check for OWASP Top 10 vulnerabilities, exposed secrets, SQL injection, XSS, and CSRF issues.',
    icon: '🛡️',
    author: 'TS_AiTool',
    rating: 5,
  },
  {
    id: 'performance-audit',
    name: 'ביקורת ביצועים',
    version: '1.0.0',
    description: 'בדיקת ביצועים — N+1, memory leaks, bundle size',
    category: 'coding',
    tags: ['performance', 'optimization', 'profiling'],
    systemPrompt: 'Focus on performance optimization. Check for N+1 queries, memory leaks, unnecessary re-renders, and bundle size.',
    icon: '⚡',
    author: 'TS_AiTool',
    rating: 4,
  },
  {
    id: 'accessibility-check',
    name: 'בדיקת נגישות',
    version: '1.0.0',
    description: 'WCAG 2.1 AA — ניגודיות, ARIA, מקלדת',
    category: 'design',
    tags: ['a11y', 'wcag', 'accessibility'],
    systemPrompt: 'Check for accessibility issues following WCAG 2.1 AA guidelines. Verify color contrast, ARIA labels, keyboard navigation.',
    icon: '♿',
    author: 'TS_AiTool',
    rating: 4,
  },
];

// -------------------------------------------------
// Limits
// -------------------------------------------------

export const LIMITS = {
  /** מקסימום שיחות שמורות */
  MAX_CONVERSATIONS: 200,
  /** מקסימום הודעות בשיחה */
  MAX_MESSAGES_PER_CONVERSATION: 500,
  /** מקסימום קבצים בעץ */
  MAX_FILE_TREE_ITEMS: 1000,
  /** מקסימום התראות */
  MAX_NOTIFICATIONS: 50,
  /** מקסימום פרויקטים */
  MAX_PROJECTS: 50,
  /** מקסימום תבניות */
  MAX_TEMPLATES: 100,
  /** גודל מקסימלי של תמונה (5MB) */
  MAX_IMAGE_SIZE: 5 * 1024 * 1024,
} as const;
