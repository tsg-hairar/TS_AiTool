// ===================================================
// ConversationStore Improvements — Unit Tests
// ===================================================
// Additional tests for parallel I/O, migration logic,
// draft management, session state, and error handling.
// These complement the existing ConversationStore.test.ts.
// ===================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConversationStore } from '../extension/services/ConversationStore';
import { createMockExtensionContext, mockGlobalState } from './__mocks__/vscode';
import type { Conversation, SessionState } from '../shared/types';

// =================================================
// Tests
// =================================================

describe('ConversationStore — Improvements', () => {
  let store: ConversationStore;
  let mockContext: ReturnType<typeof createMockExtensionContext>;

  beforeEach(() => {
    // Clear stored data between tests
    mockGlobalState._clear();
    mockContext = createMockExtensionContext();
    store = new ConversationStore(mockContext as unknown as import('vscode').ExtensionContext);
  });

  // -------------------------------------------------
  // getAll — returns conversations
  // -------------------------------------------------
  describe('getAll — returns conversations', () => {
    it('should return all stored conversations after creation', async () => {
      await store.create('project-1', 'developer');
      await store.create('project-2', 'architect');

      const all = store.getAll();
      expect(all).toHaveLength(2);
      expect(all[0].projectId).toBe('project-1');
      expect(all[1].projectId).toBe('project-2');
    });

    it('should return conversations with correct structure', async () => {
      await store.create('project-1', 'developer');
      const all = store.getAll();
      const conv = all[0];

      expect(conv).toHaveProperty('id');
      expect(conv).toHaveProperty('projectId');
      expect(conv).toHaveProperty('agentId');
      expect(conv).toHaveProperty('title');
      expect(conv).toHaveProperty('messages');
      expect(conv).toHaveProperty('createdAt');
      expect(conv).toHaveProperty('updatedAt');
      expect(conv).toHaveProperty('totalTokens');
      expect(conv).toHaveProperty('estimatedCost');
    });
  });

  // -------------------------------------------------
  // getAll — returns empty on error
  // -------------------------------------------------
  describe('getAll — returns empty on error', () => {
    it('should return empty array when globalState has no conversations', () => {
      const result = store.getAll();
      expect(result).toEqual([]);
    });

    it('should return empty array when globalState returns undefined', () => {
      // globalState.get returns undefined for missing keys
      const freshContext = createMockExtensionContext();
      const freshStore = new ConversationStore(freshContext as unknown as import('vscode').ExtensionContext);
      expect(freshStore.getAll()).toEqual([]);
    });
  });

  // -------------------------------------------------
  // delete — parallel cleanup
  // -------------------------------------------------
  describe('delete — parallel cleanup', () => {
    it('should delete conversation and clear its draft in parallel', async () => {
      const conv = await store.create('project-1', 'developer');

      // Save a draft for this conversation
      await store.saveDraft(conv.id, 'my unsent message');
      expect(store.loadDraft(conv.id)).toBe('my unsent message');

      // Delete should clean up both conversation and draft
      await store.delete(conv.id);

      expect(store.getAll()).toHaveLength(0);
      expect(store.loadDraft(conv.id)).toBeUndefined();
    });

    it('should only remove the target conversation when deleting', async () => {
      const conv1 = await store.create('project-1', 'developer');
      const conv2 = await store.create('project-1', 'architect');

      await store.delete(conv1.id);

      const remaining = store.getAll();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe(conv2.id);
    });

    it('should handle deleting non-existent conversation gracefully', async () => {
      await store.create('project-1', 'developer');

      // Should not throw
      await store.delete('non-existent-id');

      // Original conversation should still exist
      expect(store.getAll()).toHaveLength(1);
    });
  });

  // -------------------------------------------------
  // deleteByProject — parallel cleanup of multiple drafts
  // -------------------------------------------------
  describe('deleteByProject — parallel cleanup', () => {
    it('should delete all conversations and drafts for a project', async () => {
      const conv1 = await store.create('project-1', 'developer');
      const conv2 = await store.create('project-1', 'architect');
      const conv3 = await store.create('project-2', 'developer');

      // Save drafts
      await store.saveDraft(conv1.id, 'draft 1');
      await store.saveDraft(conv2.id, 'draft 2');
      await store.saveDraft(conv3.id, 'draft 3');

      await store.deleteByProject('project-1');

      // Only project-2 conversations remain
      const remaining = store.getAll();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].projectId).toBe('project-2');

      // Drafts for project-1 should be cleared
      expect(store.loadDraft(conv1.id)).toBeUndefined();
      expect(store.loadDraft(conv2.id)).toBeUndefined();

      // Draft for project-2 should still exist
      expect(store.loadDraft(conv3.id)).toBe('draft 3');
    });
  });

  // -------------------------------------------------
  // migrateIfNeeded — adds missing fields
  // -------------------------------------------------
  describe('migrateIfNeeded — adds missing fields', () => {
    it('should add missing totalTokens and estimatedCost on migration', () => {
      // Pre-fill with v0 data (missing fields)
      const oldConversations = [
        {
          id: 'conv-old-1',
          projectId: 'project-1',
          agentId: 'developer',
          title: 'Old conversation',
          messages: [
            {
              id: 'msg-1',
              role: 'user',
              content: 'Hello',
              timestamp: '2024-01-01T00:00:00.000Z',
              // missing isPinned and isBookmarked
            },
          ],
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          // missing totalTokens and estimatedCost
        },
      ];

      // Set data without version (simulates v0)
      mockGlobalState._clear();
      mockGlobalState.update('tsAiTool.conversations', oldConversations);
      // Do NOT set dataVersion — triggers migration

      // Create new store — migration should run in constructor
      const migratedStore = new ConversationStore(mockContext as unknown as import('vscode').ExtensionContext);
      const all = migratedStore.getAll();

      expect(all).toHaveLength(1);
      expect(all[0].totalTokens).toBe(0);
      expect(all[0].estimatedCost).toBe(0);

      // Messages should have isPinned and isBookmarked defaults
      expect(all[0].messages[0].isPinned).toBe(false);
      expect(all[0].messages[0].isBookmarked).toBe(false);
    });

    it('should not re-run migration when data version is current', async () => {
      // Set current version
      await mockGlobalState.update('tsAiTool.dataVersion', 1);

      const conv = {
        id: 'conv-1',
        projectId: 'project-1',
        agentId: 'developer',
        title: 'Existing conversation',
        messages: [],
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        totalTokens: 500,
        estimatedCost: 0.01,
      };
      await mockGlobalState.update('tsAiTool.conversations', [conv]);

      // Create new store — migration should be skipped
      const freshStore = new ConversationStore(mockContext as unknown as import('vscode').ExtensionContext);
      const all = freshStore.getAll();

      expect(all).toHaveLength(1);
      expect(all[0].totalTokens).toBe(500); // preserved, not reset
      expect(all[0].estimatedCost).toBe(0.01);
    });
  });

  // -------------------------------------------------
  // saveDraft / loadDraft / clearDraft — error handling
  // -------------------------------------------------
  describe('saveDraft / loadDraft / clearDraft', () => {
    it('should save and load a draft', async () => {
      const convId = 'conv-draft-1';
      await store.saveDraft(convId, 'Hello, this is a draft');

      const draft = store.loadDraft(convId);
      expect(draft).toBe('Hello, this is a draft');
    });

    it('should return undefined when no draft exists', () => {
      const draft = store.loadDraft('non-existent-conv');
      expect(draft).toBeUndefined();
    });

    it('should clear a saved draft', async () => {
      const convId = 'conv-draft-2';
      await store.saveDraft(convId, 'Some draft text');
      expect(store.loadDraft(convId)).toBe('Some draft text');

      await store.clearDraft(convId);
      expect(store.loadDraft(convId)).toBeUndefined();
    });

    it('should not save empty/whitespace-only drafts', async () => {
      const convId = 'conv-draft-3';
      await store.saveDraft(convId, '   ');
      expect(store.loadDraft(convId)).toBeUndefined();
    });

    it('should overwrite existing draft', async () => {
      const convId = 'conv-draft-4';
      await store.saveDraft(convId, 'First draft');
      await store.saveDraft(convId, 'Updated draft');

      expect(store.loadDraft(convId)).toBe('Updated draft');
    });

    it('should not throw when clearing a non-existent draft', async () => {
      await expect(store.clearDraft('non-existent-conv')).resolves.toBeUndefined();
    });

    it('should handle drafts for multiple conversations independently', async () => {
      await store.saveDraft('conv-a', 'Draft A');
      await store.saveDraft('conv-b', 'Draft B');

      expect(store.loadDraft('conv-a')).toBe('Draft A');
      expect(store.loadDraft('conv-b')).toBe('Draft B');

      await store.clearDraft('conv-a');
      expect(store.loadDraft('conv-a')).toBeUndefined();
      expect(store.loadDraft('conv-b')).toBe('Draft B');
    });
  });

  // -------------------------------------------------
  // saveAllState — parallel save
  // -------------------------------------------------
  describe('saveAllState — parallel save', () => {
    it('should save session state and draft in parallel', async () => {
      const sessionState: SessionState = {
        activeConversationId: 'conv-1',
        activeProjectId: 'project-1',
        activePanel: 'chat',
        activeAgentId: 'developer',
        scrollPosition: 100,
        savedAt: new Date().toISOString(),
        isDirty: false,
      };

      await store.saveAllState(sessionState, {
        conversationId: 'conv-1',
        text: 'My draft message',
      });

      // Verify session state was saved
      const loadedState = store.loadSessionState();
      expect(loadedState).toBeDefined();
      expect(loadedState!.activeConversationId).toBe('conv-1');
      expect(loadedState!.activePanel).toBe('chat');

      // Verify draft was saved
      const draft = store.loadDraft('conv-1');
      expect(draft).toBe('My draft message');
    });

    it('should save session state without draft when no draft provided', async () => {
      const sessionState: SessionState = {
        activeConversationId: null,
        activeProjectId: 'project-1',
        activePanel: 'settings',
        activeAgentId: 'architect',
        scrollPosition: 0,
        savedAt: new Date().toISOString(),
        isDirty: false,
      };

      await store.saveAllState(sessionState);

      const loadedState = store.loadSessionState();
      expect(loadedState).toBeDefined();
      expect(loadedState!.activePanel).toBe('settings');
      expect(loadedState!.activeAgentId).toBe('architect');
    });
  });

  // -------------------------------------------------
  // saveSessionState / loadSessionState / clearSessionState
  // -------------------------------------------------
  describe('session state management', () => {
    it('should save and load session state', async () => {
      const state: SessionState = {
        activeConversationId: 'conv-1',
        activeProjectId: 'project-1',
        activePanel: 'chat',
        activeAgentId: 'developer',
        scrollPosition: 250,
        savedAt: new Date().toISOString(),
        isDirty: false,
      };

      await store.saveSessionState(state);
      const loaded = store.loadSessionState();

      expect(loaded).toBeDefined();
      expect(loaded!.activeConversationId).toBe('conv-1');
      expect(loaded!.scrollPosition).toBe(250);
    });

    it('should return undefined when no session state saved', () => {
      const loaded = store.loadSessionState();
      expect(loaded).toBeUndefined();
    });

    it('should clear session state', async () => {
      const state: SessionState = {
        activeConversationId: 'conv-1',
        activeProjectId: 'project-1',
        activePanel: 'chat',
        activeAgentId: 'developer',
        scrollPosition: 0,
        savedAt: new Date().toISOString(),
        isDirty: false,
      };

      await store.saveSessionState(state);
      expect(store.loadSessionState()).toBeDefined();

      await store.clearSessionState();
      expect(store.loadSessionState()).toBeUndefined();
    });
  });

  // -------------------------------------------------
  // pinMessage / unpinMessage / getPinnedMessages
  // -------------------------------------------------
  describe('pin/unpin messages', () => {
    it('should pin a message and return PinnedMessage info', async () => {
      const conv = await store.create('project-1', 'developer');
      await store.addMessage(conv.id, {
        id: 'msg-1',
        role: 'assistant',
        content: 'This is an important answer that should be pinned for future reference.',
        timestamp: new Date().toISOString(),
      });

      const pinned = await store.pinMessage(conv.id, 'msg-1');

      expect(pinned).not.toBeNull();
      expect(pinned!.messageId).toBe('msg-1');
      expect(pinned!.preview).toContain('important answer');
      expect(pinned!.pinnedAt).toBeTruthy();
    });

    it('should unpin a previously pinned message', async () => {
      const conv = await store.create('project-1', 'developer');
      await store.addMessage(conv.id, {
        id: 'msg-1',
        role: 'assistant',
        content: 'Pinned content',
        timestamp: new Date().toISOString(),
      });

      await store.pinMessage(conv.id, 'msg-1');
      let pinnedList = store.getPinnedMessages(conv.id);
      expect(pinnedList).toHaveLength(1);

      await store.unpinMessage(conv.id, 'msg-1');
      pinnedList = store.getPinnedMessages(conv.id);
      expect(pinnedList).toHaveLength(0);
    });

    it('should return null when pinning non-existent message', async () => {
      const conv = await store.create('project-1', 'developer');
      const result = await store.pinMessage(conv.id, 'non-existent-msg');
      expect(result).toBeNull();
    });

    it('should return null when pinning in non-existent conversation', async () => {
      const result = await store.pinMessage('non-existent-conv', 'msg-1');
      expect(result).toBeNull();
    });

    it('should return empty array for getPinnedMessages when no pins', async () => {
      const conv = await store.create('project-1', 'developer');
      const pinned = store.getPinnedMessages(conv.id);
      expect(pinned).toEqual([]);
    });
  });
});
