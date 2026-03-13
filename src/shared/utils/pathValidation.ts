// ===================================================
// Path Validation — shared security utilities
// ===================================================
// Centralised path and command validation used by both
// ChatHandler and ToolExecutor.
// ===================================================

import * as path from 'path';

// -------------------------------------------------
// Sensitive file patterns — never accessed by tools
// -------------------------------------------------
export const SENSITIVE_FILE_PATTERNS: RegExp[] = [
  /\.env(\.local|\.production|\.staging|\.development)?$/i,
  /credentials\.json$/i,
  /\.(pem|key|p12|pfx)$/i,
  /id_(rsa|ed25519|ecdsa|dsa)$/i,
  /\.htpasswd$/i,
  /secret[s]?\.(json|ya?ml|toml)$/i,
  /service[-_]?account.*\.json$/i,
  /\.npmrc$/i,
  /\.docker\/config\.json$/i,
];

// -------------------------------------------------
// Suspicious path patterns — system directories
// -------------------------------------------------
const SUSPICIOUS_PATH_PATTERNS: RegExp[] = [
  /\.\.[/\\]/,        // ../ or ..\
  /[/\\]\.\./,        // /../ or \..
  /^~\//,             // ~/  — home directory
  /^\/etc\//i,        // /etc/ — system config
  /^\/var\//i,        // /var/ — system data
  /^\/usr\//i,        // /usr/ — system binaries
  /^\/proc\//i,       // /proc/ — process info
  /^\/sys\//i,        // /sys/ — kernel
  /^[A-Z]:\\Windows\\/i,        // C:\Windows\
  /^[A-Z]:\\Program Files/i,    // C:\Program Files
];

// -------------------------------------------------
// validatePathSecurity — validate a file path is safe
// -------------------------------------------------
// Ensures the path stays within the workspace boundary
// and is not a sensitive file. Works for both single-root
// and multi-root workspaces.
//
// @param inputPath       The raw path from user/tool input
// @param workspaceRoots  Array of workspace root paths (fsPath)
// @returns               The normalised absolute path
// @throws                Error if path is outside workspace or sensitive
// -------------------------------------------------
export function validatePathSecurity(
  inputPath: string,
  workspaceRoots: string[],
): string {
  if (!inputPath || typeof inputPath !== 'string') {
    throw new Error('Path validation failed: path is empty or invalid');
  }

  if (!workspaceRoots || workspaceRoots.length === 0) {
    throw new Error(
      'Security: No workspace folder open — file access denied. ' +
      'Please open a folder/workspace before using file tools.',
    );
  }

  // Resolve against the first workspace root (primary)
  const primaryRoot = workspaceRoots[0];
  const resolvedPath = path.resolve(primaryRoot, inputPath);
  const normalizedPath = path.normalize(resolvedPath);

  // Check if path is within ANY workspace folder
  const isWithinWorkspace = workspaceRoots.some((root) => {
    const normalizedRoot = path.normalize(path.resolve(root));
    const rootWithSep = normalizedRoot.endsWith(path.sep)
      ? normalizedRoot
      : normalizedRoot + path.sep;
    return (
      normalizedPath === normalizedRoot ||
      normalizedPath.startsWith(rootWithSep)
    );
  });

  if (!isWithinWorkspace) {
    throw new Error(
      `Security: Path traversal blocked — "${inputPath}" resolves to ` +
      `"${normalizedPath}" which is outside the workspace. ` +
      'File operations are restricted to the current workspace folder.',
    );
  }

  // Check for suspicious patterns in the original input
  for (const pattern of SUSPICIOUS_PATH_PATTERNS) {
    if (pattern.test(inputPath)) {
      // Only block if after resolution it ends up outside workspace
      const withinAfterResolve = workspaceRoots.some((root) => {
        const normalizedRoot = path.normalize(path.resolve(root));
        const rootWithSep = normalizedRoot.endsWith(path.sep)
          ? normalizedRoot
          : normalizedRoot + path.sep;
        return (
          normalizedPath === normalizedRoot ||
          normalizedPath.startsWith(rootWithSep)
        );
      });
      if (!withinAfterResolve) {
        throw new Error(
          `Security: Suspicious path pattern detected — "${inputPath}". ` +
          'File operations are restricted to the current workspace folder.',
        );
      }
    }
  }

  // Check for sensitive file patterns
  const basename = path.basename(normalizedPath);
  for (const pattern of SENSITIVE_FILE_PATTERNS) {
    if (pattern.test(basename) || pattern.test(normalizedPath)) {
      throw new Error(
        `Security: Access to sensitive file blocked — "${basename}". ` +
        'This file type is not accessible through tool operations.',
      );
    }
  }

  return normalizedPath;
}
