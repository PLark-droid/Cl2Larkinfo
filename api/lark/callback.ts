/**
 * POST /api/lark/callback
 *
 * Handles Lark Interactive Card button click callbacks
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { LarkCardCallback, LarkUrlVerification, Decision } from '../../src/lark/types.js';
import { verifyEventToken } from '../../src/lark/signature.js';
import { createLarkClient } from '../../src/lark/lark-client.js';
import { getStore } from '../../src/store/index.js';

/**
 * Handle URL verification challenge from Lark
 */
function handleUrlVerification(body: LarkUrlVerification, res: VercelResponse): void {
  const verificationToken = process.env.LARK_VERIFICATION_TOKEN;

  if (verificationToken && body.token !== verificationToken) {
    res.status(401).json({ error: 'Invalid verification token' });
    return;
  }

  res.status(200).json({ challenge: body.challenge });
}

/**
 * Handle card action callback
 */
async function handleCardAction(
  body: LarkCardCallback,
  res: VercelResponse
): Promise<void> {
  const verificationToken = process.env.LARK_VERIFICATION_TOKEN;

  // Verify token
  if (verificationToken && !verifyEventToken(body.header.token, verificationToken)) {
    res.status(401).json({ error: 'Invalid event token' });
    return;
  }

  const { action, operator } = body.event;

  // Extract decision from action value
  const { requestId, decision } = action.value as {
    requestId: string;
    decision: Decision;
  };

  if (!requestId || !decision) {
    // Return empty response to acknowledge but do nothing
    res.status(200).json({});
    return;
  }

  // Validate decision
  if (decision !== 'approve' && decision !== 'deny' && decision !== 'message') {
    res.status(400).json({ error: 'Invalid decision' });
    return;
  }

  // Extract message from form submission (for 'message' decision type)
  let userMessage: string | undefined;
  if (decision === 'message') {
    // Try to get message from form_value first, then input_value
    userMessage = action.form_value?.user_message || action.input_value;
    if (!userMessage || userMessage.trim() === '') {
      res.status(200).json({
        toast: {
          type: 'warning',
          content: 'Please enter a message',
        },
      });
      return;
    }
    userMessage = userMessage.trim();
  }

  try {
    const store = await getStore();
    const stored = await store.get(requestId);

    if (!stored) {
      // Request not found, return toast message
      res.status(200).json({
        toast: {
          type: 'error',
          content: 'Request not found or already processed',
        },
      });
      return;
    }

    // Check if already processed
    if (stored.status !== 'pending') {
      res.status(200).json({
        toast: {
          type: 'info',
          content: `Request already ${stored.status}`,
        },
      });
      return;
    }

    // Check if expired
    if (Date.now() >= stored.request.expiresAt) {
      await store.setExpired(requestId);

      // Update card to show expired
      if (stored.larkMessageId) {
        const larkClient = createLarkClient();
        await larkClient.updateAsExpired(stored.larkMessageId, stored.request);
      }

      res.status(200).json({
        toast: {
          type: 'error',
          content: 'Request has expired',
        },
      });
      return;
    }

    // Process decision
    const success = await store.setDecision(requestId, decision, operator.open_id, userMessage);

    if (!success) {
      res.status(200).json({
        toast: {
          type: 'error',
          content: 'Failed to process decision',
        },
      });
      return;
    }

    // Update card with decision
    if (stored.larkMessageId) {
      const larkClient = createLarkClient();
      await larkClient.updateWithDecision(
        stored.larkMessageId,
        stored.request,
        decision,
        operator.open_id,
        userMessage
      );
    }

    // Return success toast
    let actionText: string;
    let toastType: 'success' | 'info';
    if (decision === 'approve') {
      actionText = 'Approved';
      toastType = 'success';
    } else if (decision === 'message') {
      actionText = 'Message sent';
      toastType = 'success';
    } else {
      actionText = 'Denied';
      toastType = 'info';
    }

    res.status(200).json({
      toast: {
        type: toastType,
        content: `${actionText} successfully`,
      },
    });
  } catch (error) {
    console.error('Error processing card action:', error);
    res.status(200).json({
      toast: {
        type: 'error',
        content: 'Failed to process action',
      },
    });
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // Only allow POST
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const body = req.body;

    // Handle URL verification challenge
    if (body.type === 'url_verification') {
      handleUrlVerification(body as LarkUrlVerification, res);
      return;
    }

    // Handle card action callback
    if (body.header?.event_type === 'card.action.trigger') {
      await handleCardAction(body as LarkCardCallback, res);
      return;
    }

    // Unknown event type
    res.status(200).json({});
  } catch (error) {
    console.error('Error in /api/lark/callback:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
