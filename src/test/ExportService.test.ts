// ===================================================
// ExportService — Unit Tests
// ===================================================
// Tests for Markdown, HTML, JSON, and plain text
// export formats for conversations.
// ===================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { ExportService } from '../extension/services/ExportService';
import type { Conversation, ChatMessage } from '../shared/types';

// -------------------------------------------------
// Helper: create a test conversation
// -------------------------------------------------
function createTestConversation(overrides?: Partial<Conversation>): Conversation {
  return {
    id: 'conv-test-1',
    projectId: 'project-1',
    agentId: 'developer',
    title: 'Test Conversation',
    messages: [
      {
        id: 'msg-1',
        role: 'user',
        content: 'How do I create a React component?',
        timestamp: '2024-06-15T10:30:00.000Z',
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: 'Here is a simple React component:\n\n```tsx\nfunction Hello() {\n  return <h1>Hello</h1>;\n}\n```\n\nYou can use it like `<Hello />`.',
        timestamp: '2024-06-15T10:30:15.000Z',
        agentId: 'developer',
        tokenCount: 150,
        toolUses: [
          {
            id: 'tool-1',
            name: 'read_file',
            input: { file_path: 'src/App.tsx' },
            output: 'file content',
            status: 'completed',
          },
        ],
      },
    ],
    createdAt: '2024-06-15T10:29:00.000Z',
    updatedAt: '2024-06-15T10:30:15.000Z',
    totalTokens: 250,
    estimatedCost: 0.005,
    ...overrides,
  };
}

function createEmptyConversation(): Conversation {
  return {
    id: 'conv-empty',
    projectId: 'project-1',
    agentId: 'developer',
    title: 'Empty Conversation',
    messages: [],
    createdAt: '2024-06-15T10:00:00.000Z',
    updatedAt: '2024-06-15T10:00:00.000Z',
    totalTokens: 0,
    estimatedCost: 0,
  };
}

// =================================================
// Tests
// =================================================

