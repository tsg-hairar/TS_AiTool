// ===================================================
// VS Code API Mock for unit tests
// ===================================================
// Provides minimal mocks of the vscode module so that
// extension services can be tested outside of VS Code.
// ===================================================

/** In-memory store for globalState */
const globalStateStore = new Map<string, unknown>();

/** In-memory store for workspace configuration */
const configStore = new Map<string, unknown>();

/** In-memory store for SecretStorage */
const secretStore = new Map<string, string>();

// -------------------------------------------------
// ExtensionContext mock
// -------------------------------------------------
export const mockGlobalState = {
  get<T>(key: string, defaultValue?: T): T {
    if (globalStateStore.has(key)) {
      return globalStateStore.get(key) as T;
    }
    return defaultValue as T;
  },
  async update(key: string, value: unknown): Promise<void> {
    globalStateStore.set(key, value);
  },
  keys(): readonly string[] {
    return [...globalStateStore.keys()];
  },
  /** Test helper: clear all stored data */
  _clear(): void {
    globalStateStore.clear();
  },
};

export const mockSecrets = {
  async get(key: string): Promise<string | undefined> {
    return secretStore.get(key);
  },
  async store(key: string, value: string): Promise<void> {
    secretStore.set(key, value);
  },
  async delete(key: string): Promise<void> {
    secretStore.delete(key);
  },
  onDidChange: () => ({ dispose: () => {} }),
  /** Test helper: clear all stored secrets */
  _clear(): void {
    secretStore.clear();
  },
};

export function createMockExtensionContext() {
  return {
    globalState: mockGlobalState,
    secrets: mockSecrets,
    subscriptions: [] as { dispose(): void }[],
    extensionPath: '/mock/extension/path',
    extensionUri: { fsPath: '/mock/extension/path' },
    storagePath: '/mock/storage',
    globalStoragePath: '/mock/global-storage',
    logPath: '/mock/log',
  };
}

/** Type-safe alias for the mock context — use instead of `as any` in tests */
export type MockExtensionContext = ReturnType<typeof createMockExtensionContext>;

// -------------------------------------------------
// workspace mock
// -------------------------------------------------
const workspace = {
  workspaceFolders: [
    {
      uri: { fsPath: '/mock/workspace' },
      name: 'mock-workspace',
      index: 0,
    },
  ],
  getConfiguration(section?: string) {
    return {
      get<T>(key: string, defaultValue?: T): T {
        const fullKey = section ? `${section}.${key}` : key;
        if (configStore.has(fullKey)) {
          return configStore.get(fullKey) as T;
        }
        return defaultValue as T;
      },
      async update(key: string, value: unknown, _target?: unknown): Promise<void> {
        const fullKey = section ? `${section}.${key}` : key;
        configStore.set(fullKey, value);
      },
      has(key: string): boolean {
        const fullKey = section ? `${section}.${key}` : key;
        return configStore.has(fullKey);
      },
      inspect(_key: string) {
        return undefined;
      },
    };
  },
  fs: {
    async writeFile(_uri: unknown, _content: Uint8Array): Promise<void> {
      // no-op in tests
    },
    async readFile(_uri: unknown): Promise<Uint8Array> {
      return new Uint8Array();
    },
    async readDirectory(_uri: unknown): Promise<Array<[string, number]>> {
      return [];
    },
    async delete(_uri: unknown, _options?: { recursive?: boolean }): Promise<void> {
      // no-op in tests
    },
  },
  findFiles: async (_include: unknown, _exclude?: unknown, _maxResults?: number) => [],
  asRelativePath: (uri: unknown) => {
    if (typeof uri === 'string') return uri;
    if (uri && typeof uri === 'object' && 'fsPath' in uri) return (uri as { fsPath: string }).fsPath;
    return String(uri);
  },
  /** Test helper: set config value directly */
  _setConfig(key: string, value: unknown): void {
    configStore.set(key, value);
  },
  /** Test helper: clear config */
  _clearConfig(): void {
    configStore.clear();
  },
};

// -------------------------------------------------
// window mock
// -------------------------------------------------
const window = {
  showInformationMessage: async (..._args: unknown[]) => undefined,
  showWarningMessage: async (..._args: unknown[]) => undefined,
  showErrorMessage: async (..._args: unknown[]) => undefined,
  showSaveDialog: async (_options: unknown) => undefined,
  createOutputChannel: (_name: string) => ({
    appendLine: (_text: string) => {},
    append: (_text: string) => {},
    show: () => {},
    dispose: () => {},
  }),
  createTerminal: (_name: string) => ({
    sendText: (_text: string) => {},
    show: () => {},
    dispose: () => {},
  }),
};

// -------------------------------------------------
// env mock
// -------------------------------------------------
const env = {
  clipboard: {
    writeText: async (_text: string) => {},
    readText: async () => '',
  },
};

// -------------------------------------------------
// Uri mock
// -------------------------------------------------
const Uri = {
  file: (path: string) => ({ fsPath: path, scheme: 'file', path }),
  parse: (str: string) => ({ fsPath: str, scheme: 'file', path: str }),
};

// -------------------------------------------------
// languages mock
// -------------------------------------------------
const languages = {
  getDiagnostics: (_uri?: unknown) => [],
};

// -------------------------------------------------
// Enums
// -------------------------------------------------
const FileType = {
  Unknown: 0,
  File: 1,
  Directory: 2,
  SymbolicLink: 64,
};

const DiagnosticSeverity = {
  Error: 0,
  Warning: 1,
  Information: 2,
  Hint: 3,
  0: 'Error',
  1: 'Warning',
  2: 'Information',
  3: 'Hint',
};

const ConfigurationTarget = {
  Global: 1,
  Workspace: 2,
  WorkspaceFolder: 3,
};

// -------------------------------------------------
// Default export (mimics "import * as vscode from 'vscode'")
// -------------------------------------------------
export {
  workspace,
  window,
  env,
  Uri,
  languages,
  FileType,
  DiagnosticSeverity,
  ConfigurationTarget,
};

export default {
  workspace,
  window,
  env,
  Uri,
  languages,
  FileType,
  DiagnosticSeverity,
  ConfigurationTarget,
};
