/**
 * @file apps/server/src/config/withTimeout.js
 * Helper that rejects when a promise takes too long, so a slow or unreachable
 * dependency can never hang a request.
 */

export function withTimeout(promise, ms = 2000) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
