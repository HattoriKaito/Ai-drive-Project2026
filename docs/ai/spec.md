# AI質問機能 設計書（docs/ai/spec.md）

- 根拠：docs/ai/requirements.md（REQ-AI-*）
- 作業ブランチ：feature/ai-app

## 1 ブラウザ・Express・Gemini API・DB の役割（DES-AI-001）

```
ブラウザ（public/ai/app.js）
  │ fetch（キーなし）  POST /api/ai/ask, GET /api/ai/history
  ▼
Express（src/apps/ai/）── デモ停止 → JSON解析 → 入力検証 → Gemini 呼出し → DB 保存 → 応答
  │ GEMINI_API_KEY を付けて送信            │ DATABASE_URL で接続
  ▼                                         ▼
Gemini API                               Neon（ai_qa_logs）
```

- ブラウザが通信する相手は自分の Express だけ。Gemini へキーを付けて送るのはサーバー
- キー・接続情報はサーバーの環境変数だけにあり、ブラウザへ配信しない

## 2 ファイル構成と責務（DES-AI-002）

| ファイル | 責務 |
| --- | --- |
| index.ts | /ai 画面と /api/ai Router の登録（追記は最小限） |
| db.ts | 既存の共有 DB 接続（変更しない） |
| src/apps/ai/aiRouter.ts | /api/ai 配下の受付。デモ停止 → JSON 解析（16KiB）→ 各ルート → AI 用エラー処理の順に登録 |
| src/apps/ai/aiMiddleware.ts | デモ停止（AI_DEMO_ENABLED）、問い合わせ ID の付与 |
| src/apps/ai/aiError.ts | 公開用エラー（AiPublicError）と固定コード・文言の一覧、応答の送信 |
| src/apps/ai/aiController.ts | 入力検証 → 生成 → 保存 → 201 の順序を制御。失敗を公開用エラーに変換 |
| src/apps/ai/aiService.ts | Gemini との通信（@google/genai）。待機 30 秒、再試行なし、出力 1024 トークン |
| src/apps/ai/aiModel.ts | ai_qa_logs への INSERT と最新 20 件の SELECT、列名の変換 |
| public/ai/index.html・app.js・style.css | 画面、fetch、状態表示、安全な描画 |
| sql/ai/030_create_ai_qa_logs.sql | テーブル・制約・インデックス |

- 授業テキスト 7.2 にある local.ts は作らない。既存の index.ts が app.listen でローカル・Vercel とも起動できており、構成を変えると既存機能に影響するため

## 3 画面と状態（DES-AI-003）

画面 URL：/ai（public/ai/index.html を返す）。/ai/ と /ai/index.html でも同じ画面を表示する。

| 要素 | 内容 |
| --- | --- |
| 質問欄 | textarea、送信ボタン、文字数表示（コードポイント数／2000） |
| 状態表示 | 初期取得中・送信中（待機）・成功・失敗の案内（role="status" / role="alert"） |
| 履歴一覧 | 質問・回答・日時を新しい順に最大 20 件 |
| 0 件表示 | 「履歴がありません」 |
| 導線 | TOP・TODO へのリンク |

| 状態 | 画面の動き |
| --- | --- |
| 初期取得中 | 質問欄・送信ボタンを無効化し「履歴を読み込み中…」 |
| 0 件 | 「履歴がありません」を表示し、操作可能にする |
| 取得失敗 | 0 件表示は出さず「履歴を取得できませんでした」。質問の送信は可能にする |
| 送信中 | aria-busy、ボタンと質問欄を無効化（重複送信防止）、「AIが回答を作成中…」 |
| 成功 | 返った 1 件を履歴の先頭に追加（最大 20 件）、質問欄を空にする |
| 失敗 | 質問欄の内容を残し、コードに応じた固定の案内を表示。finally で操作可能に戻す |
| 停止中 | DEMO_DISABLED のときは「現在AI機能は停止中です」と表示し、送信ボタンを無効化 |

## 4 API（DES-AI-004）

### 4.1 共通
- 成功：`{"success":true, ...}`、失敗：`{"success":false,"error":{"code":"...","message":"...","requestId":"..."}}`
- 応答の項目：`{"id":1,"prompt":"...","response":"...","createdAt":"2026-11-25T07:00:00.000Z"}`

### 4.2 POST /api/ai/ask
| 項目 | 内容 |
| --- | --- |
| 本文 | `{"prompt":"日本の首都はどこですか？"}`（Content-Type: application/json、16KiB まで） |
| 成功 | 201 `{"success":true,"item":{...}}`（AI 回答取得と DB 保存の両方が完了したときだけ） |
| 400 INVALID_JSON | JSON の形式が不正 |
| 400 INVALID_PROMPT | 本文がオブジェクトでない、prompt がない・文字列でない、前後空白除去後 0 文字 |
| 400 PROMPT_TOO_LONG | 前後空白除去後 2,001 コードポイント以上 |
| 413 PAYLOAD_TOO_LARGE | 本文が 16KiB 超 |
| 415 UNSUPPORTED_MEDIA_TYPE | Content-Type が application/json でない |
| 502 AI_UNAVAILABLE | Gemini の通信エラー・エラー応答・空回答・安全フィルターで回答なし |
| 503 AI_NOT_CONFIGURED | GEMINI_API_KEY または GEMINI_MODEL が未設定 |
| 504 AI_TIMEOUT | 30 秒以内に応答がない |
| 500 SAVE_FAILED | AI 回答は得たが DB 保存に失敗（回答は返さない） |
| 503 DEMO_DISABLED | AI_DEMO_ENABLED が "true" でない |

