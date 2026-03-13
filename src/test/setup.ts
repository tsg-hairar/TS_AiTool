// ===================================================
// Vitest Setup — runs before each test file
// ===================================================

import { vi } from 'vitest';

// Mock the vscode module globally
vi.mock('vscode', async () => {
  const mock = await import('./__mocks__/vscode');
  return mock;
});
