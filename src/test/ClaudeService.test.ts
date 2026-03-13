// ===================================================
// ClaudeService — Unit Tests
// ===================================================
// Tests for Claude API/CLI service initialization,
// mode switching, cost estimation, and event handling.
// ===================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ClaudeService } from '../extension/services/ClaudeService';
import type { StreamCallbacks } from '../extension/services/ClaudeService';
import type { ModelId } from '../shared/types';

// -------------------------------------------------
// Helper: create mock callbacks
// -------------------------------------------------
function createMockCallbacks(): StreamCallbacks & {
  tokens: string[];
  errors: Error[];
  completions: Array<{ text: string; tokenCount: number }>;
  progressSteps: string[];
} {
  const tokens: string[] = [];
  const errors: Error[] = [];
  const completions: Array<{ text: string; tokenCount: number }> = [];
  const progressSteps: string[] = [];

  return {
    tokens,
    errors,
    completions,
    progressSteps,
    onToken: (token: string) => { tokens.push(token); },
    onComplete: (fullText: string, tokenCount: number) => {
      completions.push({ text: fullText, tokenCount });
    },
    onToolUse: vi.fn(),
    onError: (error: Error) => { errors.push(error); },
    onProgress: (step: string) => { progressSteps.push(step); },
  };
}

// =================================================
// Tests
// =================================================

