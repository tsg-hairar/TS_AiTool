// ===================================================
// ProjectHandler — טיפול בפעולות פרויקט
// ===================================================

import * as vscode from 'vscode';
import type { ExtensionToWebviewMessage } from '../../shared/messages';
import { ProjectManager } from '../services/ProjectManager';

export class ProjectHandler {
  constructor(
    private readonly projectManager: ProjectManager,
    private readonly postMessage: (msg: ExtensionToWebviewMessage) => void,
  ) {}

  // שליחת רשימת פרויקטים
  public async getProjects(): Promise<void> {
    const projects = this.projectManager.getProjects();
    this.postMessage({ type: 'projectList', payload: projects });
  }

  // יצירת פרויקט
  public async createProject(payload: {
    name: string;
    path: string;
    description?: string;
  }): Promise<void> {
    try {
      const project = await this.projectManager.createProject(
        payload.name, payload.path, payload.description,
      );
      this.postMessage({ type: 'projectCreated', payload: project });
      await this.getProjects(); // רענון הרשימה
    } catch (error) {
      this.postMessage({
        type: 'error',
        payload: { message: error instanceof Error ? error.message : 'Failed to create project' },
      });
    }
  }

  // פתיחת פרויקט
  public async openProject(projectId: string): Promise<void> {
    const project = await this.projectManager.openProject(projectId);
    if (project) {
      this.postMessage({ type: 'projectOpened', payload: project });
    }
  }

  // מחיקת פרויקט
  public async deleteProject(projectId: string): Promise<void> {
    await this.projectManager.deleteProject(projectId);
    this.postMessage({ type: 'projectDeleted', payload: { projectId } });
    await this.getProjects();
  }

  // רענון פרויקט
  public async refreshProject(projectId: string): Promise<void> {
    const project = this.projectManager.getProject(projectId);
    if (!project) return;

    // עדכון tech stack ובריאות
    const techStack = await this.projectManager.detectTechStack(project.path);
    const health = await this.projectManager.analyzeHealth(project.path);
    const claudeMd = await this.projectManager.readClaudeMd(project.path);

    await this.projectManager.updateProject(projectId, {
      techStack,
      healthScore: health.score,
      claudeMd: claudeMd ?? undefined,
    });

    await this.getProjects();
  }

  // ייבוא פרויקט מתיקייה
  public async importProject(): Promise<void> {
    // פתיחת דיאלוג בחירת תיקייה
    const folders = await vscode.window.showOpenDialog({
      canSelectFolders: true,
      canSelectFiles: false,
      canSelectMany: false,
      openLabel: 'Import Project',
    });

    if (!folders || folders.length === 0) return;

    const folderPath = folders[0].fsPath;
    const folderName = folderPath.split(/[/\\]/).pop() ?? 'Project';

    await this.createProject({
      name: folderName,
      path: folderPath,
    });
  }

  // בריאות פרויקט
  public async getProjectHealth(projectId: string): Promise<void> {
    const project = this.projectManager.getProject(projectId);
    if (!project) return;

    const health = await this.projectManager.analyzeHealth(project.path);
    this.postMessage({ type: 'projectHealth', payload: health });
  }
}
