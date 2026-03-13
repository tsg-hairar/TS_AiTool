// ===================================================
// ChatHandler — facade for chat operations
// ===================================================
// Delegates to focused sub-modules:
// - MessageHandler: sending messages and streaming
// - ToolExecutionCoordinator: tool approval and execution
// - ConversationManager: conversation CRUD and auto-save
// ===================================================

import * as vscode from 'vscode';
import type { ExtensionToWebviewMessage } from '../../shared/messages';
import type { AgentId } from '../../shared/types';
import { ClaudeService } from '../services/ClaudeService';
import { ConversationStore } from '../services/ConversationStore';
import { SettingsService } from '../services/SettingsService';
import { MessageHandler } from './chat/MessageHandler';
import { ToolExecutionCoordinator } from './chat/ToolExecutionCoordinator';
import { ConversationManager } from './chat/ConversationManager';

/**
 * ChatHandler -- Facade for all chat operations.
 *
 * Delegates to focused sub-modules:
 * - {@link MessageHandler}: Sending messages to Claude and streaming responses
 * - {@link ToolExecutionCoordinator}: Tool approval/denial workflow
 * - {@link ConversationManager}: Conversation CRUD, auto-save, drafts, bookmarks
 *
 * Manages the current project and agent context, which is shared with sub-modules
 * via the getContext accessor.
 */
export class ChatHandler {
  private claudeService: ClaudeService;
  private currentProjectId: string | null = null;
  private currentAgentId: AgentId = 'developer';

  // Sub-modules
  private readonly messageHandler: MessageHandler;
  private readonly toolCoordinator: ToolExecutionCoordinator;
  private readonly conversationManager: ConversationManager;

  /** Access to ClaudeService — used by SlashCommandHandler */
  public getClaudeService(): ClaudeService {
    return this.claudeService;
  }

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly settingsService: SettingsService,
    private readonly conversationStore: ConversationStore,
    private readonly postMessage: (msg: ExtensionToWebviewMessage) => void,
    claudeService: ClaudeService,
  ) {
    this.claudeService = claudeService;

    // Context accessor for sub-modules
    const getContext = () => ({
      projectId: this.currentProjectId,
      agentId: this.currentAgentId,
    });

    // Create sub-modules
    this.toolCoordinator = new ToolExecutionCoordinator(
      settingsService,
      postMessage,
    );

    this.conversationManager = new ConversationManager(
      conversationStore,
      postMessage,
      getContext,
    );

    this.messageHandler = new MessageHandler(
      claudeService,
      settingsService,
      conversationStore,
      postMessage,
      getContext,
      this.toolCoordinator,
      () => this.conversationManager.markDirty(),
    );
  }

  // -------------------------------------------------
  // setContext — set current project and agent
  // -------------------------------------------------
  public setContext(projectId: string, agentId: AgentId, projectPath?: string): void {
    this.currentProjectId = projectId;
    this.currentAgentId = agentId;

    if (projectPath) {
      this.claudeService.setWorkingDirectory(projectPath);
    }
  }

  public getCurrentProjectId(): string | null {
    return this.currentProjectId;
  }

  /**
   * Send a user message to Claude and stream the response to the webview.
   * @param content - The user's message text
   * @param images - Optional array of base64-encoded image data
   */
  public async sendMessage(content: string, images?: string[]): Promise<void> {
    return this.messageHandler.sendMessage(content, images);
  }

  // -------------------------------------------------
  // Tool operations — delegated to ToolExecutionCoordinator
  // -------------------------------------------------
  public approveToolUse(toolUseId: string): void {
    this.toolCoordinator.approveToolUse(toolUseId);
  }

  public denyToolUse(toolUseId: string): void {
    this.toolCoordinator.denyToolUse(toolUseId);
  }

  // -------------------------------------------------
  // Conversation operations — delegated to ConversationManager
  // -------------------------------------------------
  public markDirty(): void {
    this.conversationManager.markDirty();
  }

  public async autoSaveConversation(): Promise<void> {
    return this.conversationManager.autoSaveConversation();
  }

  public stopAutoSave(): void {
    this.conversationManager.stopAutoSave();
  }

  public saveDraft(conversationId: string, text: string): void {
    this.conversationManager.saveDraft(conversationId, text);
  }

  public loadDraft(conversationId: string): void {
    this.conversationManager.loadDraft(conversationId);
  }

  public async newChat(): Promise<void> {
    return this.conversationManager.newChat();
  }

  public async clearChat(): Promise<void> {
    return this.conversationManager.clearChat();
  }

  public loadLastConversation(): void {
    this.conversationManager.loadLastConversation();
  }

  public async loadConversation(conversationId: string): Promise<void> {
    return this.conversationManager.loadConversation(conversationId);
  }

  public async deleteConversation(conversationId: string): Promise<void> {
    return this.conversationManager.deleteConversation(conversationId);
  }

  public async toggleBookmark(messageId: string): Promise<void> {
    return this.conversationManager.toggleBookmark(messageId);
  }

  public async togglePin(messageId: string): Promise<void> {
    return this.conversationManager.togglePin(messageId);
  }

  /**
   * Cancel the current in-flight request and reject all pending tool approvals.
   * Resets the UI status to idle.
   */
  public cancelRequest(): void {
    this.claudeService.cancel();
    this.toolCoordinator.rejectAllPending();

    this.postMessage({
      type: 'statusUpdate',
      payload: { status: 'idle' },
    });
  }

  /**
   * Dispose all resources: stops auto-save, rejects pending tool promises,
   * and performs a final save. Must be called when the panel closes.
   */
  public dispose(): void {
    this.conversationManager.dispose();
    this.toolCoordinator.rejectAllPending();
  }
}
