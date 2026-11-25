# Ai-drive-Project2026

授業「AI駆動Webアプリ開発実践」で作成している Express＋TypeScript の Web アプリです。Vercel で公開し、DB に Neon（PostgreSQL）を使っています。

| 機能 | 画面 | API |
| --- | --- | --- |
| TOP | / | /api/db-check（DB 接続確認） |
| TODO V1 | /todo | /api/v1/todos |
| TODO V2（優先度・絞り込み） | /todo-v2 | /api/v2/todos |
| AI 質問アプリ | /ai | /api/ai/ask、/api/ai/history |

- 本番：https://ai-drive-project2026-tau-ochre.vercel.app
- 文書：docs/todo/（TODO V1）、docs/todo/v2/（TODO V2）、docs/ai/（AI 質問アプリ）
- SQL：sql/（実行記録は sql/README.md）

## 起動方法

```
npm ci
npm run dev        # http://localhost:3000
npm run build      # TypeScript をビルド
npm start          # ビルド後の起動
```

プロジェクト直下に .env を作成します（Git には含めません）。

## AI 質問アプリ

### 目的と機能
質問を送ると、サーバーが Gemini API に問い合わせて回答を表示し、質問と回答を DB に保存します。履歴は最新 20 件を新しい順に表示します。

### システム構成と秘密情報の扱い
```
ブラウザ（public/ai/app.js） → Express（src/apps/ai/） → Gemini API
                                         └→ Neon（ai_qa_logs）
```
- ブラウザが通信するのは自分の Express（/api/ai）だけです。Gemini へ API キーを付けて送るのはサーバーです
- API キーと DB 接続情報はサーバーの環境変数だけで扱い、コード・Git・ブラウザ・ログ・応答には出しません

### 必要な環境変数（名前のみ）
| 名前 | 用途 |
| --- | --- |
| DATABASE_URL | DB 接続（ローカルは通常接続、Vercel はプール接続） |
| GEMINI_API_KEY | Gemini API のキー（AI を実行する環境だけに設定） |
| GEMINI_MODEL | 使用するモデル（授業指定：gemini-3.5-flash-lite） |
| AI_DEMO_ENABLED | "true" のときだけ AI API を動かす。未設定・false では停止 |

### SQL
Neon の SQL Editor で sql/ai/030_create_ai_qa_logs.sql を実行します。

### 確認手順
1. .env で AI_DEMO_ENABLED='true' にして npm run dev
2. http://localhost:3000/ai を開き、履歴が表示される（0 件なら「履歴がありません」）
3. 質問を送信すると、回答が履歴の先頭に追加される

### 動作の決まり
- 質問は前後の空白を除いて 1〜2,000 文字。JSON 本文は 16KiB まで
- 成功（201）は AI 回答の取得と DB 保存の両方が完了したときだけ。保存に失敗した場合は回答を表示しません
- 履歴 0 件は正常（200・空配列）。DB 障害（503）とは区別して表示します
- 失敗時は質問を残し、固定の案内と問い合わせ ID を表示します。自動では再送しません（ブラウザ・SDK とも）
- 公開停止：AI_DEMO_ENABLED が "true" でない環境では、質問・履歴 API が 503 DEMO_DISABLED を返します。TOP・TODO は動きます。現在 Preview・Production とも停止しており、AI の実行デモはローカルで行います

### 既知の制約
- 過去の会話を AI に送らないため、前の質問を踏まえた回答はしません
- 回答は Markdown として整形せず、文字列のまま表示します
- 認証がないため、AI を有効にした環境では画面を開ける人が誰でも質問でき、履歴も共有されます

### テスト
docs/ai/test-results.md に記録しています。必須確認のうち、画面での履歴 0 件表示（既存データを削除しないため）が未実施です。Production では AI が停止（503 DEMO_DISABLED）し、TOP・TODO が動くことを確認済みです。
