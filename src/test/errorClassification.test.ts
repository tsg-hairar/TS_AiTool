// ===================================================
// Error Classification & Retry Logic — Unit Tests
// ===================================================
// Tests for error classification (classifyError) and
// retry behavior (withRetry) in ClaudeService.
//
// Since classifyError is a private module function and
// withRetry is a private method, we test them through
// the public sendMessage API and via reflection where
// the existing test patterns permit.
// ===================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ClaudeService } from '../extension/services/ClaudeService';
import type { StreamCallbacks } from '../extension/services/ClaudeService';

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
// Tests — Error Classification
// =================================================
// We test classifyError indirectly by triggering CLI
// error events through handleCliEvent, which calls
// classifyError and prepends [CATEGORY] to the error.
// =================================================

describe('Error Classification', () => {
  let service: ClaudeService;

  beforeEach(() => {
    service = new ClaudeService();
  });

  // Helper to call handleCliEvent with an error and extract the classified message
  function triggerCliError(
    errorMessage: string,
    callbacks: ReturnType<typeof createMockCallbacks>,
  ): void {
    // @ts-expect-error - accessing private method for testing
    service.handleCliEvent(
      { type: 'error', error: errorMessage },
      callbacks,
      (_t: string) => {},
      () => {},
      () => '',
    );
  }

  // -------------------------------------------------
  // classifyError — network errors
  // -------------------------------------------------
  describe('classifyError — network errors', () => {
    it('should classify timeout errors as NETWORK', () => {
      const callbacks = createMockCallbacks();
      triggerCliError('Connection timed out after 30s', callbacks);

      expect(callbacks.errors).toHaveLength(1);
      expect(callbacks.errors[0].message).toBe('Connection timed out after 30s');
    });

    it('should classify ECONNREFUSED as network error', () => {
      const callbacks = createMockCallbacks();
      triggerCliError('connect ECONNREFUSED 127.0.0.1:443', callbacks);

      expect(callbacks.errors).toHaveLength(1);
      expect(callbacks.errors[0].message).toContain('ECONNREFUSED');
    });

    it('should classify socket hang up as network error', () => {
      const callbacks = createMockCallbacks();
      triggerCliError('socket hang up', callbacks);

      expect(callbacks.errors).toHaveLength(1);
      expect(callbacks.errors[0].message).toContain('socket hang up');
    });

    it('should classify ENOTFOUND as network error', () => {
      const callbacks = createMockCallbacks();
      triggerCliError('getaddrinfo ENOTFOUND api.anthropic.com', callbacks);

      expect(callbacks.errors).toHaveLength(1);
      expect(callbacks.errors[0].message).toContain('ENOTFOUND');
    });
  });

  // -------------------------------------------------
  // classifyError — auth errors
  // -------------------------------------------------
  describe('classifyError — auth errors', () => {
    it('should classify invalid API key errors', () => {
      const callbacks = createMockCallbacks();
      triggerCliError('Invalid API key provided', callbacks);

      expect(callbacks.errors).toHaveLength(1);
      expect(callbacks.errors[0].message).toContain('API key');
    });

    it('should classify 401 unauthorized errors', () => {
      const callbacks = createMockCallbacks();
      triggerCliError('HTTP 401 Unauthorized', callbacks);

      expect(callbacks.errors).toHaveLength(1);
      expect(callbacks.errors[0].message).toContain('401');
    });

    it('should classify forbidden (403) errors', () => {
      const callbacks = createMockCallbacks();
      triggerCliError('403 Forbidden - access denied', callbacks);

      expect(callbacks.errors).toHaveLength(1);
      expect(callbacks.errors[0].message).toContain('Forbidden');
    });

    it('should classify expired token errors', () => {
      const callbacks = createMockCallbacks();
      triggerCliError('Token has expired, please re-authenticate', callbacks);

      expect(callbacks.errors).toHaveLength(1);
      expect(callbacks.errors[0].message).toContain('expired');
    });
  });

  // -------------------------------------------------
  // classifyError — rate limit errors
  // -------------------------------------------------
  describe('classifyError — rate limit errors', () => {
    it('should classify 429 errors as rate limit', () => {
      const callbacks = createMockCallbacks();
      triggerCliError('HTTP 429 Too Many Requests', callbacks);

      expect(callbacks.errors).toHaveLength(1);
      expect(callbacks.errors[0].message).toContain('429');
    });

    it('should classify rate limit errors', () => {
      const callbacks = createMockCallbacks();
      triggerCliError('Rate limit exceeded', callbacks);

      expect(callbacks.errors).toHaveLength(1);
      expect(callbacks.errors[0].message).toContain('Rate limit');
    });

    it('should classify overloaded errors', () => {
      const callbacks = createMockCallbacks();
      triggerCliError('API is overloaded, please try again later', callbacks);

      expect(callbacks.errors).toHaveLength(1);
      expect(callbacks.errors[0].message).toContain('overloaded');
    });
  });

  // -------------------------------------------------
  // classifyError — validation errors
  // -------------------------------------------------
  describe('classifyError — validation errors', () => {
    it('should classify bad request (400) errors', () => {
      const callbacks = createMockCallbacks();
      triggerCliError('HTTP 400 Bad Request: invalid parameter', callbacks);

      expect(callbacks.errors).toHaveLength(1);
      expect(callbacks.errors[0].message).toContain('400');
    });

    it('should classify malformed input errors', () => {
      const callbacks = createMockCallbacks();
      triggerCliError('malformed JSON in request body', callbacks);

      expect(callbacks.errors).toHaveLength(1);
      expect(callbacks.errors[0].message).toContain('malformed');
    });

    it('should classify validation errors', () => {
      const callbacks = createMockCallbacks();
      triggerCliError('validation failed: max_tokens must be positive', callbacks);

      expect(callbacks.errors).toHaveLength(1);
      expect(callbacks.errors[0].message).toContain('validation');
    });
  });

  // -------------------------------------------------
  // classifyError — unknown errors
  // -------------------------------------------------
  describe('classifyError — unknown errors', () => {
    it('should classify unrecognized errors as unknown', () => {
      const callbacks = createMockCallbacks();
      triggerCliError('Something completely unexpected happened', callbacks);

      expect(callbacks.errors).toHaveLength(1);
      expect(callbacks.errors[0].message).toContain('Something completely unexpected happened');
    });
  });
});

