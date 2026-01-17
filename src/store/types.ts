/**
 * Store Type Definitions
 */

import type { StoredRequest, DecisionResponse, Decision } from '../lark/types.js';

export interface RequestStore {
  /**
   * Store a new permission request
   */
  set(requestId: string, data: StoredRequest): Promise<void>;

  /**
   * Get a stored request
   */
  get(requestId: string): Promise<StoredRequest | null>;

  /**
   * Update request with decision
   */
  setDecision(requestId: string, decision: Decision, respondedBy?: string): Promise<boolean>;

  /**
   * Mark request as expired
   */
  setExpired(requestId: string): Promise<boolean>;

  /**
   * Delete a request
   */
  delete(requestId: string): Promise<void>;
}
