import { randomInt } from 'node:crypto';

/**
 * Uniform cryptographic random index for game outcome selection.
 * Empty/invalid collections return 0 so existing caller fallback behavior is preserved.
 */
export function secureRandomIndex(length) {
  if (!Number.isSafeInteger(length) || length <= 0) return 0;
  return randomInt(length);
}
