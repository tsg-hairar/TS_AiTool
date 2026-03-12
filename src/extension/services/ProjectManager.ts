// ===================================================
// ProjectManager — ניהול פרויקטים
// ===================================================
// שירות זה אחראי על יצירה, מחיקה, וסריקת פרויקטים
// כל פרויקט = תיקייה עם קוד + מטא-דאטה ב-globalState
// ===================================================

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuid } from 'crypto';
import type { Project, ProjectSettings, ProjectHealth } from '../../shared/types';
import { LIMITS } from '../../shared/constants';
import { SettingsService } from './SettingsService';

// מפתח לשמירה ב-globalState של VS Code
const PROJECTS_KEY = 'tsAiTool.projects';

export class ProjectManager {
  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly settingsService: SettingsService,
  ) {}

  // -------------------------------------------------
  // getProjects — קבלת כל הפרויקטים
  // -------------------------------------------------
  public getProjects(): Project[] {
    return this.context.globalState.get<Project[]>(PROJECTS_KEY) ?? [];
  }

  // -------------------------------------------------
  // createProject — יצירת פרויקט חדש
  // -------------------------------------------------
  public async createProject(
    name: string,
    projectPath: string,
    description?: string,
  ): Promise<Project> {
    const projects = this.getProjects();

    // בדיקת מגבלת פרויקטים
    if (projects.length >= LIMITS.MAX_PROJECTS) {
      throw new Error(`Maximum ${LIMITS.MAX_PROJECTS} projects allowed`);
    }

    // בדיקה שהפרויקט לא קיים כבר
    if (projects.some((p) => p.path === projectPath)) {
      throw new Error('Project already exists at this path');
    }

    // סריקת הפרויקט — זיהוי טכנולוגיות
    const techStack = await this.detectTechStack(projectPath);

    // קריאת CLAUDE.md אם קיים
    const claudeMd = await this.readClaudeMd(projectPath);

    // בחירת אייקון לפי tech stack
    const icon = this.chooseIcon(techStack);

    // בחירת צבע אקראי
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
    const color = colors[projects.length % colors.length];

    const project: Project = {
      id: generateId(),
      name,
      path: projectPath,
      description: description ?? `Project at ${projectPath}`,
      techStack,
      healthScore: 0,
      createdAt: new Date().toISOString(),
      lastOpenedAt: new Date().toISOString(),
      chatCount: 0,
      icon,
      color,
      claudeMd: claudeMd ?? undefined,
      settings: {},
    };

    // חישוב ציון בריאות
    project.healthScore = (await this.analyzeHealth(projectPath)).score;

    // שמירה
    projects.push(project);
    await this.context.globalState.update(PROJECTS_KEY, projects);

    return project;
  }

  // -------------------------------------------------
  // deleteProject — מחיקת פרויקט (רק מהרשימה, לא מהדיסק!)
  // -------------------------------------------------
  public async deleteProject(projectId: string): Promise<void> {
    const projects = this.getProjects().filter((p) => p.id !== projectId);
    await this.context.globalState.update(PROJECTS_KEY, projects);
  }

  // -------------------------------------------------
  // updateProject — עדכון פרויקט
  // -------------------------------------------------
  public async updateProject(projectId: string, updates: Partial<Project>): Promise<Project | null> {
    const projects = this.getProjects();
    const index = projects.findIndex((p) => p.id === projectId);
    if (index === -1) return null;

    projects[index] = { ...projects[index], ...updates };
    await this.context.globalState.update(PROJECTS_KEY, projects);
    return projects[index];
  }

  // -------------------------------------------------
  // getProject — קבלת פרויקט לפי ID
  // -------------------------------------------------
  public getProject(projectId: string): Project | undefined {
    return this.getProjects().find((p) => p.id === projectId);
  }

  // -------------------------------------------------
  // openProject — פתיחת פרויקט (עדכון lastOpenedAt)
  // -------------------------------------------------
  public async openProject(projectId: string): Promise<Project | null> {
    return this.updateProject(projectId, {
      lastOpenedAt: new Date().toISOString(),
    });
  }

  // -------------------------------------------------
  // importFromWorkspace — ייבוא פרויקטים מה-workspace הנוכחי
  // -------------------------------------------------
  public async importFromWorkspace(): Promise<Project[]> {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders) return [];

    const imported: Project[] = [];
    for (const folder of folders) {
      const existing = this.getProjects().find((p) => p.path === folder.uri.fsPath);
      if (!existing) {
        const project = await this.createProject(folder.name, folder.uri.fsPath);
        imported.push(project);
      }
    }
    return imported;
  }

  // -------------------------------------------------
  // detectTechStack — זיהוי אוטומטי של טכנולוגיות
  // -------------------------------------------------
  public async detectTechStack(projectPath: string): Promise<string[]> {
    const stack: string[] = [];

    // מיפוי קבצים → טכנולוגיות
    const markers: Record<string, string> = {
      'package.json': 'Node.js',
      'tsconfig.json': 'TypeScript',
      'next.config.js': 'Next.js',
      'next.config.mjs': 'Next.js',
      'next.config.ts': 'Next.js',
      'vite.config.ts': 'Vite',
      'vite.config.js': 'Vite',
      'angular.json': 'Angular',
      'vue.config.js': 'Vue',
      'nuxt.config.ts': 'Nuxt',
      'svelte.config.js': 'Svelte',
      'tailwind.config.js': 'Tailwind CSS',
      'tailwind.config.ts': 'Tailwind CSS',
      'nest-cli.json': 'NestJS',
      'requirements.txt': 'Python',
      'pyproject.toml': 'Python',
      'Cargo.toml': 'Rust',
      'go.mod': 'Go',
      'pom.xml': 'Java',
      'build.gradle': 'Java/Kotlin',
      'Gemfile': 'Ruby',
      'docker-compose.yml': 'Docker',
      'docker-compose.yaml': 'Docker',
      'Dockerfile': 'Docker',
      '.github/workflows': 'GitHub Actions',
      'app.json': 'Expo',
      'expo.json': 'Expo',
      'prisma/schema.prisma': 'Prisma',
      'drizzle.config.ts': 'Drizzle',
      'supabase/config.toml': 'Supabase',
      'turbo.json': 'Turborepo',
      'pnpm-workspace.yaml': 'pnpm Monorepo',
      'lerna.json': 'Lerna',
    };

    for (const [file, tech] of Object.entries(markers)) {
      const fullPath = path.join(projectPath, file);
      try {
        await fs.promises.access(fullPath);
        if (!stack.includes(tech)) {
          stack.push(tech);
        }
      } catch {
        // קובץ לא קיים — ממשיכים
      }
    }

    // בדיקת React/Vue/Svelte ב-package.json
    try {
      const pkgPath = path.join(projectPath, 'package.json');
      const pkg = JSON.parse(await fs.promises.readFile(pkgPath, 'utf-8'));
      const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
      };

      if (allDeps['react'] && !stack.includes('React')) stack.push('React');
      if (allDeps['vue'] && !stack.includes('Vue')) stack.push('Vue');
      if (allDeps['svelte'] && !stack.includes('Svelte')) stack.push('Svelte');
      if (allDeps['express'] && !stack.includes('Express')) stack.push('Express');
      if (allDeps['@nestjs/core'] && !stack.includes('NestJS')) stack.push('NestJS');
      if (allDeps['react-native'] && !stack.includes('React Native')) stack.push('React Native');
      if (allDeps['electron'] && !stack.includes('Electron')) stack.push('Electron');
    } catch {
      // package.json לא קיים
    }

    return stack;
  }

  // -------------------------------------------------
  // readClaudeMd — קריאת CLAUDE.md
  // -------------------------------------------------
  public async readClaudeMd(projectPath: string): Promise<string | null> {
    try {
      const claudePath = path.join(projectPath, 'CLAUDE.md');
      return await fs.promises.readFile(claudePath, 'utf-8');
    } catch {
      return null;
    }
  }

  // -------------------------------------------------
  // analyzeHealth — ניתוח בריאות פרויקט
  // -------------------------------------------------
  public async analyzeHealth(projectPath: string): Promise<ProjectHealth> {
    let score = 50; // ציון בסיסי
    const suggestions: string[] = [];

    // בדיקת CLAUDE.md
    const hasClaudeMd = await this.fileExists(projectPath, 'CLAUDE.md');
    if (hasClaudeMd) score += 10;
    else suggestions.push('Create a CLAUDE.md file for AI context');

    // בדיקת טסטים
    const hasTests = await this.hasTestFiles(projectPath);
    if (hasTests) score += 15;
    else suggestions.push('Add tests to improve code quality');

    // בדיקת .gitignore
    const hasGitignore = await this.fileExists(projectPath, '.gitignore');
    if (hasGitignore) score += 5;
    else suggestions.push('Add .gitignore file');

    // בדיקת README
    const hasReadme = await this.fileExists(projectPath, 'README.md');
    if (hasReadme) score += 5;
    else suggestions.push('Add README.md');

    // בדיקת package-lock / pnpm-lock
    const hasLock = await this.fileExists(projectPath, 'package-lock.json')
      || await this.fileExists(projectPath, 'pnpm-lock.yaml')
      || await this.fileExists(projectPath, 'yarn.lock');
    if (hasLock) score += 5;
    else suggestions.push('Commit your lock file');

    // בדיקת .env.example
    const hasEnvExample = await this.fileExists(projectPath, '.env.example');
    const hasEnv = await this.fileExists(projectPath, '.env');
    if (hasEnv && !hasEnvExample) {
      suggestions.push('Create .env.example for team setup');
    }
    if (hasEnvExample) score += 5;

    // בדיקת Git
    const hasGit = await this.fileExists(projectPath, '.git');
    if (hasGit) score += 5;
    else suggestions.push('Initialize Git repository');

    return {
      score: Math.min(score, 100),
      buildStatus: 'unknown',
      securityIssues: 0,
      uncommittedChanges: 0,
      hasClaudeMd,
      hasTests,
      outdatedDependencies: 0,
      suggestions,
    };
  }

  // -------------------------------------------------
  // Helpers
  // -------------------------------------------------

  private async fileExists(dir: string, file: string): Promise<boolean> {
    try {
      await fs.promises.access(path.join(dir, file));
      return true;
    } catch {
      return false;
    }
  }

  private async hasTestFiles(dir: string): Promise<boolean> {
    // בדיקה פשוטה — האם יש תיקיית test/tests/__tests__
    const testDirs = ['test', 'tests', '__tests__', 'spec'];
    for (const testDir of testDirs) {
      if (await this.fileExists(dir, testDir)) return true;
    }

    // בדיקה ב-package.json — האם יש script של test
    try {
      const pkg = JSON.parse(
        await fs.promises.readFile(path.join(dir, 'package.json'), 'utf-8'),
      );
      if (pkg.scripts?.test && pkg.scripts.test !== 'echo "Error: no test specified" && exit 1') {
        return true;
      }
    } catch {
      // ממשיכים
    }

    return false;
  }

  private chooseIcon(techStack: string[]): string {
    // בחירת אייקון לפי הטכנולוגיה הראשית
    if (techStack.includes('React') || techStack.includes('Next.js')) return '⚛️';
    if (techStack.includes('Vue') || techStack.includes('Nuxt')) return '💚';
    if (techStack.includes('Angular')) return '🅰️';
    if (techStack.includes('Svelte')) return '🔥';
    if (techStack.includes('NestJS')) return '🐱';
    if (techStack.includes('Express')) return '🚂';
    if (techStack.includes('React Native') || techStack.includes('Expo')) return '📱';
    if (techStack.includes('Python')) return '🐍';
    if (techStack.includes('Rust')) return '🦀';
    if (techStack.includes('Go')) return '🐹';
    if (techStack.includes('Java') || techStack.includes('Java/Kotlin')) return '☕';
    if (techStack.includes('Ruby')) return '💎';
    if (techStack.includes('Docker')) return '🐳';
    if (techStack.includes('TypeScript')) return '📘';
    if (techStack.includes('Node.js')) return '🟢';
    return '📁';
  }
}

// -------------------------------------------------
// generateId — יצירת מזהה ייחודי
// -------------------------------------------------
function generateId(): string {
  // שימוש ב-crypto של Node.js ליצירת UUID
  const bytes = new Uint8Array(16);
  require('crypto').randomFillSync(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 1
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
