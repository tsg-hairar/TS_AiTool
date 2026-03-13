// ===================================================
// generateId — UUID v4 generator
// ===================================================
// Shared utility for generating unique IDs across the extension.
// Uses Node.js crypto for secure random bytes.
// ===================================================

import * as crypto from 'crypto';

/**
 * Generates a UUID v4 string using crypto-safe random bytes.
 */
export function generateId(): string {
  const bytes = new Uint8Array(16);
  crypto.randomFillSync(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 1
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