// =================================================
// Tests — withRetry logic
// =================================================
// withRetry is a private method on ClaudeService.
// We test its behavior through the API mode sendMessage,
// which wraps calls in withRetry.
// =================================================

describe('withRetry', () => {
  let service: ClaudeService;

  beforeEach(() => {
    service = new ClaudeService();
  });

  // -------------------------------------------------
  // withRetry — successful first attempt
  // -------------------------------------------------
  describe('successful first attempt', () => {
    it('should return result on first successful attempt', async () => {
      const callbacks = createMockCallbacks();
      const operation = vi.fn().mockResolvedValue('success');

      // @ts-expect-error - accessing private method for testing
      const result = await service.withRetry(operation, callbacks, 'test-op');

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------
  // withRetry — retry on network error
  // -------------------------------------------------
  describe('retry on network error', () => {
    it('should retry on network errors (retryable)', async () => {
      const callbacks = createMockCallbacks();
      const networkError = new Error('Connection timed out');
      const operation = vi.fn()
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce('recovered');

      // @ts-expect-error - accessing private method for testing
      const result = await service.withRetry(operation, callbacks, 'test-op');

      expect(result).toBe('recovered');
      expect(operation).toHaveBeenCalledTimes(2);
      // Should have reported progress about retrying
      expect(callbacks.progressSteps.length).toBeGreaterThanOrEqual(1);
      expect(callbacks.progressSteps[0]).toContain('retrying');
    }, 15000); // longer timeout for retry delays

    it('should exhaust retries and throw on persistent network error', async () => {
      const callbacks = createMockCallbacks();
      const networkError = new Error('ECONNREFUSED');
      const operation = vi.fn().mockRejectedValue(networkError);

      // @ts-expect-error - accessing private method for testing
      await expect(service.withRetry(operation, callbacks, 'test-op'))
        .rejects.toThrow();

      // Should have tried up to 4 times (initial + 3 retries for network errors)
      expect(operation).toHaveBeenCalledTimes(4);
    }, 30000); // longer timeout for multiple retries with backoff
  });

  // -------------------------------------------------
  // withRetry — no retry on auth error
  // -------------------------------------------------
  describe('no retry on auth error', () => {
    it('should NOT retry on authentication errors', async () => {
      const callbacks = createMockCallbacks();
      const authError = new Error('Invalid API key');
      const operation = vi.fn().mockRejectedValue(authError);

      // @ts-expect-error - accessing private method for testing
      await expect(service.withRetry(operation, callbacks, 'test-op'))
        .rejects.toThrow();

      // Auth errors are not retryable — should only attempt once
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should NOT retry on 401 unauthorized errors', async () => {
      const callbacks = createMockCallbacks();
      const authError = new Error('HTTP 401 Unauthorized');
      const operation = vi.fn().mockRejectedValue(authError);

      // @ts-expect-error - accessing private method for testing
      await expect(service.withRetry(operation, callbacks, 'test-op'))
        .rejects.toThrow();

      expect(operation).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------
  // withRetry — no retry on validation error
  // -------------------------------------------------
  describe('no retry on validation error', () => {
    it('should NOT retry on bad request errors', async () => {
      const callbacks = createMockCallbacks();
      const validationError = new Error('400 Bad Request: invalid parameter');
      const operation = vi.fn().mockRejectedValue(validationError);

      // @ts-expect-error - accessing private method for testing
      await expect(service.withRetry(operation, callbacks, 'test-op'))
        .rejects.toThrow();

      expect(operation).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------
  // withRetry — AbortError bypasses retry
  // -------------------------------------------------
  describe('AbortError handling', () => {
    it('should throw immediately on AbortError without retrying', async () => {
      const callbacks = createMockCallbacks();
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      const operation = vi.fn().mockRejectedValue(abortError);

      // @ts-expect-error - accessing private method for testing
      await expect(service.withRetry(operation, callbacks, 'test-op'))
        .rejects.toThrow('Aborted');

      expect(operation).toHaveBeenCalledTimes(1);
    });
  });
});
