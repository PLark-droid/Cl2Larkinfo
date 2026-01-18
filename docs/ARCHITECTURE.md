# Cl2Larkinfo アーキテクチャドキュメント

## 概要

**Cl2Larkinfo** は、Claude Codeの権限承認をLark（ラークスイート）経由で行うWebhookサーバーシステムです。

Claude Codeがコマンド実行時に権限承認を必要とする場合、Larkのチャットに通知を送り、ユーザーが承認/拒否をLark上で行えます。

---

## システムアーキテクチャ

```
┌─────────────────────────────────────────────────────────────────┐
│                      Cl2Larkinfo システム                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐      │
│  │ Claude Code │────▶│  Vercel API │────▶│  Lark Bot   │      │
│  │   (Hook)    │     │  Serverless │     │  通知カード  │      │
│  └─────────────┘     └─────────────┘     └─────────────┘      │
│         │                   │                   │               │
│         │                   │                   │               │
│         ▼                   ▼                   ▼               │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐      │
│  │ /api/notify │────▶│ Vercel KV   │◀────│ /api/lark/  │      │
│  │ (通知送信)   │     │ (状態保存)   │     │ callback    │      │
│  └─────────────┘     └─────────────┘     └─────────────┘      │
│         │                   │                   │               │
│         └───────────────────┼───────────────────┘               │
│                             ▼                                   │
│                    ┌─────────────────┐                         │
│                    │ /api/status/:id │                         │
│                    │ (ポーリング用)   │                         │
│                    └─────────────────┘                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## フロー図

```
Claude Codeがbashコマンド実行しようとする
         │
         ▼
    Hook発火 ─────▶ POST /api/notify
         │              │
         │              ▼
         │        Lark通知カード送信
         │              │
         │              ▼
         │        ユーザーがLarkで
         │        [✓ Yes] or [✗ No]
         │              │
         │              ▼
         │        POST /api/lark/callback
         │              │
         ▼              ▼
    GET /api/status/:id (ポーリング)
         │
         ▼
    承認: コマンド実行
    拒否: コマンドキャンセル
```

---

## APIエンドポイント

### POST /api/notify

Claude Codeから権限リクエストを受け取り、Larkに通知カードを送信します。

**リクエスト:**
```json
{
  "tool": "Bash",
  "command": "npm install",
  "description": "パッケージをインストール",
  "workingDirectory": "/path/to/project",
  "project": "my-project",
  "riskLevel": "medium"
}
```

**レスポンス:**
```json
{
  "success": true,
  "data": {
    "requestId": "uuid-xxxx",
    "expiresAt": 1234567890
  }
}
```

### GET /api/status/:id

リクエストの承認状態をポーリングします。

**レスポンス:**
```json
{
  "success": true,
  "data": {
    "status": "approved",  // pending | approved | denied | expired | message
    "decision": "approve",
    "message": "ユーザーからのメッセージ（オプション）",
    "respondedAt": 1234567890
  }
}
```

### POST /api/lark/callback

Larkのボタンクリックを処理します（Lark Event Subscription）。

**処理内容:**
- URL検証チャレンジ対応
- カードアクション（承認/拒否）処理
- 状態更新とカード表示更新

### POST /api/message

タスク完了通知などの追加メッセージを送信します。

**リクエスト:**
```json
{
  "type": "completion",  // completion | status | question
  "title": "タスク完了",
  "content": "実装が完了しました",
  "project": "my-project"
}
```

---

## ディレクトリ構造

```
Cl2Larkinfo/
├── api/                          # Vercel Serverless Functions
│   ├── notify.ts                 # 権限リクエスト受付
│   ├── message.ts                # メッセージ送信
│   ├── status/
│   │   └── [id].ts               # 状態ポーリング
│   └── lark/
│       └── callback.ts           # Larkコールバック処理
│
├── src/
│   ├── index.ts                  # エントリポイント
│   ├── lark/                     # Lark連携モジュール
│   │   ├── index.ts              # エクスポート
│   │   ├── types.ts              # 型定義
│   │   ├── lark-client.ts        # Lark APIクライアント
│   │   ├── card-builder.ts       # カード構築
│   │   └── signature.ts          # 署名検証
│   │
│   └── store/                    # 状態管理
│       ├── index.ts              # ストアファクトリ
│       ├── types.ts              # インターフェース定義
│       ├── kv-store.ts           # Vercel KV実装
│       └── memory-store.ts       # メモリ実装（開発用）
│
├── config/
│   └── lark.example.json         # Lark設定例
│
├── tests/
│   └── example.test.ts           # テストファイル
│
├── docs/                         # ドキュメント
│   ├── ARCHITECTURE.md           # このファイル
│   └── SETUP.md                  # セットアップガイド
│
├── .claude/                      # Claude Code設定
│   ├── agents/                   # エージェント定義
│   ├── commands/                 # カスタムコマンド
│   └── mcp.json                  # MCPサーバー設定
│
├── .github/
│   └── workflows/                # GitHub Actions
│
├── package.json
├── tsconfig.json
├── vercel.json
├── CLAUDE.md                     # Claude Codeコンテキスト
└── README.md
```

---

## コンポーネント詳細

### Lark APIクライアント (`src/lark/lark-client.ts`)

```typescript
export class LarkClient {
  // テナントアクセストークン取得（自動リフレッシュ）
  private async getAccessToken(): Promise<string>

