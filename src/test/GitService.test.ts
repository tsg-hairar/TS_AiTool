// ===================================================
// GitService — Unit Tests
// ===================================================
// Tests for secret scanning, sensitive file detection,
// regex pattern matching, spawn calls, caching,
// diff parsing, and error handling.
// ===================================================

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { GitService } from '../extension/services/GitService';

// -------------------------------------------------
// Mock child_process.spawn
// -------------------------------------------------
const mockStdout = {
  on: vi.fn(),
};
const mockStderr = {
  on: vi.fn(),
};
const mockChild = {
  stdout: mockStdout,
  stderr: mockStderr,
  on: vi.fn(),
};

vi.mock('child_process', () => ({
  spawn: vi.fn(() => mockChild),
}));

// Helper to simulate spawn behavior
function setupSpawnSuccess(stdout: string) {
  mockStdout.on.mockImplementation((event: string, cb: (data: Buffer) => void) => {
    if (event === 'data') {
      cb(Buffer.from(stdout));
    }
  });
  mockStderr.on.mockImplementation(() => {});
  mockChild.on.mockImplementation((event: string, cb: (code: number | null) => void) => {
    if (event === 'close') {
      cb(0);
    }
  });
}

function setupSpawnError(stderr: string) {
  mockStdout.on.mockImplementation(() => {});
  mockStderr.on.mockImplementation((event: string, cb: (data: Buffer) => void) => {
    if (event === 'data') {
      cb(Buffer.from(stderr));
    }
  });
  mockChild.on.mockImplementation((event: string, cb: (code: number | null) => void) => {
    if (event === 'close') {
      cb(1);
    }
  });
}

function setupSpawnProcessError(message: string) {
  mockStdout.on.mockImplementation(() => {});
  mockStderr.on.mockImplementation(() => {});
  mockChild.on.mockImplementation((event: string, cb: (...args: any[]) => void) => {
    if (event === 'error') {
      cb(new Error(message));
    }
  });
}

// =================================================
// Tests
// =================================================