describe('ExportService', () => {
  let service: ExportService;

  beforeEach(() => {
    service = new ExportService();
  });

  // -------------------------------------------------
  // toMarkdown
  // -------------------------------------------------
  describe('toMarkdown', () => {
    it('should include the conversation title as H1', () => {
      const conv = createTestConversation();
      const md = service.toMarkdown(conv);
      expect(md).toContain('# Test Conversation');
    });

    it('should include creation date', () => {
      const conv = createTestConversation();
      const md = service.toMarkdown(conv);
      expect(md).toContain('תאריך');
    });

    it('should include agent ID', () => {
      const conv = createTestConversation();
      const md = service.toMarkdown(conv);
      expect(md).toContain('developer');
    });

    it('should include token count when > 0', () => {
      const conv = createTestConversation({ totalTokens: 500 });
      const md = service.toMarkdown(conv);
      expect(md).toContain('טוקנים');
      expect(md).toContain('500');
    });

    it('should NOT include token count when 0', () => {
      const conv = createTestConversation({ totalTokens: 0 });
      const md = service.toMarkdown(conv);
      expect(md).not.toContain('טוקנים');
    });

    it('should include project name when provided', () => {
      const conv = createTestConversation();
      const md = service.toMarkdown(conv, 'My Project');
      expect(md).toContain('My Project');
      expect(md).toContain('פרויקט');
    });

    it('should NOT include project name when not provided', () => {
      const conv = createTestConversation();
      const md = service.toMarkdown(conv);
      expect(md).not.toContain('פרויקט');
    });

    it('should include user messages with user label', () => {
      const conv = createTestConversation();
      const md = service.toMarkdown(conv);
      expect(md).toContain('משתמש');
    });

    it('should include assistant messages with assistant label', () => {
      const conv = createTestConversation();
      const md = service.toMarkdown(conv);
      expect(md).toContain('עוזר');
    });

    it('should skip system messages', () => {
      const conv = createTestConversation({
        messages: [
          {
            id: 'sys-1',
            role: 'system',
            content: 'You are a helpful assistant',
            timestamp: '2024-06-15T10:00:00.000Z',
          },
          {
            id: 'msg-1',
            role: 'user',
            content: 'Hello',
            timestamp: '2024-06-15T10:01:00.000Z',
          },
        ],
      });
      const md = service.toMarkdown(conv);
      expect(md).not.toContain('You are a helpful assistant');
      expect(md).toContain('Hello');
    });

    it('should include message content with code blocks preserved', () => {
      const conv = createTestConversation();
      const md = service.toMarkdown(conv);
      expect(md).toContain('```tsx');
      expect(md).toContain('function Hello()');
    });

    it('should include tool uses when present', () => {
      const conv = createTestConversation();
      const md = service.toMarkdown(conv);
      expect(md).toContain('כלים שהופעלו');
      expect(md).toContain('read_file');
    });

    it('should include separator lines between messages', () => {
      const conv = createTestConversation();
      const md = service.toMarkdown(conv);
      expect(md).toContain('---');
    });

    it('should include footer', () => {
      const conv = createTestConversation();
      const md = service.toMarkdown(conv);
      expect(md).toContain('TS AiTool');
    });

    it('should handle empty conversation', () => {
      const conv = createEmptyConversation();
      const md = service.toMarkdown(conv);
      expect(md).toContain('# Empty Conversation');
      // Should still have header but no messages
      expect(md).toContain('---');
    });
  });

  // -------------------------------------------------
  // toHTML
  // -------------------------------------------------
  describe('toHTML', () => {
    it('should produce valid HTML document', () => {
      const conv = createTestConversation();
      const html = service.toHTML(conv);
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html');
      expect(html).toContain('</html>');
    });

    it('should set RTL direction', () => {
      const conv = createTestConversation();
      const html = service.toHTML(conv);
      expect(html).toContain('dir="rtl"');
      expect(html).toContain('lang="he"');
    });

    it('should include the title in <title> tag', () => {
      const conv = createTestConversation();
      const html = service.toHTML(conv);
      expect(html).toContain('<title>Test Conversation</title>');
    });

    it('should include the title in H1', () => {
      const conv = createTestConversation();
      const html = service.toHTML(conv);
      expect(html).toContain('<h1>Test Conversation</h1>');
    });

    it('should include CSS styles', () => {
      const conv = createTestConversation();
      const html = service.toHTML(conv);
      expect(html).toContain('<style>');
      expect(html).toContain('</style>');
    });

    it('should include message count', () => {
      const conv = createTestConversation();
      const html = service.toHTML(conv);
      expect(html).toContain('2'); // 2 non-system messages
      expect(html).toContain('הודעות');
    });

    it('should escape HTML in content', () => {
      const conv = createTestConversation({
        title: 'Test <script>alert("xss")</script>',
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            content: '<b>Bold</b> & "quoted"',
            timestamp: '2024-06-15T10:30:00.000Z',
          },
        ],
      });
      const html = service.toHTML(conv);
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
      expect(html).toContain('&amp;');
    });

    it('should include user and assistant message sections', () => {
      const conv = createTestConversation();
      const html = service.toHTML(conv);
      expect(html).toContain('class="message user"');
      expect(html).toContain('class="message assistant"');
    });

    it('should convert code blocks to pre/code tags', () => {
      const conv = createTestConversation();
      const html = service.toHTML(conv);
      expect(html).toContain('<pre');
      expect(html).toContain('<code>');
    });

    it('should convert inline code to code tags', () => {
      const conv = createTestConversation();
      const html = service.toHTML(conv);
      // The content has `<Hello />` which should be in a code tag
      expect(html).toContain('<code>');
    });

    it('should include token count in meta when > 0', () => {
      const conv = createTestConversation({ totalTokens: 1000 });
      const html = service.toHTML(conv);
      expect(html).toContain('טוקנים');
    });

    it('should include project name when provided', () => {
      const conv = createTestConversation();
      const html = service.toHTML(conv, 'My Project');
      expect(html).toContain('My Project');
    });

    it('should include tool uses when present', () => {
      const conv = createTestConversation();
      const html = service.toHTML(conv);
      expect(html).toContain('read_file');
      expect(html).toContain('class="tools"');
    });

    it('should include footer', () => {
      const conv = createTestConversation();
      const html = service.toHTML(conv);
      expect(html).toContain('class="footer"');
      expect(html).toContain('TS AiTool');
    });

    it('should skip system messages', () => {
      const conv = createTestConversation({
        messages: [
          { id: 's1', role: 'system', content: 'system prompt', timestamp: '2024-06-15T10:00:00Z' },
          { id: 'm1', role: 'user', content: 'visible message', timestamp: '2024-06-15T10:01:00Z' },
        ],
      });
      const html = service.toHTML(conv);
      expect(html).not.toContain('system prompt');
      expect(html).toContain('visible message');
    });

    it('should handle empty conversation', () => {
      const conv = createEmptyConversation();
      const html = service.toHTML(conv);
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('Empty Conversation');
    });
  });

  // -------------------------------------------------
  // toJSON
  // -------------------------------------------------
  describe('toJSON', () => {
    it('should produce valid JSON', () => {
      const conv = createTestConversation();
      const jsonStr = service.toJSON(conv);
      expect(() => JSON.parse(jsonStr)).not.toThrow();
    });

    it('should include exportedBy field', () => {
      const conv = createTestConversation();
      const data = JSON.parse(service.toJSON(conv));
      expect(data.exportedBy).toBe('TS AiTool');
    });

    it('should include exportedAt timestamp', () => {
      const conv = createTestConversation();
      const data = JSON.parse(service.toJSON(conv));
      expect(data.exportedAt).toBeTruthy();
      // Should be a valid ISO date
      expect(() => new Date(data.exportedAt)).not.toThrow();
    });

    it('should include conversation ID and title', () => {
      const conv = createTestConversation();
      const data = JSON.parse(service.toJSON(conv));
      expect(data.conversation.id).toBe('conv-test-1');
      expect(data.conversation.title).toBe('Test Conversation');
    });

    it('should include all conversation metadata', () => {
      const conv = createTestConversation();
      const data = JSON.parse(service.toJSON(conv));
      const c = data.conversation;

      expect(c.agentId).toBe('developer');
      expect(c.projectId).toBe('project-1');
      expect(c.createdAt).toBe('2024-06-15T10:29:00.000Z');
      expect(c.totalTokens).toBe(250);
      expect(c.estimatedCost).toBe(0.005);
    });

    it('should include message count', () => {
      const conv = createTestConversation();
      const data = JSON.parse(service.toJSON(conv));
      expect(data.conversation.messageCount).toBe(2);
    });

    it('should include messages with all fields', () => {
      const conv = createTestConversation();
      const data = JSON.parse(service.toJSON(conv));
      const messages = data.conversation.messages;

      expect(messages).toHaveLength(2);
      expect(messages[0].id).toBe('msg-1');
      expect(messages[0].role).toBe('user');
      expect(messages[0].content).toContain('React component');
      expect(messages[1].id).toBe('msg-2');
      expect(messages[1].role).toBe('assistant');
      expect(messages[1].tokenCount).toBe(150);
    });

    it('should include tool uses in messages', () => {
      const conv = createTestConversation();
      const data = JSON.parse(service.toJSON(conv));
      const tools = data.conversation.messages[1].toolUses;

      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('read_file');
      expect(tools[0].status).toBe('completed');
      expect(tools[0].input.file_path).toBe('src/App.tsx');
    });

    it('should handle empty conversation', () => {
      const conv = createEmptyConversation();
      const data = JSON.parse(service.toJSON(conv));
      expect(data.conversation.messageCount).toBe(0);
      expect(data.conversation.messages).toEqual([]);
    });

    it('should be pretty-printed with 2-space indentation', () => {
      const conv = createTestConversation();
      const jsonStr = service.toJSON(conv);
      // Pretty-printed JSON has newlines and indentation
      expect(jsonStr).toContain('\n');
      expect(jsonStr).toContain('  ');
    });
  });

  // -------------------------------------------------
  // toPlainText
  // -------------------------------------------------
  describe('toPlainText', () => {
    it('should include conversation title', () => {
      const conv = createTestConversation();
      const text = service.toPlainText(conv);
      expect(text).toContain('Test Conversation');
    });

    it('should include date', () => {
      const conv = createTestConversation();
      const text = service.toPlainText(conv);
      expect(text).toContain('תאריך');
    });

    it('should include agent ID', () => {
      const conv = createTestConversation();
      const text = service.toPlainText(conv);
      expect(text).toContain('developer');
    });

    it('should include project name when provided', () => {
      const conv = createTestConversation();
      const text = service.toPlainText(conv, 'My Project');
      expect(text).toContain('My Project');
      expect(text).toContain('פרויקט');
    });

    it('should label user messages as "משתמש"', () => {
      const conv = createTestConversation();
      const text = service.toPlainText(conv);
      expect(text).toContain('[משתמש]');
    });

    it('should label assistant messages as "עוזר"', () => {
      const conv = createTestConversation();
      const text = service.toPlainText(conv);
      expect(text).toContain('[עוזר]');
    });

    it('should skip system messages', () => {
      const conv = createTestConversation({
        messages: [
          { id: 's1', role: 'system', content: 'system msg', timestamp: '2024-06-15T10:00:00Z' },
          { id: 'm1', role: 'user', content: 'user msg', timestamp: '2024-06-15T10:01:00Z' },
        ],
      });
      const text = service.toPlainText(conv);
      expect(text).not.toContain('system msg');
      expect(text).toContain('user msg');
    });

    it('should include message content', () => {
      const conv = createTestConversation();
      const text = service.toPlainText(conv);
      expect(text).toContain('How do I create a React component?');
      expect(text).toContain('Here is a simple React component');
    });

    it('should include separator lines', () => {
      const conv = createTestConversation();
      const text = service.toPlainText(conv);
      expect(text).toContain('='.repeat(50));
      expect(text).toContain('-'.repeat(40));
    });

    it('should include footer', () => {
      const conv = createTestConversation();
      const text = service.toPlainText(conv);
      expect(text).toContain('TS AiTool');
    });

    it('should handle empty conversation', () => {
      const conv = createEmptyConversation();
      const text = service.toPlainText(conv);
      expect(text).toContain('Empty Conversation');
      // Should have header and footer but no messages
      expect(text).toContain('='.repeat(50));
    });
  });
});
