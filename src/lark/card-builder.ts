/**
 * Lark Interactive Card Builder
 *
 * Builds interactive message cards for permission requests
 */

import type { PermissionRequest, Decision } from './types.js';

// Color scheme based on risk level
const RISK_COLORS: Record<string, string> = {
  low: 'green',
  medium: 'yellow',
  high: 'orange',
  critical: 'red',
};

const RISK_LABELS: Record<string, string> = {
  low: 'Low Risk',
  medium: 'Medium Risk',
  high: 'High Risk',
  critical: 'CRITICAL',
};

/**
 * Build an interactive card for permission request
 */
export function buildPermissionCard(request: PermissionRequest): object {
  const color = RISK_COLORS[request.riskLevel] || 'orange';
  const riskLabel = RISK_LABELS[request.riskLevel] || 'Unknown';

  // Format command display
  const commandDisplay = request.command || JSON.stringify(request.args, null, 2);

  // Calculate time until expiration
  const expiresInMs = request.expiresAt - Date.now();
  const expiresInMinutes = Math.max(0, Math.ceil(expiresInMs / 60000));

  return {
    config: {
      wide_screen_mode: true,
    },
    header: {
      template: color,
      title: {
        tag: 'plain_text',
        content: 'Claude Code Permission Request',
      },
    },
    elements: [
      // Project and Risk Level
      {
        tag: 'div',
        fields: [
          {
            is_short: true,
            text: {
              tag: 'lark_md',
              content: `**Project:** ${request.project}`,
            },
          },
          {
            is_short: true,
            text: {
              tag: 'lark_md',
              content: `**Risk Level:** ${riskLabel}`,
            },
          },
        ],
      },

      // Divider
      { tag: 'hr' },

      // Tool name
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**Tool:** \`${request.tool}\``,
        },
      },

      // Command/Args display
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: '**Command:**',
        },
      },
      {
        tag: 'markdown',
        content: `\`\`\`\n${commandDisplay}\n\`\`\``,
      },

      // Working Directory
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**Working Directory:**\n\`${request.workingDirectory}\``,
        },
      },

      // Divider
      { tag: 'hr' },

      // Request metadata
      {
        tag: 'note',
        elements: [
          {
            tag: 'plain_text',
            content: `Request ID: ${request.requestId} | Expires in ${expiresInMinutes} minutes`,
          },
        ],
      },

      // Action buttons
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: {
              tag: 'plain_text',
              content: 'Approve',
            },
            type: 'primary',
            value: {
              requestId: request.requestId,
              decision: 'approve' as Decision,
            },
          },
          {
            tag: 'button',
            text: {
              tag: 'plain_text',
              content: 'Deny',
            },
            type: 'danger',
            value: {
              requestId: request.requestId,
              decision: 'deny' as Decision,
            },
          },
        ],
      },

      // Divider
      { tag: 'hr' },

      // Text input section
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: '**Send Instructions to Claude:**',
        },
      },

      // Form with text input
      {
        tag: 'form',
        name: 'message_form',
        elements: [
          {
            tag: 'input',
            name: 'user_message',
            placeholder: {
              tag: 'plain_text',
              content: 'Type your instructions here...',
            },
            width: 'fill',
            default_value: '',
          },
          {
            tag: 'button',
            text: {
              tag: 'plain_text',
              content: 'Send Message',
            },
            type: 'default',
            action_type: 'form_submit',
            name: 'submit_message',
            value: {
              requestId: request.requestId,
              decision: 'message' as Decision,
            },
          },
        ],
      },
    ],
  };
}

/**
 * Build a response card showing the decision
 */
export function buildResponseCard(
  request: PermissionRequest,
  decision: Decision,
  respondedBy?: string,
  message?: string
): object {
  let color: string;
  let statusText: string;
  let statusEmoji: string;

  if (decision === 'approve') {
    color = 'green';
    statusText = 'APPROVED';
    statusEmoji = '✓';
  } else if (decision === 'message') {
    color = 'blue';
    statusText = 'MESSAGE SENT';
    statusEmoji = '💬';
  } else {
    color = 'red';
    statusText = 'DENIED';
    statusEmoji = '✗';
  }

  const commandDisplay = request.command || JSON.stringify(request.args, null, 2);

  const elements: object[] = [
    // Project info
    {
      tag: 'div',
      fields: [
        {
          is_short: true,
          text: {
            tag: 'lark_md',
            content: `**Project:** ${request.project}`,
          },
        },
        {
          is_short: true,
          text: {
            tag: 'lark_md',
            content: `**Decision:** ${statusText}`,
          },
        },
      ],
    },

    // Divider
    { tag: 'hr' },

    // Command that was approved/denied
    {
      tag: 'div',
      text: {
        tag: 'lark_md',
        content: `**Tool:** \`${request.tool}\``,
      },
    },
    {
      tag: 'markdown',
      content: `\`\`\`\n${commandDisplay}\n\`\`\``,
    },
  ];

  // Add message if present
  if (message) {
    elements.push(
      { tag: 'hr' },
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**Message to Claude:**\n${message}`,
        },
      }
    );
  }

  // Note
  elements.push({
    tag: 'note',
    elements: [
      {
        tag: 'plain_text',
        content: respondedBy
          ? `Responded by user at ${new Date().toISOString()}`
          : `Responded at ${new Date().toISOString()}`,
      },
    ],
  });

  return {
    config: {
      wide_screen_mode: true,
    },
    header: {
      template: color,
      title: {
        tag: 'plain_text',
        content: `${statusEmoji} Permission ${statusText}`,
      },
    },
    elements,
  };
}

/**
 * Build an expired card
 */
export function buildExpiredCard(request: PermissionRequest): object {
  const commandDisplay = request.command || JSON.stringify(request.args, null, 2);

  return {
    config: {
      wide_screen_mode: true,
    },
    header: {
      template: 'grey',
      title: {
        tag: 'plain_text',
        content: '⏰ Permission Request Expired',
      },
    },
    elements: [
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**Project:** ${request.project}`,
        },
      },
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**Tool:** \`${request.tool}\``,
        },
      },
      {
        tag: 'markdown',
        content: `\`\`\`\n${commandDisplay}\n\`\`\``,
      },
      {
        tag: 'note',
        elements: [
          {
            tag: 'plain_text',
            content: `Request ID: ${request.requestId} | Expired`,
          },
        ],
      },
    ],
  };
}
