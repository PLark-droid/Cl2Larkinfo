/**
 * In-Memory Store Implementation
 *
 * For local development and testing
 * WARNING: This store does not persist across serverless function invocations
 */

import type { RequestStore } from './types.js';
import type { StoredRequest, Decision } from '../lark/types.js';

/**
 * In-Memory Store
 *
 * Simple Map-based storage with automatic expiration
 */
export class MemoryStore implements RequestStore {
  private store = new Map<string, StoredRequest>();
  private timers = new Map<string, NodeJS.Timeout>();

  async set(requestId: string, data: StoredRequest): Promise<void> {
    // Clear existing timer if any
    const existingTimer = this.timers.get(requestId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    this.store.set(requestId, data);

    // Set expiration timer
    const ttlMs = data.request.expiresAt - Date.now();
    if (ttlMs > 0) {
      const timer = setTimeout(() => {
        this.handleExpiration(requestId);
      }, ttlMs);
      this.timers.set(requestId, timer);
    }
  }

  async get(requestId: string): Promise<StoredRequest | null> {
    const stored = this.store.get(requestId);

    if (!stored) {
      return null;
    }

    // Check if expired
    if (stored.status === 'pending' && Date.now() >= stored.request.expiresAt) {
      stored.status = 'expired';
      this.store.set(requestId, stored);
    }

    return stored;
  }

  async setDecision(
    requestId: string,
    decision: Decision,
    respondedBy?: string,
    message?: string
  ): Promise<boolean> {
    const stored = this.store.get(requestId);

    if (!stored) {
      return false;
    }

    if (stored.status !== 'pending') {
      return false;
    }

    // Check if already expired
    if (Date.now() >= stored.request.expiresAt) {
      stored.status = 'expired';
      this.store.set(requestId, stored);
      return false;
    }

    // Determine status based on decision type
    if (decision === 'approve') {
      stored.status = 'approved';
    } else if (decision === 'message') {
      stored.status = 'message';
    } else {
      stored.status = 'denied';
    }

    stored.decision = {
      requestId,
      decision,
      message,
      respondedAt: Date.now(),
      respondedBy,
    };

    this.store.set(requestId, stored);

    // Clear expiration timer
    const timer = this.timers.get(requestId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(requestId);
    }

    return true;
  }

  async setExpired(requestId: string): Promise<boolean> {
    const stored = this.store.get(requestId);

    if (!stored) {
      return false;
    }

    if (stored.status !== 'pending') {
      return false;
    }

    stored.status = 'expired';
    this.store.set(requestId, stored);

    // Clear timer
    const timer = this.timers.get(requestId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(requestId);
    }

    return true;
  }

  async delete(requestId: string): Promise<void> {
    this.store.delete(requestId);

    const timer = this.timers.get(requestId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(requestId);
    }
  }

  private handleExpiration(requestId: string): void {
    const stored = this.store.get(requestId);
    if (stored && stored.status === 'pending') {
      stored.status = 'expired';
      this.store.set(requestId, stored);
    }
    this.timers.delete(requestId);
  }

  /**
   * Clear all stored requests (for testing)
   */
  clear(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.store.clear();
  }

  /**
   * Get all pending requests (for debugging)
   */
  getPending(): StoredRequest[] {
    return Array.from(this.store.values()).filter((r) => r.status === 'pending');
  }
}

// Singleton instance for local development
let memoryStoreInstance: MemoryStore | null = null;

export function getMemoryStore(): MemoryStore {
  if (!memoryStoreInstance) {
    memoryStoreInstance = new MemoryStore();
  }
  return memoryStoreInstance;
}