### 4.3 GET /api/ai/history
| 項目 | 内容 |
| --- | --- |
| 成功 | 200 `{"success":true,"items":[...]}`（0 件なら `items: []`） |
| 503 DB_UNAVAILABLE | DB に接続できない |
| 500 HISTORY_FAILED | その他の取得失敗 |
| 503 DEMO_DISABLED | AI_DEMO_ENABLED が "true" でない |

### 4.4 その他
/api/ai 配下の未定義 URL・メソッドは 404 NOT_FOUND（JSON）。

## 5 DB：ai_qa_logs（DES-AI-005）

```sql
CREATE TABLE IF NOT EXISTS ai_qa_logs (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  prompt TEXT NOT NULL CHECK (
    char_length(prompt) BETWEEN 1 AND 2000
    AND char_length(btrim(prompt)) > 0
  ),
  response_text TEXT NOT NULL CHECK (char_length(response_text) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ai_qa_logs_created_at_id_idx
  ON ai_qa_logs (created_at DESC, id DESC);
```

- 履歴：`SELECT id, prompt, response_text, created_at FROM ai_qa_logs ORDER BY created_at DESC, id DESC LIMIT 20`
- 保存：`INSERT INTO ai_qa_logs (prompt, response_text) VALUES ($1, $2) RETURNING ...`
- 既存テーブルには触れない。SQL は Neon SQL Editor で手動実行し sql/README.md に記録

## 6 登録順（DES-AI-006）

index.ts（既存の express.static の後、既存ルートと並べて）：
```ts
app.get(['/ai', '/ai/'], (_req, res) => res.sendFile(path.join(process.cwd(), 'public', 'ai', 'index.html')));
app.use('/api/ai', aiRouter);
```
aiRouter 内の順序：
1. 問い合わせ ID の付与
2. デモ停止（AI_DEMO_ENABLED が "true" でなければ 503）← AI 呼出し・履歴取得・JSON 解析より前
3. AI 専用 JSON 解析 `express.json({ limit: 16384, type: 'application/json' })`（index.ts に全体の JSON 解析はなく、TODO も各 Router 内で解析しているため衝突しない）
4. GET /history、POST /ask
5. /api/ai 内の 404
6. AI 用エラー処理（JSON 不正 400、16KiB 超 413、その他は 500、生の例外は返さない）

## 7 セキュリティ（DES-AI-007）
- 秘密情報：GEMINI_API_KEY・DATABASE_URL はサーバーの process.env だけで読む。public/ に置かない。.env は .gitignore 済み
- XSS：画面は textContent で描画し、innerHTML を使わない
- SQL：プレースホルダのみ
- ログ：requestId、処理段階、エラーの種類（name・status・code）だけを出す。質問本文・回答・キー・接続文字列は出さない

## 8 待機・再試行・部分成功（DES-AI-008）
- Gemini：`httpOptions: { timeout: 30000, retryOptions: { attempts: 1 } }`（SDK の既定は 5 回の再試行のため明示的に 1 にする）、`maxOutputTokens: 1024`
- ブラウザ：AbortController で 45 秒。自動再送しない
- AI 成功・DB 失敗：500 SAVE_FAILED を返し、回答は表示しない（保存されていない回答を成功扱いにしない）。利用者は質問欄に残った質問を自分で再送できる
- 空回答：502 AI_UNAVAILABLE、保存しない

## 9 Preview と Production（DES-AI-009）
| 環境 | AI_DEMO_ENABLED | 条件 |
| --- | --- | --- |
| Local | true（.env） | 本人の PC だけで実行 |
| Preview | 最初は false。Deployment Protection を有効にし、未ログインで遮断されることを確認できた場合だけ true | 保護を確認できなければ false のまま、ローカルでデモ |
| Production | false（標準） | 両 API が 503／DEMO_DISABLED。TOP・TODO は動く |

GEMINI_API_KEY・GEMINI_MODEL は、実行する環境（Preview）にだけ登録する。

## 10 REQ・DES・確認方法の対応
| REQ | DES | 確認 |
| --- | --- | --- |
| F001 | 003、006 | /ai の表示、TOP からの導線 |
| F002 | 001、008 | T01：正常質問 |
| F003 | 004、005、008 | T01：DB の行と応答の一致 |
| F004 | 004、005 | T02：再読込、20 件・順序 |
| F005 | 003、004 | T03：0 件、DB 障害時の表示 |
| F006 | 004、006 | T04 ほか：空白・長さ・型・JSON 不正・16KiB 超 |
| F007 | 002、004、008 | T10：AI 失敗、SAVE_FAILED |
| F008 | 003 | T12：オフライン、T13：連打 |
| F009 | 008 | SDK 設定の確認、自動再送がないこと |
| F010 | 006、009 | false で両 API 503、TOP・TODO 正常 |
| N002 | 001、007 | T16：Sources・Network・Git 差分 |
| N003 | 006 | T20：TOP・TODO |
| N004 | 003、007 | T14：HTML に見える文字列 |
| D001〜D004 | 005 | SQL と応答のキー |
