/**
 * POST /api/notify
 *
 * Receives permission request notifications from Claude Code hook
 * and sends interactive card to Lark
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomUUID } from 'crypto';
import type { NotifyRequest, PermissionRequest, StoredRequest, ApiResponse, NotifyResponse } from '../src/lark/types.js';
import { createLarkClient } from '../src/lark/lark-client.js';
import { getStore } from '../src/store/index.js';

// Default timeout in milliseconds (5 minutes)
const DEFAULT_TIMEOUT = 5 * 60 * 1000;

/**
 * Verify API key authentication
 */
function verifyApiKey(req: VercelRequest): boolean {
  const apiKey = process.env.LARK_API_KEY;
  if (!apiKey) {
    console.warn('LARK_API_KEY not configured, skipping auth');
    return true;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.slice(7);
  return token === apiKey;
}

/**
 * Determine risk level based on command/tool
 */
function determineRiskLevel(tool: string, command?: string): 'low' | 'medium' | 'high' | 'critical' {
  const dangerousPatterns = [
    /rm\s+-rf/i,
    /rm\s+.*-f/i,
    /rmdir/i,
    /format/i,
    /mkfs/i,
    /dd\s+if=/i,
    />\s*\/dev/i,
    /chmod\s+777/i,
    /curl.*\|\s*(ba)?sh/i,
    /wget.*\|\s*(ba)?sh/i,
  ];

  const highRiskPatterns = [
    /git\s+push.*-f/i,
    /git\s+reset.*--hard/i,
    /npm\s+publish/i,
    /docker\s+rm/i,
    /kubectl\s+delete/i,
    /drop\s+database/i,
    /truncate\s+table/i,
  ];

  const mediumRiskPatterns = [
    /npm\s+install/i,
    /pip\s+install/i,
    /git\s+checkout/i,
    /git\s+merge/i,
    /docker\s+run/i,
    /kubectl\s+apply/i,
  ];

  const cmdStr = command || '';

  // Check critical patterns
  for (const pattern of dangerousPatterns) {
    if (pattern.test(cmdStr)) {
      return 'critical';
    }
  }

  // Check high risk patterns
  for (const pattern of highRiskPatterns) {
    if (pattern.test(cmdStr)) {
      return 'high';
    }
  }

  // Check medium risk patterns
  for (const pattern of mediumRiskPatterns) {
    if (pattern.test(cmdStr)) {
      return 'medium';
    }
  }

  // Bash commands are at least medium risk
  if (tool === 'Bash') {
    return 'medium';
  }

  return 'low';
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // Only allow POST
  if (req.method !== 'POST') {
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
    const body = req.body as NotifyRequest;

    // Validate required fields
    if (!body.tool || !body.workingDirectory) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: tool, workingDirectory',
      } satisfies ApiResponse);
      return;
    }

    // Generate request ID and timestamps
    const requestId = randomUUID();
    const now = Date.now();
    const timeout = parseInt(process.env.LARK_TIMEOUT || '') || DEFAULT_TIMEOUT;
    const expiresAt = now + timeout;

    // Determine risk level
    const riskLevel = body.riskLevel || determineRiskLevel(body.tool, body.command);

    // Extract project name from working directory
    const project = body.project || body.workingDirectory.split('/').pop() || 'Unknown';

    // Create permission request
    const permissionRequest: PermissionRequest = {
      requestId,
      tool: body.tool,
      command: body.command,
      args: body.args,
      workingDirectory: body.workingDirectory,
      project,
      riskLevel,
      timestamp: now,
      expiresAt,
    };

    // Initialize store and Lark client
    const store = await getStore();
    const larkClient = createLarkClient();

    // Send Lark notification
    const messageId = await larkClient.sendPermissionRequest(permissionRequest);

    // Store the request
    const storedRequest: StoredRequest = {
      request: permissionRequest,
      status: 'pending',
      larkMessageId: messageId,
      createdAt: now,
    };

    await store.set(requestId, storedRequest);

    // Return response
    res.status(200).json({
      success: true,
      data: {
        requestId,
        expiresAt,
      },
    } satisfies ApiResponse<NotifyResponse>);
  } catch (error) {
    console.error('Error in /api/notify:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    } satisfies ApiResponse);
  }
}
