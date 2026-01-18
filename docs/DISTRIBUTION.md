# Cl2Larkinfo 配布ガイド

このドキュメントでは、Cl2Larkinfo（Claude Code Lark権限通知システム）を他のプロジェクトにコピーして使用する方法を説明します。

---

## クイックスタート

### 必要なもの

1. **Node.js 18+**
2. **Vercelアカウント**（無料枠で十分）
3. **Lark（ラークスイート）アカウント**

### 5分セットアップ

```bash
# 1. クローン
git clone https://github.com/your-org/Cl2Larkinfo.git
cd Cl2Larkinfo/Cl2Larkinfo

# 2. 依存関係インストール
npm install

# 3. 環境変数設定
cp .env.example .env
# .envを編集してLark認証情報を入力

# 4. デプロイ
vercel --prod
```

---

## コピーに必要なファイル

### 最小構成（必須ファイル）

```
Cl2Larkinfo/
├── api/
│   ├── notify.ts           # 通知API
│   ├── message.ts          # メッセージAPI
│   ├── status/
│   │   └── [id].ts         # ステータスAPI
│   └── lark/
│       └── callback.ts     # Larkコールバック
│
├── src/
│   ├── lark/
│   │   ├── index.ts
│   │   ├── types.ts
│   │   ├── lark-client.ts
│   │   ├── card-builder.ts
│   │   └── signature.ts
│   │
│   └── store/
│       ├── index.ts
│       ├── types.ts
│       ├── kv-store.ts
│       └── memory-store.ts
│
├── package.json
├── tsconfig.json
├── vercel.json
└── .env.example
```

### 推奨構成（ドキュメント含む）

上記に加えて:

```
├── docs/
│   ├── ARCHITECTURE.md
│   ├── SETUP.md
│   └── DISTRIBUTION.md
│
├── config/
│   └── lark.example.json
│
├── tests/
│   └── example.test.ts
│
└── README.md
```

---

## 必要な依存関係

`package.json` の依存関係:

```json
{
  "dependencies": {
    "@vercel/kv": "^2.0.0",
    "@vercel/node": "^3.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "typescript": "^5.8.3",
    "vitest": "^3.2.4"
  }
}
```

---

## 環境変数テンプレート

```bash
# ===========================================
# Lark Bot設定（必須）
# ===========================================

# Lark Open Platformで取得
LARK_APP_ID=cli_xxxxxxxxxxxxxxxx
LARK_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Event Subscriptionで取得
LARK_VERIFICATION_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# 通知先チャットID（URLから取得）
LARK_CHAT_ID=oc_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# ===========================================
# セキュリティ設定（推奨）
# ===========================================

# API認証キー（任意の安全な文字列を生成）
LARK_API_KEY=your-secure-random-api-key-here

# タイムアウト（ミリ秒、デフォルト: 5分）
LARK_TIMEOUT=300000

# ===========================================
# Vercel KV（本番環境で自動設定）
# ===========================================
# KV_REST_API_URL=自動設定
# KV_REST_API_TOKEN=自動設定
```

---

## カスタマイズポイント

### 1. リスクレベル判定のカスタマイズ

`api/notify.ts` の `determineRiskLevel()` 関数を編集:

```typescript
function determineRiskLevel(tool: string, command?: string): RiskLevel {
  // カスタムパターンを追加
  const myCustomPatterns = [
    /my-dangerous-command/i,
  ];

  // 既存のパターンに追加
  for (const pattern of myCustomPatterns) {
    if (pattern.test(command || '')) {
      return 'critical';
    }
  }

  // デフォルトロジック続行...
}
```

### 2. カードデザインのカスタマイズ

`src/lark/card-builder.ts` を編集してカードの見た目を変更:

```typescript
export function buildPermissionCard(request: PermissionRequest): object {
  return {
    header: {
      template: 'blue',  // 色を変更
      title: {
        content: `カスタムタイトル: ${request.project}`,
      },
    },
    // ボタンや表示内容をカスタマイズ
  };
}
```

### 3. 追加のボタンアクション

`src/lark/card-builder.ts` でボタンを追加:

```typescript
{
  tag: 'button',
  text: {
    tag: 'plain_text',
    content: 'カスタムアクション',
  },
  type: 'default',
  value: {
    requestId: request.requestId,
    decision: 'custom',  // types.tsにも追加が必要
  },
}
```

---

## 他のチャットツールへの移植

### Slack版への移植

1. `src/lark/` を `src/slack/` にコピー
2. `lark-client.ts` を Slack API用に書き換え
3. `card-builder.ts` を Slack Block Kit形式に変更
4. `api/lark/callback.ts` を Slack Events API用に変更

### Discord版への移植

1. Discord Bot APIを使用
2. Embed形式でメッセージ構築
3. Interaction（ボタン）APIでコールバック処理

---

## API仕様サマリー

### POST /api/notify

権限リクエスト送信

```bash
curl -X POST https://your-app.vercel.app/api/notify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "tool": "Bash",
    "command": "npm install",
    "workingDirectory": "/path/to/project"
  }'
```

### GET /api/status/:id

状態ポーリング

```bash
curl https://your-app.vercel.app/api/status/uuid-xxxx \
  -H "Authorization: Bearer $API_KEY"
```

### POST /api/message

メッセージ送信

```bash
curl -X POST https://your-app.vercel.app/api/message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "type": "completion",
    "title": "タスク完了",
    "content": "実装が完了しました"
  }'
```

---

## ライセンス

MIT License - 自由に使用・改変・再配布可能です。

---

## サポート

- **Issues**: https://github.com/your-org/Cl2Larkinfo/issues
- **Documentation**: [docs/](../docs/)