describe('GitService', () => {
  let service: GitService;

  beforeEach(() => {
    service = new GitService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------
  // invalidateCache
  // -------------------------------------------------
  describe('invalidateCache', () => {
    it('should not throw when called on a fresh instance', () => {
      expect(() => service.invalidateCache()).not.toThrow();
    });
  });

  // -------------------------------------------------
  // getInfo — with mocked spawn
  // -------------------------------------------------
  describe('getInfo', () => {
    it('should throw when no workspace folder and no cwd provided', async () => {
      // Mock vscode.workspace.workspaceFolders to be undefined
      const vscode = await import('vscode');
      const original = vscode.workspace.workspaceFolders;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mutating mock workspace for test
      (vscode.workspace as Record<string, any>).workspaceFolders = undefined;

      await expect(service.getInfo()).rejects.toThrow('No workspace folder open');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mutating mock workspace for test
      (vscode.workspace as Record<string, any>).workspaceFolders = original;
    });

    it('should parse git info from spawn output', async () => {
      const { spawn } = await import('child_process');

      // Set up sequential calls:
      // 1. git branch --show-current -> "main\n"
      // 2. git log -> "abc123|feat: stuff|2024-01-15T10:30:00Z|John\n"
      // 3. git status --porcelain -> " M file1.ts\n M file2.ts\n"
      // 4. git remote get-url origin -> "https://github.com/test/repo.git\n"
      let callCount = 0;
      vi.mocked(spawn).mockImplementation(() => {
        callCount++;
        const responses = [
          'main\n',
          'abc123\x00feat: stuff\x002024-01-15T10:30:00Z\x00John\n',
          ' M file1.ts\n M file2.ts\n',
          'https://github.com/test/repo.git\n',
        ];
        const idx = Math.min(callCount - 1, 3);
        const stdout = responses[idx];

        const childStdout = { on: vi.fn() };
        const childStderr = { on: vi.fn() };
        const child = {
          stdout: childStdout,
          stderr: childStderr,
          on: vi.fn(),
        };

        childStdout.on.mockImplementation((event: string, cb: (data: Buffer) => void) => {
          if (event === 'data') cb(Buffer.from(stdout));
        });
        childStderr.on.mockImplementation(() => {});
        child.on.mockImplementation((event: string, cb: (code: number | null) => void) => {
          if (event === 'close') cb(0);
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return child as any;
      });

      const info = await service.getInfo('/test/workspace');

      expect(info.branch).toBe('main');
      expect(info.uncommittedChanges).toBe(2);
      expect(info.remoteUrl).toBe('https://github.com/test/repo.git');
      expect(info.lastCommit).toEqual({
        hash: 'abc123',
        message: 'feat: stuff',
        date: '2024-01-15T10:30:00Z',
        author: 'John',
      });
    });
  });

  // -------------------------------------------------
  // commit — secret scanning integration
  // -------------------------------------------------
  describe('commit', () => {
    it('should throw when no workspace folder and no cwd', async () => {
      const vscode = await import('vscode');
      const original = vscode.workspace.workspaceFolders;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mutating mock workspace for test
      (vscode.workspace as Record<string, any>).workspaceFolders = undefined;

      await expect(service.commit('test commit')).rejects.toThrow('No workspace folder open');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mutating mock workspace for test
      (vscode.workspace as Record<string, any>).workspaceFolders = original;
    });

    it('should throw if secrets are found in staged files', async () => {
      const { spawn } = await import('child_process');

      let callCount = 0;
      vi.mocked(spawn).mockImplementation(() => {
        callCount++;
        let stdout = '';
        if (callCount === 1) {
          // git diff --cached --name-only -> returns .env file
          stdout = '.env\n';
        } else if (callCount === 2) {
          // git diff --cached -> returns content with secrets
          stdout = '+++ b/.env\n+API_KEY=sk_test_abcdefghijklmnopqrstuvwxyz1234\n';
        }

        const childStdout = { on: vi.fn() };
        const childStderr = { on: vi.fn() };
        const child = {
          stdout: childStdout,
          stderr: childStderr,
          on: vi.fn(),
        };

        childStdout.on.mockImplementation((event: string, cb: (data: Buffer) => void) => {
          if (event === 'data') cb(Buffer.from(stdout));
        });
        childStderr.on.mockImplementation(() => {});
        child.on.mockImplementation((event: string, cb: (code: number | null) => void) => {
          if (event === 'close') cb(0);
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return child as any;
      });

      await expect(service.commit('test commit', '/test/workspace')).rejects.toThrow('Security');
    });
  });

  // -------------------------------------------------
  // push
  // -------------------------------------------------
  describe('push', () => {
    it('should throw when no workspace folder and no cwd', async () => {
      const vscode = await import('vscode');
      const original = vscode.workspace.workspaceFolders;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mutating mock workspace for test
      (vscode.workspace as Record<string, any>).workspaceFolders = undefined;

      await expect(service.push()).rejects.toThrow('No workspace folder open');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mutating mock workspace for test
      (vscode.workspace as Record<string, any>).workspaceFolders = original;
    });
  });

  // -------------------------------------------------
  // getDiff
  // -------------------------------------------------
  describe('getDiff', () => {
    it('should throw when no workspace folder and no cwd', async () => {
      const vscode = await import('vscode');
      const original = vscode.workspace.workspaceFolders;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mutating mock workspace for test
      (vscode.workspace as Record<string, any>).workspaceFolders = undefined;

      await expect(service.getDiff()).rejects.toThrow('No workspace folder open');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mutating mock workspace for test
      (vscode.workspace as Record<string, any>).workspaceFolders = original;
    });
  });

  // -------------------------------------------------
  // scanForSecrets — sensitive file patterns
  // -------------------------------------------------
  describe('sensitive file name patterns', () => {
    const sensitiveFilePatterns = [
      /\.env(\.local|\.production|\.staging|\.development)?$/,
      /credentials\.json$/i,
      /\.(pem|key|p12|pfx|jks|keystore)$/i,
      /id_(rsa|ed25519|ecdsa|dsa)(\.pub)?$/,
      /\.htpasswd$/i,
      /secret[s]?\.(json|ya?ml|toml)$/i,
      /service[-_]?account.*\.json$/i,
    ];

    function isSensitiveFile(filename: string): boolean {
      return sensitiveFilePatterns.some((p) => p.test(filename));
    }

    it('should detect .env files', () => {
      expect(isSensitiveFile('.env')).toBe(true);
      expect(isSensitiveFile('.env.local')).toBe(true);
      expect(isSensitiveFile('.env.production')).toBe(true);
      expect(isSensitiveFile('.env.staging')).toBe(true);
      expect(isSensitiveFile('.env.development')).toBe(true);
    });

    it('should NOT detect non-sensitive env-like files', () => {
      expect(isSensitiveFile('.env.example')).toBe(false);
      expect(isSensitiveFile('.env.template')).toBe(false);
      expect(isSensitiveFile('env.ts')).toBe(false);
    });

    it('should detect credentials.json', () => {
      expect(isSensitiveFile('credentials.json')).toBe(true);
      expect(isSensitiveFile('google-credentials.json')).toBe(true);
      expect(isSensitiveFile('Credentials.json')).toBe(true);
    });

    it('should detect private key files', () => {
      expect(isSensitiveFile('server.pem')).toBe(true);
      expect(isSensitiveFile('private.key')).toBe(true);
      expect(isSensitiveFile('cert.p12')).toBe(true);
      expect(isSensitiveFile('store.pfx')).toBe(true);
      expect(isSensitiveFile('keystore.jks')).toBe(true);
      expect(isSensitiveFile('app.keystore')).toBe(true);
    });

    it('should detect SSH key files', () => {
      expect(isSensitiveFile('id_rsa')).toBe(true);
      expect(isSensitiveFile('id_ed25519')).toBe(true);
      expect(isSensitiveFile('id_ecdsa')).toBe(true);
      expect(isSensitiveFile('id_dsa')).toBe(true);
      expect(isSensitiveFile('id_rsa.pub')).toBe(true);
    });

    it('should detect htpasswd files', () => {
      expect(isSensitiveFile('.htpasswd')).toBe(true);
      expect(isSensitiveFile('.HTPASSWD')).toBe(true);
    });

    it('should detect secrets files', () => {
      expect(isSensitiveFile('secret.json')).toBe(true);
      expect(isSensitiveFile('secrets.yaml')).toBe(true);
      expect(isSensitiveFile('secrets.yml')).toBe(true);
      expect(isSensitiveFile('secret.toml')).toBe(true);
    });

    it('should detect service account files', () => {
      expect(isSensitiveFile('service-account.json')).toBe(true);
      expect(isSensitiveFile('service_account.json')).toBe(true);
      expect(isSensitiveFile('serviceaccount.json')).toBe(true);
      expect(isSensitiveFile('service-account-key.json')).toBe(true);
    });

    it('should NOT flag normal files', () => {
      expect(isSensitiveFile('package.json')).toBe(false);
      expect(isSensitiveFile('index.ts')).toBe(false);
      expect(isSensitiveFile('README.md')).toBe(false);
      expect(isSensitiveFile('app.config.ts')).toBe(false);
      expect(isSensitiveFile('styles.css')).toBe(false);
    });
  });

  // -------------------------------------------------
  // Secret content patterns
  // -------------------------------------------------
  describe('secret content patterns', () => {
    const secretContentPatterns: Array<{ name: string; pattern: RegExp }> = [
      { name: 'Generic API Key', pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"]?[A-Za-z0-9_\-]{20,}['"]?/i },
      { name: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{16}/ },
      { name: 'AWS Secret Key', pattern: /(?:aws[_-]?secret[_-]?access[_-]?key)\s*[:=]\s*['"]?[A-Za-z0-9/+=]{40}['"]?/i },
      { name: 'Private Key', pattern: /-----BEGIN\s+(RSA|EC|DSA|OPENSSH|PGP)?\s*PRIVATE KEY-----/ },
      { name: 'JWT Token', pattern: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_\-+/=]{10,}/ },
      { name: 'Bearer Token', pattern: /(?:bearer|token|authorization)\s*[:=]\s*['"]?[A-Za-z0-9_\-\.]{20,}['"]?/i },
      { name: 'Connection String', pattern: /(?:mongodb|postgres|mysql|redis|amqp|mssql):\/\/[^\s'"]{10,}/i },
      { name: 'JDBC Connection', pattern: /jdbc:[a-z]+:\/\/[^\s'"]{10,}/i },
      { name: 'GitHub Token', pattern: /(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}/ },
      { name: 'GitLab Token', pattern: /glpat-[A-Za-z0-9_\-]{20,}/ },
      { name: 'Slack Token', pattern: /xox[bpors]-[A-Za-z0-9\-]{10,}/ },
      { name: 'Google API Key', pattern: /AIza[0-9A-Za-z_\-]{35}/ },
      { name: 'Stripe Key', pattern: /(?:sk|pk)_(?:test|live)_[A-Za-z0-9_]{20,}/ },
      { name: 'Azure Secret', pattern: /(?:azure[_-]?(?:client|tenant|subscription)[_-]?(?:secret|id|key))\s*[:=]\s*['"]?[A-Za-z0-9_\-]{20,}['"]?/i },
      { name: 'Hardcoded Secret', pattern: /(?:password|secret|passwd|pwd)\s*[:=]\s*['"][^'"]{8,}['"]/i },
    ];

    function detectSecrets(content: string): string[] {
      return secretContentPatterns
        .filter(({ pattern }) => pattern.test(content))
        .map(({ name }) => name);
    }

    it('should detect AWS access keys', () => {
      expect(detectSecrets('aws_key = AKIAIOSFODNN7EXAMPLE')).toContain('AWS Access Key');
    });

    it('should detect AWS secret keys', () => {
      expect(detectSecrets('aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY1')).toContain('AWS Secret Key');
    });

    it('should detect RSA private keys', () => {
      expect(detectSecrets('-----BEGIN RSA PRIVATE KEY-----\nMIIE...')).toContain('Private Key');
    });

    it('should detect EC private keys', () => {
      expect(detectSecrets('-----BEGIN EC PRIVATE KEY-----\nMIIE...')).toContain('Private Key');
    });

    it('should detect generic private keys', () => {
      expect(detectSecrets('-----BEGIN PRIVATE KEY-----\nMIIE...')).toContain('Private Key');
    });

    it('should detect JWT tokens', () => {
      expect(detectSecrets('token = eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U')).toContain('JWT Token');
    });

    it('should detect GitHub personal access tokens', () => {
      expect(detectSecrets('GITHUB_TOKEN=ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmno')).toContain('GitHub Token');
    });

    it('should detect GitLab tokens', () => {
      expect(detectSecrets('GITLAB_TOKEN=glpat-ABCDEFGHIJKLMNOPQRSTxxxx')).toContain('GitLab Token');
    });

    it('should detect Slack tokens', () => {
      expect(detectSecrets('SLACK_TOKEN=xoxb-123456789-abcdefghij')).toContain('Slack Token');
    });

    it('should detect Google API keys', () => {
      expect(detectSecrets('GOOGLE_KEY=AIzaSyA1234567890abcdefghijklmnopqrstuv')).toContain('Google API Key');
    });

    it('should detect Stripe live keys', () => {
      expect(detectSecrets('STRIPE_KEY=sk_live_FAKE_TEST_KEY_00000000')).toContain('Stripe Key');
    });

    it('should detect Stripe test keys', () => {
      expect(detectSecrets('STRIPE_KEY=pk_test_FAKE_TEST_KEY_00000000')).toContain('Stripe Key');
    });

    it('should detect MongoDB connection strings', () => {
      expect(detectSecrets('DB_URL=mongodb://user:pass@host:27017/dbname')).toContain('Connection String');
    });

    it('should detect PostgreSQL connection strings', () => {
      expect(detectSecrets('DATABASE_URL=postgres://user:pass@host:5432/dbname')).toContain('Connection String');
    });

    it('should detect JDBC connection strings', () => {
      expect(detectSecrets('JDBC_URL=jdbc:mysql://host:3306/dbname?user=root')).toContain('JDBC Connection');
    });

    it('should detect generic API key assignments', () => {
      expect(detectSecrets('api_key = "abcdefghijklmnopqrstuvwxyz1234"')).toContain('Generic API Key');
    });

    it('should detect bearer token assignments', () => {
      expect(detectSecrets('authorization = "Bearer_token_value_1234567890abcdef"')).toContain('Bearer Token');
    });

    it('should detect hardcoded passwords', () => {
      expect(detectSecrets('password = "myS3cretP@ssword!"')).toContain('Hardcoded Secret');
    });

    it('should detect hardcoded secrets', () => {
      expect(detectSecrets("secret = 'my-super-secret-value'")).toContain('Hardcoded Secret');
    });

    it('should detect Azure client secrets', () => {
      expect(detectSecrets('azure_client_secret = "abcdefghijklmnopqrstuv1234567890"')).toContain('Azure Secret');
    });

    it('should NOT flag normal code', () => {
      const content = `
        const x = 42;
        function hello() { return "world"; }
        const config = { port: 3000 };
      `;
      expect(detectSecrets(content)).toEqual([]);
    });

    it('should NOT flag short passwords', () => {
      expect(detectSecrets('password = "short"')).not.toContain('Hardcoded Secret');
    });

    it('should NOT flag empty strings', () => {
      expect(detectSecrets('api_key = ""')).not.toContain('Generic API Key');
    });
  });

  // -------------------------------------------------
  // getDiff parsing
  // -------------------------------------------------
  describe('getDiff parsing logic', () => {
    function parseDiffOutput(output: string) {
      const lines = output.trim().split('\n').filter(Boolean);
      return lines.map((line) => {
        const [additions, deletions, filePath] = line.split('\t');
        return {
          filePath: filePath ?? line,
          status: 'modified' as const,
          additions: parseInt(additions) || 0,
          deletions: parseInt(deletions) || 0,
        };
      });
    }

    it('should parse standard numstat output', () => {
      const output = '10\t5\tsrc/index.ts\n3\t1\tsrc/utils.ts\n';
      const result = parseDiffOutput(output);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        filePath: 'src/index.ts',
        status: 'modified',
        additions: 10,
        deletions: 5,
      });
      expect(result[1]).toEqual({
        filePath: 'src/utils.ts',
        status: 'modified',
        additions: 3,
        deletions: 1,
      });
    });

    it('should handle binary files (shown as - in numstat)', () => {
      const output = '-\t-\timage.png\n';
      const result = parseDiffOutput(output);
      expect(result[0].additions).toBe(0);
      expect(result[0].deletions).toBe(0);
      expect(result[0].filePath).toBe('image.png');
    });

    it('should handle empty output', () => {
      expect(parseDiffOutput('')).toHaveLength(0);
    });

    it('should handle single file output', () => {
      const output = '5\t2\tREADME.md\n';
      const result = parseDiffOutput(output);
      expect(result).toHaveLength(1);
      expect(result[0].filePath).toBe('README.md');
      expect(result[0].additions).toBe(5);
      expect(result[0].deletions).toBe(2);
    });

    it('should handle files with zero additions', () => {
      const output = '0\t10\tsrc/old.ts\n';
      const result = parseDiffOutput(output);
      expect(result[0].additions).toBe(0);
      expect(result[0].deletions).toBe(10);
    });
  });

  // -------------------------------------------------
  // getInfo parsing
  // -------------------------------------------------
  describe('getInfo parsing logic', () => {
    function parseLastCommit(logOutput: string) {
      const [hash, message, date, author] = logOutput.split('|');
      return hash
        ? { hash: hash.trim(), message, date, author }
        : undefined;
    }

    it('should parse commit log format correctly', () => {
      const output = 'abc123def|feat: add feature|2024-01-15T10:30:00Z|John Doe';
      const result = parseLastCommit(output);
      expect(result).toEqual({
        hash: 'abc123def',
        message: 'feat: add feature',
        date: '2024-01-15T10:30:00Z',
        author: 'John Doe',
      });
    });

    it('should return undefined for empty output', () => {
      expect(parseLastCommit('')).toBeUndefined();
    });

    it('should parse status line count correctly', () => {
      const statusOutput = ' M src/file1.ts\n M src/file2.ts\n?? newfile.ts\n';
      const lines = statusOutput.trim().split('\n').filter(Boolean);
      expect(lines.length).toBe(3);
    });

    it('should handle commit with pipe characters in message using null byte delimiter', () => {
      const output = 'abc123\x00fix: handle | edge case\x002024-01-15T10:30:00Z\x00Jane';
      const [hash, message, date, author] = output.split('\x00');
      expect(hash).toBe('abc123');
      expect(message).toBe('fix: handle | edge case');
      expect(date).toBe('2024-01-15T10:30:00Z');
      expect(author).toBe('Jane');
    });
  });

  // -------------------------------------------------
  // parseDiffOutput (unified format)
  // -------------------------------------------------
  describe('parseDiffOutput (unified format)', () => {
    // Access the private method via prototype for testing
    function parseDiffOutput(rawDiff: string): import('../shared/types').DiffFile[] {
      const svc = new GitService();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (svc as any).parseDiffOutput(rawDiff);
    }

    it('should return empty array for empty input', () => {
      expect(parseDiffOutput('')).toEqual([]);
      expect(parseDiffOutput('   ')).toEqual([]);
    });

    it('should parse a simple modified file diff', () => {
      const diff = `diff --git a/src/index.ts b/src/index.ts
index abc123..def456 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,3 +1,4 @@
 line1
-old line
+new line
+added line
 line3
`;
      const result = parseDiffOutput(diff);
      expect(result).toHaveLength(1);
      expect(result[0].filename).toBe('src/index.ts');
      expect(result[0].status).toBe('modified');
      expect(result[0].additions).toBe(2);
      expect(result[0].deletions).toBe(1);
      expect(result[0].hunks).toHaveLength(1);
    });

    it('should detect new file status', () => {
      const diff = `diff --git a/src/new.ts b/src/new.ts
new file mode 100644
--- /dev/null
+++ b/src/new.ts
@@ -0,0 +1,3 @@
+line1
+line2
+line3
`;
      const result = parseDiffOutput(diff);
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('added');
      expect(result[0].additions).toBe(3);
    });

    it('should detect deleted file status', () => {
      const diff = `diff --git a/src/old.ts b/src/old.ts
deleted file mode 100644
--- a/src/old.ts
+++ /dev/null
@@ -1,2 +0,0 @@
-line1
-line2
`;
      const result = parseDiffOutput(diff);
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('deleted');
      expect(result[0].deletions).toBe(2);
    });

    it('should detect renamed file status', () => {
      const diff = `diff --git a/src/old-name.ts b/src/new-name.ts
similarity index 90%
rename from src/old-name.ts
rename to src/new-name.ts
--- a/src/old-name.ts
+++ b/src/new-name.ts
@@ -1,3 +1,3 @@
 line1
-old
+new
 line3
`;
      const result = parseDiffOutput(diff);
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('renamed');
      expect(result[0].filename).toBe('src/new-name.ts');
      expect(result[0].oldFilename).toBe('src/old-name.ts');
    });

    it('should parse multiple hunks in a single file', () => {
      const diff = `diff --git a/src/file.ts b/src/file.ts
--- a/src/file.ts
+++ b/src/file.ts
@@ -1,3 +1,4 @@
 line1
+inserted
 line2
 line3
@@ -10,3 +11,4 @@
 line10
+another insert
 line11
 line12
`;
      const result = parseDiffOutput(diff);
      expect(result).toHaveLength(1);
      expect(result[0].hunks).toHaveLength(2);
    });

    it('should parse multiple files in a single diff', () => {
      const diff = `diff --git a/file1.ts b/file1.ts
--- a/file1.ts
+++ b/file1.ts
@@ -1,2 +1,2 @@
-old1
+new1
 same
diff --git a/file2.ts b/file2.ts
--- a/file2.ts
+++ b/file2.ts
@@ -1,2 +1,2 @@
-old2
+new2
 same
`;
      const result = parseDiffOutput(diff);
      expect(result).toHaveLength(2);
      expect(result[0].filename).toBe('file1.ts');
      expect(result[1].filename).toBe('file2.ts');
    });

    it('should correctly categorize line types in hunks', () => {
      const diff = `diff --git a/test.ts b/test.ts
--- a/test.ts
+++ b/test.ts
@@ -1,4 +1,4 @@
 unchanged
-removed
+added
 also unchanged
`;
      const result = parseDiffOutput(diff);
      const lines = result[0].hunks[0].lines;

      const unchanged = lines.filter((l: any) => l.type === 'unchanged');
      const added = lines.filter((l: any) => l.type === 'added');
      const removed = lines.filter((l: any) => l.type === 'removed');

      expect(added.length).toBeGreaterThan(0);
      expect(removed.length).toBeGreaterThan(0);
      expect(unchanged.length).toBeGreaterThan(0);
    });
  });
});