  // メッセージ送信
  private async sendMessage(chatId: string, msgType: string, content: object): Promise<string>

  // メッセージ更新
  private async updateMessage(messageId: string, content: object): Promise<void>

  // 権限リクエストカード送信
  async sendPermissionRequest(request: PermissionRequest): Promise<string>

  // 決定後のカード更新
  async updateWithDecision(messageId: string, request: PermissionRequest, decision: Decision): Promise<void>

  // 期限切れカード更新
  async updateAsExpired(messageId: string, request: PermissionRequest): Promise<void>
}
```

### カードビルダー (`src/lark/card-builder.ts`)

Larkインタラクティブカードを構築：

- **権限リクエストカード**: コマンド表示 + [Yes] [Yes, always] [No] ボタン
- **レスポンスカード**: 承認/拒否後の状態表示
- **期限切れカード**: タイムアウト時の表示

### ストア (`src/store/`)

**インターフェース:**
```typescript
interface RequestStore {
  set(requestId: string, data: StoredRequest): Promise<void>
  get(requestId: string): Promise<StoredRequest | null>
  setDecision(requestId: string, decision: Decision, respondedBy?: string, message?: string): Promise<boolean>
  setExpired(requestId: string): Promise<boolean>
  delete(requestId: string): Promise<void>
}
```

**実装:**
- `KVStore`: Vercel KV（Redis互換）本番用、TTL自動設定
- `MemoryStore`: メモリストア、ローカル開発用

---

## リスクレベル判定

コマンドの危険度を自動判定：

| レベル | パターン例 | 色 |
|-------|-----------|-----|
| **Critical** | `rm -rf`, `curl \| sh`, `chmod 777`, `dd if=` | 赤 |
| **High** | `git push -f`, `npm publish`, `kubectl delete`, `drop database` | オレンジ |
| **Medium** | `npm install`, `docker run`, `git merge`, `kubectl apply` | 黄 |
| **Low** | その他 | 緑 |

---

## 型定義

### PermissionRequest

```typescript
interface PermissionRequest {
  requestId: string;
  tool: string;
  command?: string;
  description?: string;
  args?: Record<string, unknown>;
  workingDirectory: string;
  project: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  expiresAt: number;
}
```

### Decision

```typescript
type Decision = 'approve' | 'deny' | 'message';
```

### StoredRequest

```typescript
interface StoredRequest {
  request: PermissionRequest;
  status: 'pending' | 'approved' | 'denied' | 'expired' | 'message';
  decision?: DecisionResponse;
  larkMessageId?: string;
  createdAt: number;
}
```

---

## 技術スタック

| カテゴリ | 技術 |
|---------|-----|
| **言語** | TypeScript（strict mode, ES2022） |
| **ランタイム** | Node.js 18+ |
| **フレームワーク** | Vercel Serverless Functions |
| **ストレージ** | Vercel KV（Redis互換） |
| **テスト** | Vitest |
| **外部API** | Lark Open API |

---

## セキュリティ

### 認証

- **API Key認証**: `Authorization: Bearer <LARK_API_KEY>` ヘッダー
- **Lark署名検証**: HMAC-SHA256による署名検証
- **タイムスタンプ検証**: リプレイ攻撃防止（5分以内）

### 署名検証 (`src/lark/signature.ts`)

```typescript
// Larkコールバック署名検証
function verifyLarkSignature(
  timestamp: string,
  nonce: string,
  body: string,
  signature: string,
  verificationToken: string
): boolean

// イベントトークン検証
function verifyEventToken(eventToken: string, verificationToken: string): boolean

// タイムスタンプ検証
function verifyTimestamp(timestamp: number, maxAge?: number): boolean
```

---

## 関連ドキュメント

- [SETUP.md](./SETUP.md) - セットアップガイド
- [README.md](../README.md) - プロジェクト概要
- [CLAUDE.md](../CLAUDE.md) - Claude Codeコンテキスト
