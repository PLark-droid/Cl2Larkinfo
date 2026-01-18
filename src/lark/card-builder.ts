/**
 * Lark Interactive Card Builder
 *
 * Builds interactive message cards for permission requests
 */

import type { PermissionRequest, Decision } from './types.js';

// Color scheme based on risk level (Lark template colors)
const RISK_COLORS: Record<string, string> = {
  low: 'green',
  medium: 'yellow',
  high: 'orange',
  critical: 'red',
};

// Risk level labels with emoji
const RISK_LABELS: Record<string, string> = {
  low: '🟢 Low Risk',
  medium: '🟡 Medium Risk',
  high: '🟠 High Risk',
  critical: '🔴 CRITICAL',
};

// Risk level descriptions for user understanding
const RISK_DESCRIPTIONS: Record<string, string> = {
  low: '通常の読み取り操作です。システムへの影響は最小限です。',
  medium: 'パッケージのインストールやファイル変更を含みます。内容を確認してください。',
  high: 'データの変更や削除を伴う操作です。慎重に確認してください。',
  critical: '⚠️ 危険な操作です！システムやデータに重大な影響を与える可能性があります。',
};

// Warning messages for critical patterns
const CRITICAL_WARNINGS: Record<string, string> = {
  'rm -rf': '再帰的にファイルを強制削除します。復元できません。',
  'rm -f': 'ファイルを強制削除します。',
  'chmod 777': '全ユーザーに全権限を付与します。セキュリティリスクがあります。',
  'curl | sh': '外部スクリプトを直接実行します。マルウェアのリスクがあります。',
  'wget | sh': '外部スクリプトを直接実行します。マルウェアのリスクがあります。',
  'dd if=': 'ディスクに直接書き込みます。データ損失のリスクがあります。',
  'mkfs': 'ディスクをフォーマットします。全データが消去されます。',
  'git push -f': '強制プッシュします。リモートの履歴が上書きされます。',
  'git reset --hard': 'ローカルの変更を全て破棄します。',
  'npm publish': 'パッケージを公開します。公開後は取り消せません。',
  'drop database': 'データベースを削除します。全データが消失します。',
  'truncate table': 'テーブルの全データを削除します。',
  'kubectl delete': 'Kubernetesリソースを削除します。',
  'docker rm': 'Dockerコンテナを削除します。',
};

/**
 * Detect specific warning patterns in command
 */
function detectWarnings(command: string): string[] {
  const warnings: string[] = [];
  const lowerCommand = command.toLowerCase();

  for (const [pattern, warning] of Object.entries(CRITICAL_WARNINGS)) {
    if (lowerCommand.includes(pattern.toLowerCase())) {
      warnings.push(warning);
    }
  }

  return warnings;
}

/**
 * Format timestamp for display
 */
function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Calculate remaining time until expiration
 */
function getRemainingTime(expiresAt: number): string {
  const remaining = expiresAt - Date.now();
  if (remaining <= 0) return '期限切れ';

  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);

  if (minutes > 0) {
    return `${minutes}分${seconds}秒`;
  }
  return `${seconds}秒`;
}

/**
 * Build an interactive card for permission request
 * Shows description, command, and action buttons
 */
