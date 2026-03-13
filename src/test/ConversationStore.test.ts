// ===================================================
// ConversationStore — Unit Tests
// ===================================================
// Tests for conversation CRUD, search, limits,
// message management, and active conversation tracking.
// ===================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { ConversationStore } from '../extension/services/ConversationStore';
import { createMockExtensionContext, mockGlobalState } from './__mocks__/vscode';
import type { ChatMessage, Conversation } from '../shared/types';

// =================================================
// Tests
// =================================================

describe('ConversationStore', () => {
  let store: ConversationStore;
  let mockContext: ReturnType<typeof createMockExtensionContext>;

  beforeEach(() => {
    // Clear stored data between tests
    mockGlobalState._clear();
    mockContext = createMockExtensionContext();
    store = new ConversationStore(mockContext as unknown as import('vscode').ExtensionContext);
  });

  // -------------------------------------------------
  // create
  // -------------------------------------------------
  describe('create', () => {
    it('should create a new conversation', async () => {
      const conv = await store.create('project-1', 'developer');

      expect(conv).toBeDefined();
      expect(conv.id).toBeTruthy();
      expect(conv.projectId).toBe('project-1');
      expect(conv.agentId).toBe('developer');
      expect(conv.messages).toEqual([]);
      expect(conv.totalTokens).toBe(0);
      expect(conv.estimatedCost).toBe(0);
    });

    it('should set default title to Hebrew new conversation', async () => {
      const conv = await store.create('project-1', 'developer');
      expect(conv.title).toContain('שיחה חדשה');
    });

    it('should set createdAt and updatedAt timestamps', async () => {
      const before = new Date().toISOString();
      const conv = await store.create('project-1', 'developer');
      const after = new Date().toISOString();

      expect(conv.createdAt >= before).toBe(true);
      expect(conv.createdAt <= after).toBe(true);
      expect(conv.updatedAt >= before).toBe(true);
    });

    it('should generate unique IDs', async () => {
      const conv1 = await store.create('project-1', 'developer');
      const conv2 = await store.create('project-1', 'developer');

      expect(conv1.id).not.toBe(conv2.id);
    });

    it('should set the created conversation as active', async () => {
      const conv = await store.create('project-1', 'developer');
      expect(store.getActiveId()).toBe(conv.id);
    });

    it('should persist the conversation to storage', async () => {
      await store.create('project-1', 'developer');
      const all = store.getAll();
      expect(all).toHaveLength(1);
    });
  });

  // -------------------------------------------------
  // getAll
  // -------------------------------------------------
  describe('getAll', () => {
    it('should return empty array when no conversations exist', () => {
      const all = store.getAll();
      expect(all).toEqual([]);
    });

    it('should return all stored conversations', async () => {
      await store.create('project-1', 'developer');
      await store.create('project-2', 'architect');
      await store.create('project-1', 'qa');

      const all = store.getAll();
      expect(all).toHaveLength(3);
    });
  });

  // -------------------------------------------------
  // get
  // -------------------------------------------------
  describe('get', () => {
    it('should return a conversation by ID', async () => {
      const conv = await store.create('project-1', 'developer');
      const found = store.get(conv.id);

      expect(found).toBeDefined();
      expect(found!.id).toBe(conv.id);
    });

    it('should return undefined for non-existent ID', () => {
      const found = store.get('non-existent-id');
      expect(found).toBeUndefined();
    });
  });

  // -------------------------------------------------
  // getByProject
  // -------------------------------------------------
  describe('getByProject', () => {
    it('should filter conversations by project ID', async () => {
      await store.create('project-1', 'developer');
      await store.create('project-1', 'architect');
      await store.create('project-2', 'developer');

      const proj1 = store.getByProject('project-1');
      expect(proj1).toHaveLength(2);

      const proj2 = store.getByProject('project-2');
      expect(proj2).toHaveLength(1);
    });

    it('should return empty array for unknown project', () => {
      const result = store.getByProject('unknown');
      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------
  // getByProjectAndAgent
  // -------------------------------------------------
  describe('getByProjectAndAgent', () => {
    it('should filter by both project and agent', async () => {
      await store.create('project-1', 'developer');
      await store.create('project-1', 'architect');
      await store.create('project-1', 'developer');

      const result = store.getByProjectAndAgent('project-1', 'developer');
      expect(result).toHaveLength(2);
    });
  });

  // -------------------------------------------------
  // addMessage
  // -------------------------------------------------
  describe('addMessage', () => {
    it('should add a message to a conversation', async () => {
      const conv = await store.create('project-1', 'developer');
      const message: ChatMessage = {
        id: 'msg-1',
        role: 'user',
        content: 'Hello, world!',
        timestamp: new Date().toISOString(),
      };

      await store.addMessage(conv.id, message);

      const updated = store.get(conv.id);
      expect(updated!.messages).toHaveLength(1);
      expect(updated!.messages[0].content).toBe('Hello, world!');
    });

    it('should update the conversation title from first user message', async () => {
      const conv = await store.create('project-1', 'developer');
      const message: ChatMessage = {
        id: 'msg-1',
        role: 'user',
        content: 'How do I implement a binary search tree?',
        timestamp: new Date().toISOString(),
      };

      await store.addMessage(conv.id, message);

      const updated = store.get(conv.id);
      expect(updated!.title).toContain('How do I implement a binary search tree?');
    });

    it('should truncate long titles to 50 chars plus ellipsis', async () => {
      const conv = await store.create('project-1', 'developer');
      const longContent = 'A'.repeat(100);
      const message: ChatMessage = {
        id: 'msg-1',
        role: 'user',
        content: longContent,
        timestamp: new Date().toISOString(),
      };

      await store.addMessage(conv.id, message);

      const updated = store.get(conv.id);
      expect(updated!.title.length).toBeLessThanOrEqual(53); // 50 + "..."
      expect(updated!.title.endsWith('...')).toBe(true);
    });

    it('should NOT update title from assistant messages', async () => {
      const conv = await store.create('project-1', 'developer');
      const message: ChatMessage = {
        id: 'msg-1',
        role: 'assistant',
        content: 'I can help with that',
        timestamp: new Date().toISOString(),
      };

      await store.addMessage(conv.id, message);

      const updated = store.get(conv.id);
      expect(updated!.title).toContain('שיחה חדשה');
    });

    it('should accumulate token counts', async () => {
      const conv = await store.create('project-1', 'developer');

      await store.addMessage(conv.id, {
        id: 'msg-1',
        role: 'user',
        content: 'Hello',
        timestamp: new Date().toISOString(),
        tokenCount: 100,
      });

      await store.addMessage(conv.id, {
        id: 'msg-2',
        role: 'assistant',
        content: 'Hi there',
        timestamp: new Date().toISOString(),
        tokenCount: 200,
      });

      const updated = store.get(conv.id);
      expect(updated!.totalTokens).toBe(300);
    });

    it('should update the updatedAt timestamp', async () => {
      const conv = await store.create('project-1', 'developer');
      const originalUpdatedAt = conv.updatedAt;

      // Small delay to ensure different timestamp
      await new Promise((r) => setTimeout(r, 10));

      await store.addMessage(conv.id, {
        id: 'msg-1',
        role: 'user',
        content: 'Hello',
        timestamp: new Date().toISOString(),
      });

      const updated = store.get(conv.id);
      expect(updated!.updatedAt >= originalUpdatedAt).toBe(true);
    });

    it('should silently ignore non-existent conversation ID', async () => {
      // Should not throw
      await store.addMessage('non-existent', {
        id: 'msg-1',
        role: 'user',
        content: 'Hello',
        timestamp: new Date().toISOString(),
      });
    });

    it('should preserve message ordering', async () => {
      const conv = await store.create('project-1', 'developer');

      for (let i = 0; i < 5; i++) {
        await store.addMessage(conv.id, {
          id: `msg-${i}`,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}`,
          timestamp: new Date().toISOString(),
        });
      }

      const updated = store.get(conv.id);
      for (let i = 0; i < 5; i++) {
        expect(updated!.messages[i].content).toBe(`Message ${i}`);
        expect(updated!.messages[i].id).toBe(`msg-${i}`);
      }
    });
  });

  // -------------------------------------------------
  // updateMessage
  // -------------------------------------------------
  describe('updateMessage', () => {
    it('should update fields on an existing message', async () => {
      const conv = await store.create('project-1', 'developer');
      await store.addMessage(conv.id, {
        id: 'msg-1',
        role: 'assistant',
        content: 'Initial content',
        timestamp: new Date().toISOString(),
        isStreaming: true,
      });

      await store.updateMessage(conv.id, 'msg-1', {
        content: 'Updated content',
        isStreaming: false,
        tokenCount: 150,
      });

      const updated = store.get(conv.id);
      expect(updated!.messages[0].content).toBe('Updated content');
      expect(updated!.messages[0].isStreaming).toBe(false);
      expect(updated!.messages[0].tokenCount).toBe(150);
    });

    it('should silently ignore non-existent message ID', async () => {
      const conv = await store.create('project-1', 'developer');
      // Should not throw
      await store.updateMessage(conv.id, 'non-existent-msg', { content: 'x' });
    });
  });

  // -------------------------------------------------
  // delete
  // -------------------------------------------------
  describe('delete', () => {
    it('should remove a conversation', async () => {
      const conv = await store.create('project-1', 'developer');
      expect(store.getAll()).toHaveLength(1);

      await store.delete(conv.id);
      expect(store.getAll()).toHaveLength(0);
    });

    it('should clear active ID when deleting active conversation', async () => {
      const conv = await store.create('project-1', 'developer');
      expect(store.getActiveId()).toBe(conv.id);

      await store.delete(conv.id);
      expect(store.getActiveId()).toBeNull();
    });

    it('should NOT clear active ID when deleting a different conversation', async () => {
      const conv1 = await store.create('project-1', 'developer');
      const conv2 = await store.create('project-1', 'architect');
      // conv2 is now active
      expect(store.getActiveId()).toBe(conv2.id);

      await store.delete(conv1.id);
      expect(store.getActiveId()).toBe(conv2.id);
    });
  });

  // -------------------------------------------------
  // deleteByProject
  // -------------------------------------------------
  describe('deleteByProject', () => {
    it('should remove all conversations for a project', async () => {
      await store.create('project-1', 'developer');
      await store.create('project-1', 'architect');
      await store.create('project-2', 'developer');

      await store.deleteByProject('project-1');

      const all = store.getAll();
      expect(all).toHaveLength(1);
      expect(all[0].projectId).toBe('project-2');
    });
  });

  // -------------------------------------------------
  // setActive / getActive / getActiveId
  // -------------------------------------------------
  describe('active conversation', () => {
    it('should set and get active conversation', async () => {
      const conv = await store.create('project-1', 'developer');
      store.setActive(conv.id);

      expect(store.getActiveId()).toBe(conv.id);
      expect(store.getActive()?.id).toBe(conv.id);
    });

    it('should return undefined when no active conversation', () => {
      store.setActive(null);
      expect(store.getActive()).toBeUndefined();
      expect(store.getActiveId()).toBeNull();
    });
  });

  // -------------------------------------------------
  // clearMessages
  // -------------------------------------------------
  describe('clearMessages', () => {
    it('should remove all messages from a conversation', async () => {
      const conv = await store.create('project-1', 'developer');
      await store.addMessage(conv.id, {
        id: 'msg-1',
        role: 'user',
        content: 'Hello',
        timestamp: new Date().toISOString(),
      });
      await store.addMessage(conv.id, {
        id: 'msg-2',
        role: 'assistant',
        content: 'Hi',
        timestamp: new Date().toISOString(),
      });

      expect(store.get(conv.id)!.messages).toHaveLength(2);

      await store.clearMessages(conv.id);

      expect(store.get(conv.id)!.messages).toHaveLength(0);
    });
  });

  // -------------------------------------------------
  // search
  // -------------------------------------------------
  describe('search', () => {
    it('should find messages matching a query', async () => {
      const conv = await store.create('project-1', 'developer');
      await store.addMessage(conv.id, {
        id: 'msg-1',
        role: 'user',
        content: 'How to implement binary search?',
        timestamp: new Date().toISOString(),
      });
      await store.addMessage(conv.id, {
        id: 'msg-2',
        role: 'assistant',
        content: 'Binary search works by dividing the array in half.',
        timestamp: new Date().toISOString(),
      });
      await store.addMessage(conv.id, {
        id: 'msg-3',
        role: 'user',
        content: 'What about sorting?',
        timestamp: new Date().toISOString(),
      });

      const results = store.search('binary');
      expect(results).toHaveLength(2);
    });

    it('should be case-insensitive', async () => {
      const conv = await store.create('project-1', 'developer');
      await store.addMessage(conv.id, {
        id: 'msg-1',
        role: 'user',
        content: 'TypeScript is great',
        timestamp: new Date().toISOString(),
      });

      const results = store.search('typescript');
      expect(results).toHaveLength(1);

      const results2 = store.search('TYPESCRIPT');
      expect(results2).toHaveLength(1);
    });

    it('should filter by project when projectId is provided', async () => {
      const conv1 = await store.create('project-1', 'developer');
      await store.addMessage(conv1.id, {
        id: 'msg-1',
        role: 'user',
        content: 'Hello from project 1',
        timestamp: new Date().toISOString(),
      });

      const conv2 = await store.create('project-2', 'developer');
      await store.addMessage(conv2.id, {
        id: 'msg-2',
        role: 'user',
        content: 'Hello from project 2',
        timestamp: new Date().toISOString(),
      });

      const all = store.search('Hello');
      expect(all).toHaveLength(2);

      const proj1Only = store.search('Hello', 'project-1');
      expect(proj1Only).toHaveLength(1);
      expect(proj1Only[0].content).toContain('project 1');
    });

    it('should return empty array when no matches', () => {
      const results = store.search('nonexistent query');
      expect(results).toEqual([]);
    });

    it('should search across multiple conversations', async () => {
      const conv1 = await store.create('project-1', 'developer');
      await store.addMessage(conv1.id, {
        id: 'msg-1',
        role: 'user',
        content: 'React hooks are useful',
        timestamp: new Date().toISOString(),
      });

      const conv2 = await store.create('project-1', 'architect');
      await store.addMessage(conv2.id, {
        id: 'msg-2',
        role: 'user',
        content: 'React components design',
        timestamp: new Date().toISOString(),
      });

      const results = store.search('React');
      expect(results).toHaveLength(2);
    });
  });

  // -------------------------------------------------
  // Conversation limits
  // -------------------------------------------------
  describe('conversation limits', () => {
    it('should enforce MAX_CONVERSATIONS by removing oldest', async () => {
      // Create conversations up to the limit (200 is too many for a unit test,
      // so we test the mechanism by checking the pruning behavior).
      // We mock a scenario where the store already has conversations at the limit.
      const conversations: Conversation[] = [];
      for (let i = 0; i < 200; i++) {
        conversations.push({
          id: `conv-${i}`,
          projectId: 'project-1',
          agentId: 'developer',
          title: `Conversation ${i}`,
          messages: [],
          createdAt: new Date(2024, 0, 1, 0, i).toISOString(),
          updatedAt: new Date(2024, 0, 1, 0, i).toISOString(),
          totalTokens: 0,
          estimatedCost: 0,
        });
      }

      // Pre-fill the store
      await mockGlobalState.update('tsAiTool.conversations', conversations);

      // Now create one more — should remove the oldest
      const newConv = await store.create('project-1', 'developer');

      const all = store.getAll();
      // Should still be 200 (removed oldest, added new)
      expect(all).toHaveLength(200);
      // The oldest (conv-0) should have been removed
      expect(all.find((c) => c.id === 'conv-0')).toBeUndefined();
      // The new one should exist
      expect(all.find((c) => c.id === newConv.id)).toBeDefined();
    });
  });
});
