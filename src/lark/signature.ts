/**
 * Lark Signature Verification
 *
 * Verifies that incoming requests are legitimately from Lark
 */

import { createHmac } from 'crypto';

/**
 * Verify Lark callback signature
 *
 * Lark signs callbacks using HMAC-SHA256 with the verification token
 */
export function verifyLarkSignature(
  timestamp: string,
  nonce: string,
  body: string,
  signature: string,
  verificationToken: string
): boolean {
  // Lark signature format: timestamp + nonce + verificationToken + body
  const payload = timestamp + nonce + verificationToken + body;

  const expectedSignature = createHmac('sha256', '')
    .update(payload)
    .digest('hex');

  return signature === expectedSignature;
}

/**
 * Verify Lark event callback token
 *
 * Simpler verification using just the token in the payload
 */
export function verifyEventToken(
  eventToken: string,
  verificationToken: string
): boolean {
  return eventToken === verificationToken;
}

/**
 * Calculate Lark card callback signature for verification
 */
export function calculateCardSignature(
  timestamp: string,
  nonce: string,
  encryptKey: string,
  body: string
): string {
  const payload = timestamp + nonce + encryptKey + body;
  return createHmac('sha256', '')
    .update(payload)
    .digest('hex');
}

/**
 * Verify request timestamp to prevent replay attacks
 *
 * @param timestamp - Unix timestamp in seconds
 * @param maxAge - Maximum age in seconds (default: 5 minutes)
 */
export function verifyTimestamp(timestamp: number, maxAge = 300): boolean {
  const now = Math.floor(Date.now() / 1000);
  return Math.abs(now - timestamp) <= maxAge;
}
