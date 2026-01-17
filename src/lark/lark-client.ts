/**
 * Lark API Client
 *
 * Handles authentication and API calls to Lark
 */

import type {
  LarkTokenResponse,
  LarkMessageResponse,
  PermissionRequest,
} from './types.js';
import { buildPermissionCard, buildResponseCard, buildExpiredCard } from './card-builder.js';
import type { Decision } from './types.js';

const LARK_API_BASE = 'https://open.larksuite.com/open-apis';

interface LarkClientConfig {
  appId: string;
  appSecret: string;
  chatId: string;
}

export class LarkClient {
  private config: LarkClientConfig;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(config: LarkClientConfig) {
    this.config = config;
  }

  /**
   * Get tenant access token with automatic refresh
   */
  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid (with 60s buffer)
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 60000) {
      return this.accessToken;
    }

    const response = await fetch(
      `${LARK_API_BASE}/auth/v3/tenant_access_token/internal`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          app_id: this.config.appId,
          app_secret: this.config.appSecret,
        }),
      }
    );

    const data = (await response.json()) as LarkTokenResponse;

    if (data.code !== 0 || !data.tenant_access_token) {
      throw new Error(`Failed to get Lark access token: ${data.msg}`);
    }

    this.accessToken = data.tenant_access_token;
    // Token expires in `expire` seconds, convert to milliseconds
    this.tokenExpiresAt = Date.now() + (data.expire || 7200) * 1000;

    return this.accessToken;
  }

  /**
   * Send a message to a chat
   */
  private async sendMessage(
    chatId: string,
    msgType: string,
    content: object
  ): Promise<string> {
    const token = await this.getAccessToken();

    const response = await fetch(
      `${LARK_API_BASE}/im/v1/messages?receive_id_type=chat_id`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          receive_id: chatId,
          msg_type: msgType,
          content: JSON.stringify(content),
        }),
      }
    );

    const data = (await response.json()) as LarkMessageResponse;

    if (data.code !== 0) {
      throw new Error(`Failed to send Lark message: ${data.msg}`);
    }

    return data.data?.message_id || '';
  }

  /**
   * Update an existing message (for card updates)
   */
  private async updateMessage(
    messageId: string,
    content: object
  ): Promise<void> {
    const token = await this.getAccessToken();

    const response = await fetch(
      `${LARK_API_BASE}/im/v1/messages/${messageId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          content: JSON.stringify(content),
        }),
      }
    );

    const data = (await response.json()) as { code: number; msg: string };

    if (data.code !== 0) {
      throw new Error(`Failed to update Lark message: ${data.msg}`);
    }
  }

  /**
   * Send a permission request card
   */
  async sendPermissionRequest(request: PermissionRequest): Promise<string> {
    const card = buildPermissionCard(request);
    return this.sendMessage(this.config.chatId, 'interactive', card);
  }

  /**
   * Update card with decision
   */
  async updateWithDecision(
    messageId: string,
    request: PermissionRequest,
    decision: Decision,
    respondedBy?: string
  ): Promise<void> {
    const card = buildResponseCard(request, decision, respondedBy);
    await this.updateMessage(messageId, card);
  }

  /**
   * Update card to show expired state
   */
  async updateAsExpired(
    messageId: string,
    request: PermissionRequest
  ): Promise<void> {
    const card = buildExpiredCard(request);
    await this.updateMessage(messageId, card);
  }
}

/**
 * Create a Lark client from environment variables
 */
export function createLarkClient(): LarkClient {
  const appId = process.env.LARK_APP_ID;
  const appSecret = process.env.LARK_APP_SECRET;
  const chatId = process.env.LARK_CHAT_ID;

  if (!appId || !appSecret || !chatId) {
    throw new Error(
      'Missing Lark configuration. Required: LARK_APP_ID, LARK_APP_SECRET, LARK_CHAT_ID'
    );
  }

  return new LarkClient({ appId, appSecret, chatId });
}
