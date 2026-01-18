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
 * Shows description, command, and action buttons
 */
export function buildPermissionCard(request: PermissionRequest): object {
  // Format command display - truncate if too long
  let commandDisplay = request.command || JSON.stringify(request.args, null, 2);
  if (commandDisplay.length > 300) {
    commandDisplay = commandDisplay.substring(0, 300) + '...';
  }

  // Extract just the folder name from working directory
  const folderName = request.workingDirectory.split('/').pop() || request.workingDirectory;

  // Build description text - show Japanese description if available
  const descriptionText = request.description
    ? `**${request.description}**`
    : '';

  // Build elements
  const elements: object[] = [];

  // Add description if available
  if (descriptionText) {
    elements.push({
      tag: 'div',
      text: {
        tag: 'lark_md',
        content: descriptionText,
      },
    });
  }

  // Add command in code block
  elements.push({
    tag: 'markdown',
    content: `\`\`\`\n${commandDisplay}\n\`\`\``,
  });

  // Add action buttons
  elements.push({
    tag: 'action',
    actions: [
      {
        tag: 'button',
        text: {
          tag: 'plain_text',
          content: '✓ Yes',
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
          content: '✓ Yes, always',
        },
        type: 'default',
        value: {
          requestId: request.requestId,
          decision: 'approve' as Decision,
          always: true,
        },
      },
      {
        tag: 'button',
        text: {
          tag: 'plain_text',
          content: '✗ No',
        },
        type: 'danger',
        value: {
          requestId: request.requestId,
          decision: 'deny' as Decision,
        },
      },
    ],
  });

  return {
    config: {
      wide_screen_mode: true,
    },
    header: {
      template: 'blue',
      title: {
        tag: 'plain_text',
        content: `🤖 ${folderName}`,
      },
    },
    elements,
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
