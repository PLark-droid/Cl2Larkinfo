/**
 * GET /api/status/:id
 *
 * Returns the current status of a permission request
 * Used by the hook script to poll for decisions
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { ApiResponse, StatusResponse } from '../../src/lark/types.js';
import { getStore } from '../../src/store/index.js';

/**
 * Verify API key authentication
 */
function verifyApiKey(req: VercelRequest): boolean {
  const apiKey = process.env.LARK_API_KEY;
  if (!apiKey) {
    return true;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.slice(7);
  return token === apiKey;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // Only allow GET
  if (req.method !== 'GET') {
    res.status(405).json({
      success: false,
      error: 'Method not allowed',
    } satisfies ApiResponse);
    return;
  }

  // Verify API key
  if (!verifyApiKey(req)) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized',
    } satisfies ApiResponse);
    return;
  }

  try {
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Missing request ID',
      } satisfies ApiResponse);
      return;
    }

    const store = await getStore();
    const stored = await store.get(id);

    if (!stored) {
      res.status(200).json({
        success: true,
        data: {
          status: 'not_found',
        },
      } satisfies ApiResponse<StatusResponse>);
      return;
    }

    // Check if expired
    if (stored.status === 'pending' && Date.now() >= stored.request.expiresAt) {
      await store.setExpired(id);
      res.status(200).json({
        success: true,
        data: {
          status: 'expired',
        },
      } satisfies ApiResponse<StatusResponse>);
      return;
    }

    const response: StatusResponse = {
      status: stored.status,
    };

    if (stored.decision) {
      response.decision = stored.decision.decision;
      response.respondedAt = stored.decision.respondedAt;
      // Include message if present
      if (stored.decision.message) {
        response.message = stored.decision.message;
      }
    }

    res.status(200).json({
      success: true,
      data: response,
    } satisfies ApiResponse<StatusResponse>);
  } catch (error) {
    console.error('Error in /api/status:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    } satisfies ApiResponse);
  }
}