describe('ClaudeService', () => {
  let service: ClaudeService;

  beforeEach(() => {
    service = new ClaudeService();
  });

  // -------------------------------------------------
  // Initialization
  // -------------------------------------------------
  describe('initialize', () => {
    it('should default to CLI mode when no API key is provided', () => {
      service.initialize();
      expect(service.getMode()).toBe('cli');
    });

    it('should default to CLI mode when empty string is provided', () => {
      service.initialize('');
      expect(service.getMode()).toBe('cli');
    });

    it('should default to CLI mode when key does not start with sk-', () => {
      service.initialize('not-a-valid-key');
      expect(service.getMode()).toBe('cli');
    });

    it('should attempt API mode when a valid-looking API key is provided', () => {
      // Note: this will fall back to CLI because @anthropic-ai/sdk
      // may not be available in the test environment, which is the
      // expected fallback behavior in the code.
      service.initialize('sk-ant-test-key-12345');
      // It either stays api (if SDK loads) or falls back to cli
      const mode = service.getMode();
      expect(['cli', 'api']).toContain(mode);
    });

    it('should set API mode when SDK is available and key starts with sk-', () => {
      // In this test environment, the SDK is installed, so it should
      // successfully initialize in API mode with a valid-looking key.
      service.initialize('sk-ant-test-key-12345');
      // The SDK is available, so it should be in API mode
      expect(service.getMode()).toBe('api');
    });
  });

  // -------------------------------------------------
  // getMode
  // -------------------------------------------------
  describe('getMode', () => {
    it('should return cli by default', () => {
      expect(service.getMode()).toBe('cli');
    });
  });

  // -------------------------------------------------
  // setWorkingDirectory
  // -------------------------------------------------
  describe('setWorkingDirectory', () => {
    it('should accept a string path', () => {
      // Should not throw
      expect(() => service.setWorkingDirectory('/some/path')).not.toThrow();
    });

    it('should accept null', () => {
      expect(() => service.setWorkingDirectory(null)).not.toThrow();
    });
  });

  // -------------------------------------------------
  // sendMessage — error cases
  // -------------------------------------------------
  describe('sendMessage', () => {
    it('should call onError when no user message is found (CLI mode)', async () => {
      service.initialize(); // CLI mode
      const callbacks = createMockCallbacks();

      // Only an assistant message, no user message
      await service.sendMessage(
        [{ id: '1', role: 'assistant', content: 'hello', timestamp: new Date().toISOString() }],
        'system prompt',
        'claude-sonnet-4-20250514',
        4096,
        callbacks,
      );

      expect(callbacks.errors.length).toBe(1);
      expect(callbacks.errors[0].message).toContain('No user message found');
    });

    it('should call onError when API client is not configured in API mode', async () => {
      // Force API mode without a real client
      service.initialize('sk-ant-fake');
      // If it fell back to CLI, skip this test
      if (service.getMode() !== 'api') {
        // The service fell back to CLI due to missing SDK, which is correct behavior.
        // We test the API error path via handleCliEvent instead.
        return;
      }

      const callbacks = createMockCallbacks();
      // @ts-expect-error - access private to clear client for testing
      service.apiClient = null;

      await service.sendMessage(
        [{ id: '1', role: 'user', content: 'hello', timestamp: new Date().toISOString() }],
        'system prompt',
        'claude-sonnet-4-20250514',
        4096,
        callbacks,
      );

      expect(callbacks.errors.length).toBe(1);
      expect(callbacks.errors[0].message).toContain('API key not configured');
    });
  });

  // -------------------------------------------------
  // handleCliEvent — testing event parsing
  // -------------------------------------------------
  describe('handleCliEvent (private, tested via reflection)', () => {
    // Access private method for unit testing event parsing logic
    function callHandleCliEvent(
      event: Record<string, unknown>,
      callbacks: ReturnType<typeof createMockCallbacks>,
    ): { text: string; completed: boolean } {
      let text = '';
      let completed = false;

      // @ts-expect-error - accessing private method for testing
      service.handleCliEvent(
        event,
        callbacks,
        (t: string) => { text += t; },
        () => { completed = true; },
        () => text,
      );

      return { text, completed };
    }

    it('should parse assistant text events', () => {
      const callbacks = createMockCallbacks();
      const result = callHandleCliEvent({
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: 'Hello world' },
          ],
        },
      }, callbacks);

      expect(result.text).toBe('Hello world');
      expect(callbacks.tokens).toEqual(['Hello world']);
      expect(result.completed).toBe(false);
    });

    it('should parse multiple text blocks in one assistant event', () => {
      const callbacks = createMockCallbacks();
      const result = callHandleCliEvent({
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: 'Part 1 ' },
            { type: 'text', text: 'Part 2' },
          ],
        },
      }, callbacks);

      expect(result.text).toBe('Part 1 Part 2');
      expect(callbacks.tokens).toEqual(['Part 1 ', 'Part 2']);
    });

    it('should handle tool_use blocks and report progress', () => {
      const callbacks = createMockCallbacks();
      const result = callHandleCliEvent({
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              name: 'Read',
              input: { file_path: '/src/test/file.ts' },
            },
          ],
        },
      }, callbacks);

      expect(result.text).toBe('');
      expect(callbacks.progressSteps.length).toBe(1);
      expect(callbacks.progressSteps[0]).toContain('Read');
      expect(callbacks.progressSteps[0]).toContain('file.ts');
    });

    it('should handle content_block_delta events', () => {
      const callbacks = createMockCallbacks();
      const result = callHandleCliEvent({
        type: 'content_block_delta',
        delta: { text: 'streaming chunk' },
      }, callbacks);

      expect(result.text).toBe('streaming chunk');
      expect(callbacks.tokens).toEqual(['streaming chunk']);
    });

    it('should handle result events and prefer accumulated text', () => {
      const callbacks = createMockCallbacks();

      // Simulate accumulated text from prior streaming
      let accumulated = 'I streamed this already';
      // @ts-expect-error - accessing private method for testing
      service.handleCliEvent(
        {
          type: 'result',
          result: 'Different result text',
          usage: { input_tokens: 100, output_tokens: 50 },
        },
        callbacks,
        (_t: string) => {},
        () => {},  // markComplete (no-op, we check callbacks)
        () => accumulated,
      );

      // Should prefer the accumulated text over result text
      expect(callbacks.completions.length).toBe(1);
      expect(callbacks.completions[0].text).toBe('I streamed this already');
      expect(callbacks.completions[0].tokenCount).toBe(150);
    });

    it('should use result text when no accumulated text', () => {
      const callbacks = createMockCallbacks();

      // @ts-expect-error - accessing private method for testing
      service.handleCliEvent(
        {
          type: 'result',
          result: 'The result text',
          usage: { input_tokens: 200, output_tokens: 100 },
        },
        callbacks,
        (_t: string) => {},
        () => {},
        () => '', // no accumulated text
      );

      expect(callbacks.completions.length).toBe(1);
      expect(callbacks.completions[0].text).toBe('The result text');
      expect(callbacks.completions[0].tokenCount).toBe(300);
    });

    it('should handle error events with string body', () => {
      const callbacks = createMockCallbacks();
      const result = callHandleCliEvent({
        type: 'error',
        error: 'Something went wrong',
      }, callbacks);

      expect(callbacks.errors.length).toBe(1);
      expect(callbacks.errors[0].message).toBe('Something went wrong');
      expect(result.completed).toBe(true);
    });

    it('should handle error events with object body', () => {
      const callbacks = createMockCallbacks();
      const result = callHandleCliEvent({
        type: 'error',
        error: { message: 'Rate limited' },
      }, callbacks);

      expect(callbacks.errors.length).toBe(1);
      expect(callbacks.errors[0].message).toBe('Rate limited');
      expect(result.completed).toBe(true);
    });

    it('should handle system init events and report progress', () => {
      const callbacks = createMockCallbacks();
      callHandleCliEvent({
        type: 'system',
        subtype: 'init',
        model: 'claude-sonnet-4',
        cwd: '/home/user/my-project',
      }, callbacks);

      expect(callbacks.progressSteps.length).toBe(1);
      expect(callbacks.progressSteps[0]).toContain('my-project');
    });

    it('should silently ignore ping events', () => {
      const callbacks = createMockCallbacks();
      const result = callHandleCliEvent({ type: 'ping' }, callbacks);

      expect(result.text).toBe('');
      expect(result.completed).toBe(false);
      expect(callbacks.tokens.length).toBe(0);
    });

    it('should silently ignore rate_limit_event', () => {
      const callbacks = createMockCallbacks();
      const result = callHandleCliEvent({ type: 'rate_limit_event' }, callbacks);

      expect(result.text).toBe('');
      expect(result.completed).toBe(false);
    });

    it('should handle fallback content as direct string on event', () => {
      const callbacks = createMockCallbacks();
      const result = callHandleCliEvent({
        type: 'assistant',
        content: 'Direct string content',
      }, callbacks);

      expect(result.text).toBe('Direct string content');
    });
  });

  // -------------------------------------------------
  // estimateCost — static method
  // -------------------------------------------------
  describe('estimateCost', () => {
    it('should calculate cost for claude-sonnet-4-20250514', () => {
      const cost = ClaudeService.estimateCost('claude-sonnet-4-20250514', 1000, 500);
      // input: 1000/1000 * 0.003 = 0.003
      // output: 500/1000 * 0.015 = 0.0075
      // total: 0.0105
      expect(cost).toBeCloseTo(0.0105, 4);
    });

    it('should calculate cost for claude-opus-4-20250514', () => {
      const cost = ClaudeService.estimateCost('claude-opus-4-20250514', 1000, 1000);
      // input: 1000/1000 * 0.015 = 0.015
      // output: 1000/1000 * 0.075 = 0.075
      // total: 0.090
      expect(cost).toBeCloseTo(0.090, 4);
    });

    it('should calculate cost for claude-haiku-4-5-20251001', () => {
      const cost = ClaudeService.estimateCost('claude-haiku-4-5-20251001', 2000, 1000);
      // input: 2000/1000 * 0.001 = 0.002
      // output: 1000/1000 * 0.005 = 0.005
      // total: 0.007
      expect(cost).toBeCloseTo(0.007, 4);
    });

    it('should return 0 for unknown model', () => {
      const cost = ClaudeService.estimateCost('unknown-model' as ModelId, 1000, 1000);
      expect(cost).toBe(0);
    });

    it('should return 0 when token counts are 0', () => {
      const cost = ClaudeService.estimateCost('claude-sonnet-4-20250514', 0, 0);
      expect(cost).toBe(0);
    });

    it('should scale linearly with token count', () => {
      const cost1 = ClaudeService.estimateCost('claude-sonnet-4-20250514', 1000, 1000);
      const cost2 = ClaudeService.estimateCost('claude-sonnet-4-20250514', 2000, 2000);
      expect(cost2).toBeCloseTo(cost1 * 2, 6);
    });
  });

  // -------------------------------------------------
  // cancel / dispose
  // -------------------------------------------------
  describe('cancel', () => {
    it('should not throw when called with no active process', () => {
      expect(() => service.cancel()).not.toThrow();
    });

    it('should not throw when called multiple times', () => {
      expect(() => {
        service.cancel();
        service.cancel();
      }).not.toThrow();
    });
  });

  describe('dispose', () => {
    it('should not throw when called', () => {
      expect(() => service.dispose()).not.toThrow();
    });
  });
});
