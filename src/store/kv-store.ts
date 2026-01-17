/**
 * Vercel KV Store Implementation
 *
 * Uses Vercel KV (Redis-compatible) for serverless state management
 */

import type { RequestStore } from './types.js';
import type { StoredRequest, Decision } from '../lark/types.js';
import type { VercelKV } from '@vercel/kv';

// Key prefix for our requests
const KEY_PREFIX = 'claude-permission:';

/**
 * Vercel KV Store
 *
 * Uses the @vercel/kv package for Redis-compatible storage
 */
export class KVStore implements RequestStore {
  private kv: VercelKV;

  constructor(kvClient: VercelKV) {
    this.kv = kvClient;
  }

  private getKey(requestId: string): string {
    return `${KEY_PREFIX}${requestId}`;
  }

  async set(requestId: string, data: StoredRequest): Promise<void> {
    const key = this.getKey(requestId);

    // Calculate TTL based on expiration time
    const ttlMs = data.request.expiresAt - Date.now();
    const ttlSeconds = Math.max(1, Math.ceil(ttlMs / 1000));

    await this.kv.set(key, data, { ex: ttlSeconds });
  }

  async get(requestId: string): Promise<StoredRequest | null> {
    const key = this.getKey(requestId);
    return this.kv.get<StoredRequest>(key);
  }

  async setDecision(
    requestId: string,
    decision: Decision,
    respondedBy?: string
  ): Promise<boolean> {
    const stored = await this.get(requestId);

    if (!stored) {
      return false;
    }

    if (stored.status !== 'pending') {
      return false;
    }

    const updated: StoredRequest = {
      ...stored,
      status: decision === 'approve' ? 'approved' : 'denied',
      decision: {
        requestId,
        decision,
        respondedAt: Date.now(),
        respondedBy,
      },
    };

    // Keep the same TTL
    const key = this.getKey(requestId);
    const ttlMs = stored.request.expiresAt - Date.now();
    const ttlSeconds = Math.max(60, Math.ceil(ttlMs / 1000)); // Min 60s after decision

    await this.kv.set(key, updated, { ex: ttlSeconds });
    return true;
  }

  async setExpired(requestId: string): Promise<boolean> {
    const stored = await this.get(requestId);

    if (!stored) {
      return false;
    }

    if (stored.status !== 'pending') {
      return false;
    }

    const updated: StoredRequest = {
      ...stored,
      status: 'expired',
    };

    const key = this.getKey(requestId);
    await this.kv.set(key, updated, { ex: 60 }); // Keep for 60s after expiration
    return true;
  }

  async delete(requestId: string): Promise<void> {
    const key = this.getKey(requestId);
    await this.kv.del(key);
  }
}

/**
 * Create KV store from Vercel KV
 *
 * Usage:
 *   import { kv } from '@vercel/kv';
 *   const store = createKVStore(kv);
 */
export function createKVStore(kv: VercelKV): KVStore {
  return new KVStore(kv);
}
