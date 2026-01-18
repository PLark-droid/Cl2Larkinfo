# Cl2Larkinfo セットアップガイド

Claude Codeの権限承認をLark経由で行うシステムのセットアップ手順です。

---

## 前提条件

- Node.js 18以上
- Vercelアカウント（本番デプロイ用）
- Lark（ラークスイート）アカウント
- Lark開発者アカウント

---

## 1. Lark Botの作成

### 1.1 アプリ作成

1. [Lark Open Platform](https://open.larksuite.com/app) にアクセス
2. 「Create Custom App」をクリック
3. アプリ名を入力（例: Claude Code Permission Bot）
4. 作成後、以下の情報をメモ:
   - **App ID**: `cli_xxxxxxxxxxxxxxxx`
   - **App Secret**: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### 1.2 Bot機能の有効化

1. アプリ設定 → 「Add Abilities」
2. 「Bot」を有効化
3. Bot名とアイコンを設定

### 1.3 権限設定

「Permissions & Scopes」で以下を追加:
- `im:message` - メッセージ送信
- `im:message:send_as_bot` - Botとしてメッセージ送信
- `im:chat:readonly` - チャット情報読み取り

### 1.4 Event Subscription設定

1. 「Event Subscriptions」を開く
2. Request URLを設定: `https://your-app.vercel.app/api/lark/callback`
3. Verification Tokenをメモ
4. イベント追加: `card.action.trigger`（カードアクション）

### 1.5 チャットにBotを追加

1. Larkで通知を受け取りたいグループチャットを開く
2. 設定 → メンバー → Botを追加
3. チャットIDを取得（URLから `oc_xxxxxxxx` 形式）

---

## 2. プロジェクトセットアップ

### 2.1 リポジトリクローン

```bash
git clone https://github.com/your-username/Cl2Larkinfo.git
cd Cl2Larkinfo/Cl2Larkinfo
```

### 2.2 依存関係インストール

```bash
npm install
```

### 2.3 環境変数設定

```bash
cp .env.example .env
```

`.env` を編集:

```bash
# Lark Bot設定
LARK_APP_ID=cli_xxxxxxxxxxxxxxxx
LARK_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
LARK_VERIFICATION_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
LARK_CHAT_ID=oc_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# API認証キー（任意の安全な文字列）
LARK_API_KEY=your-secure-random-api-key

# タイムアウト（ミリ秒、デフォルト: 5分）
LARK_TIMEOUT=300000
```

---

## 3. ローカル開発

### 3.1 開発サーバー起動

```bash
npm run dev
```

### 3.2 ngrokでトンネリング（Larkコールバック用）

```bash
ngrok http 3000
```

ngrokのURLをLark Event SubscriptionのRequest URLに設定。

### 3.3 テスト実行

```bash
npm test
```

### 3.4 型チェック

```bash
npm run typecheck
```

---

## 4. Vercelデプロイ

### 4.1 Vercel CLIインストール

```bash
npm i -g vercel
```

### 4.2 プロジェクトリンク

```bash
vercel link
```

### 4.3 環境変数設定

```bash
vercel env add LARK_APP_ID
vercel env add LARK_APP_SECRET
vercel env add LARK_VERIFICATION_TOKEN
vercel env add LARK_CHAT_ID
vercel env add LARK_API_KEY
vercel env add LARK_TIMEOUT
```

### 4.4 Vercel KV設定

1. [Vercel Dashboard](https://vercel.com/dashboard) でプロジェクトを開く
2. Storage → Create Database → KV
3. 自動的に環境変数が設定される:
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`

### 4.5 デプロイ

```bash
vercel --prod
```

### 4.6 Lark設定更新

LarkのEvent Subscription URLを本番URLに変更:
```
https://your-app.vercel.app/api/lark/callback
```

---

## 5. Claude Code Hook設定

Claude Codeのhook設定で、権限リクエスト時にAPIを呼び出すスクリプトを設定します。

### 5.1 Hookスクリプト例

```bash
#!/bin/bash
# .claude/hooks/permission-request.sh

WEBHOOK_SERVER="${LARK_WEBHOOK_SERVER:-https://your-app.vercel.app}"
API_KEY="${LARK_API_KEY}"

# 通知送信
response=$(curl -s -X POST "$WEBHOOK_SERVER/api/notify" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d "{
    \"tool\": \"$TOOL\",
    \"command\": \"$COMMAND\",
    \"description\": \"$DESCRIPTION\",
    \"workingDirectory\": \"$PWD\",
    \"project\": \"$(basename $PWD)\"
  }")

request_id=$(echo "$response" | jq -r '.data.requestId')

# ポーリングで結果待機
while true; do
  status_response=$(curl -s -X GET "$WEBHOOK_SERVER/api/status/$request_id" \
    -H "Authorization: Bearer $API_KEY")

  status=$(echo "$status_response" | jq -r '.data.status')

  case "$status" in
    "approved")
      exit 0  # 承認 - コマンド実行
      ;;
    "denied")
      exit 1  # 拒否 - コマンドキャンセル
      ;;
    "expired")
      exit 1  # 期限切れ
      ;;
    "pending")
      sleep 2  # 待機継続
      ;;
  esac
done
```

### 5.2 Claude Code設定

`.claude/settings.json` に追加:

```json
{
  "hooks": {
    "permissionRequest": ".claude/hooks/permission-request.sh"
  }
}
```

---

## 6. 動作確認

### 6.1 通知送信テスト

```bash
curl -X POST https://your-app.vercel.app/api/notify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "tool": "Bash",
    "command": "npm install express",
    "description": "Expressパッケージをインストール",
    "workingDirectory": "/home/user/project",
    "project": "my-project"
  }'
```

### 6.2 期待される結果

1. Larkチャットに通知カードが届く
2. カードにコマンド内容と承認ボタンが表示される
3. ボタンをクリックすると承認/拒否が記録される
4. ステータスAPIで結果を取得できる

---

## 7. トラブルシューティング

### Lark通知が届かない

1. Bot権限を確認
2. チャットIDが正しいか確認
3. BotがチャットのメンバーになっているかEnv確認

### コールバックが失敗する

1. Verification Tokenを確認
2. Event SubscriptionのURLが正しいか確認
3. Vercelログでエラーを確認

### 状態が取得できない

1. Vercel KVが設定されているか確認
2. `KV_REST_API_URL`と`KV_REST_API_TOKEN`が設定されているか確認
3. ローカルではメモリストアが使用される（再起動で消える）

---

## 8. 環境変数一覧

| 変数名 | 必須 | 説明 |
|-------|------|------|
| `LARK_APP_ID` | Yes | Lark App ID |
| `LARK_APP_SECRET` | Yes | Lark App Secret |
| `LARK_VERIFICATION_TOKEN` | Yes | Larkイベント検証トークン |
| `LARK_CHAT_ID` | Yes | 通知先チャットID |
| `LARK_API_KEY` | No | API認証キー（推奨） |
| `LARK_TIMEOUT` | No | タイムアウト（デフォルト: 300000ms） |
| `KV_REST_API_URL` | Auto | Vercel KV URL（自動設定） |
| `KV_REST_API_TOKEN` | Auto | Vercel KV Token（自動設定） |

---

## 関連ドキュメント

- [ARCHITECTURE.md](./ARCHITECTURE.md) - アーキテクチャ詳細
- [README.md](../README.md) - プロジェクト概要
- [config/lark.example.json](../config/lark.example.json) - 設定例
