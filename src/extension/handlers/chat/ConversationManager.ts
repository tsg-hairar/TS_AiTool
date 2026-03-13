// ===================================================
// ConversationManager — conversation lifecycle
// ===================================================
// Extracted from ChatHandler to manage conversation
// CRUD, auto-save, drafts, bookmarks, and pins.
// ===================================================

import type { ExtensionToWebviewMessage } from '../../../shared/messages';
import type { AgentId } from '../../../shared/types';
import { ConversationStore } from '../../services/ConversationStore';

export class ConversationManager {
  // --- Auto-save state ---
  private isDirty = false;
  private autoSaveTimer: ReturnType<typeof setInterval> | null = null;
  private draftSaveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly conversationStore: ConversationStore,
    private readonly postMessage: (msg: ExtensionToWebviewMessage) => void,
    private readonly getContext: () => { projectId: string | null; agentId: AgentId },
  ) {
    this.startAutoSave();
  }

  // -------------------------------------------------
  // markDirty — flag unsaved changes
  // -------------------------------------------------
  public markDirty(): void {
    this.isDirty = true;
  }

  // -------------------------------------------------
  // startAutoSave — auto-save every 30 seconds
  // -------------------------------------------------
  private startAutoSave(): void {
    this.autoSaveTimer = setInterval(() => {
      this.autoSaveConversation();
    }, 30_000);
  }

  // -------------------------------------------------
  // stopAutoSave — stop auto-save (on dispose)
  // -------------------------------------------------
  public stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
    if (this.draftSaveTimer) {
      clearTimeout(this.draftSaveTimer);
      this.draftSaveTimer = null;
    }
  }

  // -------------------------------------------------
  // autoSaveConversation — save conversation if dirty
  // -------------------------------------------------
  public async autoSaveConversation(): Promise<void> {
    if (!this.isDirty) return;

    const activeId = this.conversationStore.getActiveId();
    if (!activeId) return;

    const { projectId, agentId } = this.getContext();
    const now = new Date().toISOString();

    await this.conversationStore.saveSessionState({
      activeConversationId: activeId,
      activeProjectId: projectId,
      activePanel: 'chat',
      activeAgentId: agentId,
      scrollPosition: 0,
      savedAt: now,
      isDirty: false,
    });

    this.isDirty = false;

    this.postMessage({
      type: 'autoSaveStatus',
      payload: { saved: true, timestamp: now },
    });
  }

  // -------------------------------------------------
  // saveDraft — save draft message (debounced 3 seconds)
  // -------------------------------------------------
  public saveDraft(conversationId: string, text: string): void {
    if (this.draftSaveTimer) {
      clearTimeout(this.draftSaveTimer);
    }

    this.draftSaveTimer = setTimeout(async () => {
      await this.conversationStore.saveDraft(conversationId, text);
    }, 3_000);
  }

  // -------------------------------------------------
  // loadDraft — load a saved draft
  // -------------------------------------------------
  public loadDraft(conversationId: string): void {
    const draft = this.conversationStore.loadDraft(conversationId);
    this.postMessage({
      type: 'draftLoaded',
      payload: { conversationId, text: draft ?? '' },
    });
  }

  // -------------------------------------------------
  // newChat — create a new conversation
  // -------------------------------------------------
  public async newChat(): Promise<void> {
    const { projectId, agentId } = this.getContext();
    if (projectId) {
      await this.conversationStore.create(projectId, agentId);
    }
    this.postMessage({ type: 'chatCleared' });
  }

  // -------------------------------------------------
  // clearChat — clear the active conversation
  // -------------------------------------------------
  public async clearChat(): Promise<void> {
    const activeId = this.conversationStore.getActiveId();
    if (activeId) {
      await this.conversationStore.clearMessages(activeId);
    }
    this.postMessage({ type: 'chatCleared' });
  }

  // -------------------------------------------------
  // loadLastConversation — load the most recent conversation
  // -------------------------------------------------
  public loadLastConversation(): void {
    const { projectId, agentId } = this.getContext();
    if (!projectId) return;

    const conversations = this.conversationStore.getByProjectAndAgent(
      projectId,
      agentId,
    );

    if (conversations.length === 0) return;

    const latest = conversations.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )[0];

    if (!latest.messages || latest.messages.length === 0) return;

    this.conversationStore.setActive(latest.id);
    this.postMessage({ type: 'conversationLoaded', payload: latest });

    const allProjectConversations = this.conversationStore.getByProject(projectId);
    this.postMessage({ type: 'conversationList', payload: allProjectConversations });
  }

  // -------------------------------------------------
  // loadConversation — load a specific conversation
  // -------------------------------------------------
  public async loadConversation(conversationId: string): Promise<void> {
    const conversation = this.conversationStore.get(conversationId);
    if (conversation) {
      this.conversationStore.setActive(conversationId);
      this.postMessage({ type: 'conversationLoaded', payload: conversation });
    }
  }

  // -------------------------------------------------
  // deleteConversation — delete a conversation
  // -------------------------------------------------
  public async deleteConversation(conversationId: string): Promise<void> {
    await this.conversationStore.delete(conversationId);
  }

  // -------------------------------------------------
  // toggleBookmark — toggle bookmark on a message
  // -------------------------------------------------
  public async toggleBookmark(messageId: string): Promise<void> {
    const activeId = this.conversationStore.getActiveId();
    if (!activeId) return;

    const conversation = this.conversationStore.get(activeId);
    const message = conversation?.messages.find((m) => m.id === messageId);
    if (!message) return;

    await this.conversationStore.updateMessage(activeId, messageId, {
      isBookmarked: !message.isBookmarked,
    });

    this.postMessage({
      type: 'updateMessage',
      payload: { id: messageId, updates: { isBookmarked: !message.isBookmarked } },
    });
  }

  // -------------------------------------------------
  // togglePin — toggle pin on a message
  // -------------------------------------------------
  public async togglePin(messageId: string): Promise<void> {
    const activeId = this.conversationStore.getActiveId();
    if (!activeId) return;

    const conversation = this.conversationStore.get(activeId);
    const message = conversation?.messages.find((m) => m.id === messageId);
    if (!message) return;

    await this.conversationStore.updateMessage(activeId, messageId, {
      isPinned: !message.isPinned,
    });

    this.postMessage({
      type: 'updateMessage',
      payload: { id: messageId, updates: { isPinned: !message.isPinned } },
    });
  }

  // -------------------------------------------------
  // dispose — clean up resources
  // -------------------------------------------------
  public dispose(): void {
    this.stopAutoSave();
    this.autoSaveConversation();
  }
}