export function buildPermissionCard(request: PermissionRequest): object {
  // Format command display - truncate if too long
  let commandDisplay = request.command || JSON.stringify(request.args, null, 2);
  if (commandDisplay.length > 500) {
    commandDisplay = commandDisplay.substring(0, 500) + '...';
  }

  // Get risk level info
  const riskLevel = request.riskLevel || 'medium';
  const riskColor = RISK_COLORS[riskLevel] || 'blue';
  const riskLabel = RISK_LABELS[riskLevel] || '🟡 Medium Risk';
  const riskDescription = RISK_DESCRIPTIONS[riskLevel] || '';

  // Detect warnings for dangerous commands
  const warnings = detectWarnings(commandDisplay);

  // Build elements
  const elements: object[] = [];

  // 1. Risk level banner (for high/critical)
  if (riskLevel === 'critical' || riskLevel === 'high') {
    elements.push({
      tag: 'div',
      text: {
        tag: 'lark_md',
        content: `**${riskLabel}**\n${riskDescription}`,
      },
    });
    elements.push({ tag: 'hr' });
  }

  // 2. Project and context info
  elements.push({
    tag: 'div',
    fields: [
      {
        is_short: true,
        text: {
          tag: 'lark_md',
          content: `**Project**\n${request.project}`,
        },
      },
      {
        is_short: true,
        text: {
          tag: 'lark_md',
          content: `**Tool**\n\`${request.tool}\``,
        },
      },
    ],
  });

  elements.push({
    tag: 'div',
    fields: [
      {
        is_short: true,
        text: {
          tag: 'lark_md',
          content: `**Risk Level**\n${riskLabel}`,
        },
      },
      {
        is_short: true,
        text: {
          tag: 'lark_md',
          content: `**Expires in**\n${getRemainingTime(request.expiresAt)}`,
        },
      },
    ],
  });

  // 3. Description if available
  if (request.description) {
    elements.push({
      tag: 'div',
      text: {
        tag: 'lark_md',
        content: `**Description**\n${request.description}`,
      },
    });
  }

  // 4. Working directory
  elements.push({
    tag: 'div',
    text: {
      tag: 'lark_md',
      content: `**Working Directory**\n\`${request.workingDirectory}\``,
    },
  });

  elements.push({ tag: 'hr' });

  // 5. Command in code block
  elements.push({
    tag: 'div',
    text: {
      tag: 'lark_md',
      content: '**Command to execute:**',
    },
  });

  elements.push({
    tag: 'markdown',
    content: `\`\`\`\n${commandDisplay}\n\`\`\``,
  });

  // 6. Warnings for dangerous commands
  if (warnings.length > 0) {
    elements.push({
      tag: 'div',
      text: {
        tag: 'lark_md',
        content: `⚠️ **Warning:**\n${warnings.map(w => `• ${w}`).join('\n')}`,
      },
    });
  }

  // 7. Risk description for low/medium
  if (riskLevel === 'low' || riskLevel === 'medium') {
    elements.push({
      tag: 'note',
      elements: [
        {
          tag: 'plain_text',
          content: riskDescription,
        },
      ],
    });
  }

  // 8. Action buttons
  const actions: object[] = [
    {
      tag: 'button',
      text: {
        tag: 'plain_text',
        content: '✓ Yes',
      },
      type: riskLevel === 'critical' ? 'danger' : 'primary',
      value: {
        requestId: request.requestId,
        decision: 'approve' as Decision,
      },
    },
  ];

  // Only show "Yes, always" for low/medium risk
  if (riskLevel === 'low' || riskLevel === 'medium') {
    actions.push({
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
    });
  }

  actions.push({
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
  });

  elements.push({
    tag: 'action',
    actions,
  });

  // Build header title based on risk level
  let headerTitle: string;
  if (riskLevel === 'critical') {
    headerTitle = `🚨 Permission Required - ${request.project}`;
  } else if (riskLevel === 'high') {
    headerTitle = `⚠️ Permission Required - ${request.project}`;
  } else {
    headerTitle = `🤖 Permission Required - ${request.project}`;
  }

  return {
    config: {
      wide_screen_mode: true,
      update_multi: true,
    },
    header: {
      template: riskColor,
      title: {
        tag: 'plain_text',
        content: headerTitle,
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
  let statusDescription: string;

  if (decision === 'approve') {
    color = 'green';
    statusText = 'APPROVED';
    statusEmoji = '✅';
    statusDescription = 'コマンドの実行が承認されました。';
  } else if (decision === 'message') {
    color = 'blue';
    statusText = 'MESSAGE SENT';
    statusEmoji = '💬';
    statusDescription = 'Claudeにメッセージが送信されました。';
  } else {
    color = 'red';
    statusText = 'DENIED';
    statusEmoji = '❌';
    statusDescription = 'コマンドの実行が拒否されました。';
  }

  // Get risk level info
  const riskLevel = request.riskLevel || 'medium';
  const riskLabel = RISK_LABELS[riskLevel] || '🟡 Medium Risk';

  let commandDisplay = request.command || JSON.stringify(request.args, null, 2);
  if (commandDisplay.length > 300) {
    commandDisplay = commandDisplay.substring(0, 300) + '...';
  }

  const elements: object[] = [
    // Status description
    {
      tag: 'div',
      text: {
        tag: 'lark_md',
        content: statusDescription,
      },
    },

    { tag: 'hr' },

    // Project and decision info
    {
      tag: 'div',
      fields: [
        {
          is_short: true,
          text: {
            tag: 'lark_md',
            content: `**Project**\n${request.project}`,
          },
        },
        {
          is_short: true,
          text: {
            tag: 'lark_md',
            content: `**Decision**\n${statusEmoji} ${statusText}`,
          },
        },
      ],
    },

    {
      tag: 'div',
      fields: [
        {
          is_short: true,
          text: {
            tag: 'lark_md',
            content: `**Tool**\n\`${request.tool}\``,
          },
        },
        {
          is_short: true,
          text: {
            tag: 'lark_md',
            content: `**Risk Level**\n${riskLabel}`,
          },
        },
      ],
    },

    { tag: 'hr' },

    // Command that was approved/denied
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
  ];

  // Add message if present
  if (message) {
    elements.push(
      { tag: 'hr' },
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `💬 **Message to Claude:**\n${message}`,
        },
      }
    );
  }

  // Note with timestamp
  const timestamp = formatTimestamp(Date.now());
  elements.push({
    tag: 'note',
    elements: [
      {
        tag: 'plain_text',
        content: `Responded at ${timestamp}`,
      },
    ],
  });

  return {
    config: {
      wide_screen_mode: true,
      update_multi: true,
    },
    header: {
      template: color,
      title: {
        tag: 'plain_text',
        content: `${statusEmoji} Permission ${statusText} - ${request.project}`,
      },
    },
    elements,
  };
}

/**
 * Build an expired card
 */
export function buildExpiredCard(request: PermissionRequest): object {
  let commandDisplay = request.command || JSON.stringify(request.args, null, 2);
  if (commandDisplay.length > 300) {
    commandDisplay = commandDisplay.substring(0, 300) + '...';
  }

  // Get risk level info
  const riskLevel = request.riskLevel || 'medium';
  const riskLabel = RISK_LABELS[riskLevel] || '🟡 Medium Risk';

  const timestamp = formatTimestamp(Date.now());

  return {
    config: {
      wide_screen_mode: true,
      update_multi: true,
    },
    header: {
      template: 'grey',
      title: {
        tag: 'plain_text',
        content: `⏰ Permission Request Expired - ${request.project}`,
      },
    },
    elements: [
      // Expiration notice
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: '**このリクエストは期限切れになりました。**\nClaude Codeでコマンドを再実行してください。',
        },
      },

      { tag: 'hr' },

      // Project info
      {
        tag: 'div',
        fields: [
          {
            is_short: true,
            text: {
              tag: 'lark_md',
              content: `**Project**\n${request.project}`,
            },
          },
          {
            is_short: true,
            text: {
              tag: 'lark_md',
              content: `**Tool**\n\`${request.tool}\``,
            },
          },
        ],
      },

      {
        tag: 'div',
        fields: [
          {
            is_short: true,
            text: {
              tag: 'lark_md',
              content: `**Risk Level**\n${riskLabel}`,
            },
          },
          {
            is_short: true,
            text: {
              tag: 'lark_md',
              content: `**Status**\n⏰ Expired`,
            },
          },
        ],
      },

      { tag: 'hr' },

      // Command
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

      // Note
      {
        tag: 'note',
        elements: [
          {
            tag: 'plain_text',
            content: `Expired at ${timestamp} | Request ID: ${request.requestId.substring(0, 8)}...`,
          },
        ],
      },
    ],
  };
}
