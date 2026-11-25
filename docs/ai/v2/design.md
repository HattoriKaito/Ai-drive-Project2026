# AI対話アプリ V2 設計書（docs/ai/v2/design.md）

- 根拠：docs/ai/v2/requirements.md、V1 の docs/ai/spec.md と src/apps/ai/

## DES-V2-01 画面（REQ-V2-01・02・05、N02）
- URL：/ai/v2（/ai/v2/ でも同じ）。public/ai/v2/index.html・app.js・style.css
- 構成：会話一覧（選択中を強調）、新規会話の作成欄（会話名、1〜50 文字）、選択中の会話名、履歴（最新 20 往復を古い順）、質問欄（1〜2,000 文字）と送信ボタン、状態表示
- 初期表示：会話一覧を取得。選択中の会話 ID は URL のハッシュ（#c=12）に入れ、再読み込み後はハッシュの会話を開き直す（ハッシュがない・存在しない場合は未選択）
- 会話を選ぶと、その会話の履歴を取り直して表示する。前の会話の履歴は消してから描画する
- 通信中は該当する操作を無効化して重複を防ぎ、finally で復帰する
- 送信成功：返った 1 往復を履歴の末尾に追加（最大 20 往復）、質問欄を空にする。失敗：質問欄を残し、固定の案内と問い合わせ ID を表示
- 描画はすべて textContent。V1 の画面（public/ai/）は変更しない
- 公開停止（DEMO_DISABLED）時は「現在AI機能は停止中です。」を表示し、全操作を無効化

## DES-V2-02 API（REQ-V2-01・02・05）
入口：/api/ai/v2。応答形式は V1 と同じ（成功 `{"success":true,...}`、失敗 `{"success":false,"error":{"code","message","requestId"}}`）。

| メソッド・URL | 入力 | 成功 | 主な失敗 |
| --- | --- | --- | --- |
| GET /api/ai/v2/conversations | なし | 200 `{"success":true,"items":[{"id","title","createdAt"}]}`（新しい順、0 件は []） | 503 DB_UNAVAILABLE |
| POST /api/ai/v2/conversations | `{"title":"..."}` | 201 `{"success":true,"item":{...}}` | 400 INVALID_TITLE（欠落・型違い・空白のみ）、400 TITLE_TOO_LONG（51 文字以上） |
| GET /api/ai/v2/conversations/:id/turns | パスの id | 200 `{"success":true,"items":[{"id","conversationId","prompt","response","createdAt"}]}`（最新 20 往復を古い順、0 件は []） | 400 INVALID_ID、404 CONVERSATION_NOT_FOUND |
| POST /api/ai/v2/conversations/:id/turns | `{"prompt":"..."}` | 201 `{"success":true,"item":{...}}`（回答取得と保存の完了後） | 400 INVALID_ID・INVALID_PROMPT・PROMPT_TOO_LONG・INVALID_JSON、413、415、404 CONVERSATION_NOT_FOUND、502 AI_UNAVAILABLE、504 AI_TIMEOUT、503 AI_NOT_CONFIGURED、500 SAVE_FAILED |

- 共通：503 DEMO_DISABLED（停止時）、/api/ai/v2 配下の未定義 URL は 404 NOT_FOUND
- 不正な ID・本文、存在しない会話では Gemini を呼ばない
- ID は `^[1-9][0-9]*$` かつ 2,147,483,647 以下

## DES-V2-03 DB（REQ-V2-02〜05、D01・D02、N03）
sql/ai/040_create_ai_conversations.sql
```sql
CREATE TABLE IF NOT EXISTS ai_conversations (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 50 AND char_length(btrim(title)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS ai_conversation_turns (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES ai_conversations (id),
  prompt TEXT NOT NULL CHECK (char_length(prompt) BETWEEN 1 AND 2000 AND char_length(btrim(prompt)) > 0),
  response_text TEXT NOT NULL CHECK (char_length(response_text) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ai_conversation_turns_conversation_id_id_idx
  ON ai_conversation_turns (conversation_id, id DESC);
```
- 会話一覧：`ORDER BY id DESC`（新しく作った会話が上）
- 往復の取得：`WHERE conversation_id = $1 ORDER BY id DESC LIMIT $2`（画面は 20、文脈は 5）で取り、アプリ側で古い順に並べ直す
- 会話の削除機能は発展課題のため、外部キーに ON DELETE CASCADE は付けない
- 既存テーブルには触れない

## DES-V2-04 文脈の組み立てと送信（REQ-V2-03〜05、N04）
POST /:id/turns の処理順：
1. 会話 ID の形式、Content-Type、本文、質問の長さを検証（失敗なら 4xx、Gemini を呼ばない）
2. 会話の存在確認（なければ 404、Gemini を呼ばない）
3. 同じ会話の保存済み最新 5 往復を取得し、古い順に並べ直す
4. 各往復を `{role:"user",parts:[{text:質問}]}`、`{role:"model",parts:[{text:回答}]}` に展開し、最後に今回の質問を `{role:"user",...}` で加える
5. Gemini を呼ぶ（V1 と同じ：30 秒、retryOptions.attempts 1、maxOutputTokens 1024）。空回答・失敗は保存しない
6. 1 往復として保存し、201 を返す。保存失敗は 500 SAVE_FAILED（回答を返さない）
- 送信内容の確認：サーバーログに `[ai-v2] contents` として requestId・会話 ID・role の並び（例 user,model,user）だけを出す（本文は出さない）。テスト T-V2-02 で A の 2 回目が user,model,user、B の初回が user になることをこのログで確認する

## DES-V2-05 V1 との分離と公開停止（REQ-V2-06、N01）
| 項目 | 内容 |
| --- | --- |
| ファイル | src/apps/ai/v2/（aiV2Router.ts、aiV2Controller.ts、aiV2Service.ts、aiV2Model.ts、aiV2Error.ts）、public/ai/v2/、sql/ai/040 |
| 共有するもの | db.ts の pool、V1 の aiMiddleware.ts（問い合わせ ID、デモ停止）。V1 のファイル自体は変更しない |
| index.ts | import 1 行、/ai/v2 の画面ルート、`app.use('/api/ai/v2', aiV2Router)` を V1 の `/api/ai` より前に登録（V1 Router の 404 に吸い込まれないように） |
| 公開停止 | V1 と同じ AI_DEMO_ENABLED を使う。"true" 以外では V2 の全 API が 503 DEMO_DISABLED。Vercel は全環境 false のまま、GEMINI_API_KEY も登録しない |
| 評価 | ローカル（.env で AI_DEMO_ENABLED='true'） |

## REQ と DES の対応
| REQ | DES |
| --- | --- |
| REQ-V2-01 | DES-V2-01、02 |
| REQ-V2-02 | DES-V2-01、02、03 |
| REQ-V2-03 | DES-V2-03、04 |
| REQ-V2-04 | DES-V2-01、03、04 |
| REQ-V2-05 | DES-V2-01、02、04 |
| REQ-V2-06 | DES-V2-05 |
