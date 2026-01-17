/**
 * POST /api/message
 *
 * Sends a new message to Lark chat (for status updates, completion notifications, etc.)
 * This allows Claude to notify users about task completion or request additional guidance
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { ApiResponse } from '../src/lark/types.js';
import { createLarkClient } from '../src/lark/lark-client.js';

interface MessageRequest {
  type: 'completion' | 'status' | 'question';
  title: string;
  content: string;
  project?: string;
}

interface MessageResponse {
  messageId: string;
}

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

/**
 * Build a notification card
 */
function buildNotificationCard(request: MessageRequest): object {
  let color: string;
  let emoji: string;

  switch (request.type) {
    case 'completion':
      color = 'green';
      emoji = '✅';
      break;
    case 'question':
      color = 'blue';
      emoji = '❓';
      break;
    default:
      color = 'grey';
      emoji = 'ℹ️';
  }

  return {
    config: {
      wide_screen_mode: true,
    },
    header: {
      template: color,
      title: {
        tag: 'plain_text',
        content: `${emoji} ${request.title}`,
      },
    },
    elements: [
      ...(request.project
        ? [
            {
              tag: 'div',
              text: {
                tag: 'lark_md',
                content: `**Project:** ${request.project}`,
              },
            },
            { tag: 'hr' },
          ]
        : []),
      {
        tag: 'markdown',
        content: request.content,
      },
      {
        tag: 'note',
        elements: [
          {
            tag: 'plain_text',
            content: `Sent at ${new Date().toISOString()}`,
          },
        ],
      },
    ],
  };
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
    const body = req.body as MessageRequest;

    // Validate required fields
    if (!body.type || !body.title || !body.content) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: type, title, content',
      } satisfies ApiResponse);
      return;
    }

    // Build card and send to Lark
    const larkClient = createLarkClient();
    const card = buildNotificationCard(body);

    // Use a workaround to send the card since we don't have a direct method
    // We'll add a sendCard method or use sendMessage directly
    const chatId = process.env.LARK_CHAT_ID;
    if (!chatId) {
      throw new Error('LARK_CHAT_ID not configured');
    }

    // Send as interactive card
    const response = await fetch(
      'https://open.larksuite.com/open-apis/im/v1/messages?receive_id_type=chat_id',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await getAccessToken()}`,
        },
        body: JSON.stringify({
          receive_id: chatId,
          msg_type: 'interactive',
          content: JSON.stringify(card),
        }),
      }
    );

    const data = (await response.json()) as { code: number; msg: string; data?: { message_id: string } };

    if (data.code !== 0) {
      throw new Error(`Failed to send message: ${data.msg}`);
    }

    res.status(200).json({
      success: true,
      data: {
        messageId: data.data?.message_id || '',
      },
    } satisfies ApiResponse<MessageResponse>);
  } catch (error) {
    console.error('Error in /api/message:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    } satisfies ApiResponse);
  }
}

// Helper function to get access token
async function getAccessToken(): Promise<string> {
  const appId = process.env.LARK_APP_ID;
  const appSecret = process.env.LARK_APP_SECRET;

  if (!appId || !appSecret) {
    throw new Error('Missing Lark configuration');
  }

  const response = await fetch(
    'https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        app_id: appId,
        app_secret: appSecret,
      }),
    }
  );

  const data = (await response.json()) as { code: number; msg: string; tenant_access_token?: string };

  if (data.code !== 0 || !data.tenant_access_token) {
    throw new Error(`Failed to get access token: ${data.msg}`);
  }

  return data.tenant_access_token;
}
