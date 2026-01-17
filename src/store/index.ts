/**
 * Store Module
 *
 * Provides storage for permission request state
 */

export * from './types.js';
export * from './memory-store.js';
export * from './kv-store.js';

import type { RequestStore } from './types.js';
import { getMemoryStore } from './memory-store.js';
import { createKVStore } from './kv-store.js';

/**
 * Get the appropriate store based on environment
 *
 * In production (Vercel), uses Vercel KV
 * In development, uses in-memory store
 */
export async function getStore(): Promise<RequestStore> {
  // Check if we're in Vercel environment with KV configured
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    try {
      // Dynamic import to avoid issues when @vercel/kv isn't installed
      const { kv } = await import('@vercel/kv');
      return createKVStore(kv);
    } catch {
      console.warn('Failed to load @vercel/kv, falling back to memory store');
    }
  }

  // Fall back to memory store for local development
  console.warn(
    'Using in-memory store. Note: State will not persist across serverless invocations.'
  );
  return getMemoryStore();
}
