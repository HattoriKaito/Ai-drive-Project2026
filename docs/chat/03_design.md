# リアルタイムチャット 設計書（docs/chat/03_design.md）

- 根拠：docs/chat/01_request.md、docs/chat/02_requirements.md、既存の index.ts・db.ts・src/apps/todo/・src/apps/ai/

## 1 設計項目と要件の対応

| DES | 内容 | 対応 REQ |
| --- | --- | --- |
| DES-CHAT-001 | ファイル構成・責務・URL・登録順・起動処理 | 001、016 |
| DES-CHAT-002 | Socket イベント仕様（接続とルーム参加の区別） | 002、006、011、012、013 |
| DES-CHAT-003 | DB 設計と取得方針（最新 20 件を古い順） | 003、004、008、010 |
| DES-CHAT-004 | 入室・投稿・配信・切断・再入室の順序、履歴と新着の統合、リスナー | 002〜005、007、012 |
| DES-CHAT-005 | 定員管理（1 台・複数台）、席の回収、複数台の新着同期 | 006〜010 |
| DES-CHAT-006 | 入力検証・XSS・秘密情報・例外処理 | 011、013〜015 |

## 2 DES-CHAT-001 ファイル構成と起動処理

| ファイル | 責務 |
| --- | --- |
| src/apps/chat/chatRouter.ts | GET /chat の登録 |
| src/apps/chat/chatController.ts | /chat の EJS 表示（文字数上限を画面へ渡す） |
| src/apps/chat/chatService.ts | Socket.IO の接続処理：入室（席の確保）、投稿の検証・保存・配信、切断時の席解放、席の定期更新、複数台向けの DB 同期 |
| src/apps/chat/chatModel.ts | chat_messages・chat_room_seats への SQL（保存、最新 20 件、席の確保・解放・更新、新着の差分取得） |
| src/apps/chat/chatValidation.ts | ユーザー名・コメントの検証（サーバー側の正） |
| views/chat/index.ejs | 画面。サーバーから渡す値は <%= %> で出力 |
| public/chat/chat.js・chat.css | Socket.IO クライアント、画面の状態、描画（textContent） |
| sql/chat/040_create_chat_messages.sql | テーブル定義 |
| index.ts | Router の登録と、HTTP サーバー＋Socket.IO の起動 |

- URL：画面 GET /chat（/chat/ も同じ）、静的ファイル /chat/chat.js・/chat/chat.css、Socket.IO の既定パス /socket.io/（クライアントスクリプト /socket.io/socket.io.js も Socket.IO が配信）
- HTTP の API は作らない。履歴は入室の結果として Socket で返すため、「参加資格のない要求に履歴を返さない」を入室処理だけで判定できる
- 登録順：既存の express.static（redirect: false）→ 既存ルート → chatRouter → 既存の /api/ai/v2・/api/ai。/chat は他の URL と重ならないため、既存の 404・エラー処理に影響しない
- 起動処理：`app.listen(port)` を `const httpServer = http.createServer(app); initChat(httpServer); httpServer.listen(port)` に置き換える。同じポートで二重に待機しない。ポートは `Number(process.env.PORT) || 3000`（2 台の確認で 3001 を使うため）

## 3 DES-CHAT-002 Socket イベント

「接続」は Socket.IO の connect（まだ参加者ではない）、「参加」は chat:join で席を確保し、ルーム chat:default に所属した状態を指す。未参加の接続には履歴・新着を送らず、投稿も受け付けない。

| イベント | 送信元 → 受信先 | payload | ack・結果 | 失敗時 |
| --- | --- | --- | --- | --- |
| chat:join | ブラウザ → サーバー | なし | 成功 `{ok:true, messages:[...最新20件・古い順]}` | `{ok:false, code:"ROOM_FULL"}`（満席、ルームに入れない）、`{ok:false, code:"DB_UNAVAILABLE" / "JOIN_FAILED"}` |
| chat:send | ブラウザ → サーバー | `{username, comment}` | 成功 `{ok:true, id}` | `{ok:false, code}`：NOT_JOINED、INVALID_USERNAME、USERNAME_TOO_LONG、INVALID_COMMENT、COMMENT_TOO_LONG、SAVE_FAILED |
| chat:message | サーバー → 同じルームの参加者（送信者を含む） | `{id, username, comment, createdAt}` | なし | 保存に失敗した投稿は送らない |

- 投稿の行は chat:message を受け取ったときだけ画面に追加する（ack では追加しない）。送信者の画面に同じ投稿が二重に出ない
- 既に参加済みの接続が chat:join を再送した場合は、新たに席を取らず履歴だけ返す
- ack はサーバーが受理・保存したことの結果で、他の参加者が読んだことは表さない

## 4 DES-CHAT-003 DB

```sql
CREATE TABLE IF NOT EXISTS chat_messages (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  room_id TEXT NOT NULL DEFAULT 'default',
  username TEXT NOT NULL CHECK (char_length(username) BETWEEN 1 AND 20 AND char_length(btrim(username)) > 0),
  comment TEXT NOT NULL CHECK (char_length(comment) BETWEEN 1 AND 500 AND char_length(btrim(comment)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS chat_messages_room_id_id_idx ON chat_messages (room_id, id DESC);

CREATE TABLE IF NOT EXISTS chat_room_seats (
  seat_id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL DEFAULT 'default',
  instance_id TEXT NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS chat_room_seats_room_id_last_seen_idx ON chat_room_seats (room_id, last_seen_at);
```

- すべてプレースホルダ付きの SQL
- 最新 20 件を古い順：`SELECT ... FROM (SELECT ... WHERE room_id = $1 ORDER BY id DESC LIMIT 20) t ORDER BY id ASC`。ID は投稿順に DB が採番するため、ID の順を表示順とする（作成日時は表示用）
- 新着の差分（複数台の同期）：`WHERE room_id = $1 AND id > $2 ORDER BY id ASC LIMIT 100`

## 5 DES-CHAT-004 処理の順序

### 5.1 入室
1. ブラウザが /chat を開き、`io()` で接続する。接続したら chat:join を送る
2. サーバーが DB のトランザクションで席を確保する（6 章）。満席なら ROOM_FULL を返し、ルームに入れない
3. 席を確保できたら `socket.join('chat:default')` を行い、その後に最新 20 件を取得して ack で返す
4. 3 の取得に失敗したら、席を解放してルームから外し、DB_UNAVAILABLE を返す
5. ブラウザは chat:join を送ってから ack を受け取るまでに届いた chat:message を一時的にためておき、ack の履歴と投稿 ID でまとめて 1 件にし、ID の順に表示する

### 5.2 投稿
1. ブラウザは送信前に長さを確認する（サーバーでも必ず確認する）
2. サーバーは参加済みか → 型 → 前後の空白を除いた長さの順に検証する。不正なら ack で理由を返し、保存・配信しない
3. DB に保存し、DB が確定した ID・ユーザー名・コメント・作成日時を受け取る
4. 保存に成功した投稿だけを `io.to('chat:default').emit('chat:message', ...)` で配信し、送信者に ack `{ok:true,id}` を返す
5. 保存に失敗したら SAVE_FAILED を返し、配信しない。ブラウザは入力を残す
6. ack が届かないまま切断した場合は「保存されたか不明」として、再接続後の履歴で確認するよう案内する（自動で再送しない）

### 5.3 切断と再入室
- 切断（タブを閉じた、通信が切れた）したら、サーバーは席を解放する
- ブラウザは切断中、送信ボタンを無効にして「再接続中」と表示する。Socket.IO の自動再接続で connect が再び起きたら、5.1 と同じ手順で再入室し、最新 20 件を取り直す（画面の投稿は取り直した結果に置き換える）
- 再入室で満席なら満席案内を出す
- イベントリスナー（connect・disconnect・chat:message）はページ読み込み時に 1 回だけ登録し、connect のたびに登録しない。再接続を繰り返してもリスナーが増えない

## 6 DES-CHAT-005 定員管理と複数台

### 6.1 席の確保（1 台・複数台共通）
定員はサーバーのメモリではなく DB の chat_room_seats で数える。どのサーバーも同じ DB を見るため、複数台でも合計で 5 席を守れる。
1. `BEGIN`
2. `SELECT pg_advisory_xact_lock(hashtext('chat_room:' || $1))`：同じルームの席の確保を 1 つずつ順番に実行する（同時入室でも 6 席目は作られない）
3. 期限切れ（last_seen_at が 60 秒より前）の席を削除
4. 有効な席を数え、5 未満なら自分の席（seat_id はサーバーが作る UUID）を追加
5. `COMMIT`。確認と確保の間に別の入室処理が割り込まない

### 6.2 席の解放と回収
- 切断時：`DELETE FROM chat_room_seats WHERE seat_id = $1`
- 各サーバーは 20 秒ごとに、自分が持つ席の last_seen_at を更新する（`WHERE seat_id = ANY($1)`）
- サーバーが異常終了して解放できなかった席は、60 秒更新されなければ 6.1 の手順 3 で回収される
- 席の更新に失敗しても接続は切らずにログを残す（次の更新で回復する）

### 6.3 複数台の新着同期（DB 同期を採用）
- Redis は使わない（追加のサービスと接続情報が必要になるため）。代わりに、参加者がいるサーバーは 2 秒ごとに DB から「最後に確認した ID より大きい新着」を取得し、まだ自分が配信していない投稿を自分のルームに配信する
- 自分で保存した投稿は即時に配信し、その ID を記録して二重配信を防ぐ。ブラウザ側も ID で重複を除く
- 他のサーバーに接続した人の投稿は最大約 2 秒遅れて届く
- 起動時に「最後に確認した ID」を現在の最大 ID にしておき、古い投稿を新着として配信しない

### 6.4 2 台での確認方法
同じ .env で `npm run dev`（3000）と、別のターミナルで `PORT=3001` を指定した起動を行う。ブラウザ A は http://localhost:3000/chat、B は http://localhost:3001/chat に接続し、どちらのポートか記録する。定員は 2 台合計 4 接続の状態で、両方から同時に入室を試し、成功が 1 件だけになることを確認する。

### 6.5 Vercel での扱い（要確認）
Vercel では Functions の実行時間上限で接続が切れ、リクエストが別インスタンスへ振り分けられる場合がある。再接続（5.3）・DB の定員（6.1）・DB 同期（6.3）で補うが、HTTP long-polling の継続が別インスタンスに届くと接続できない可能性がある。公開環境での動作は確認結果を記録し、評価はローカルで行う。

## 7 DES-CHAT-006 検証・XSS・秘密情報・例外

- 入力検証：chatValidation.ts をサーバーの正とし、ブラウザは同じ上限で事前に案内する。前後の空白を除いた Unicode コードポイント数で数え、空白を除いた値を保存する
- XSS：EJS は <%= %> だけを使う。ブラウザはユーザー名・コメントを textContent で表示し、innerHTML を使わない
- 秘密情報：DB 接続は既存の db.ts（DATABASE_URL）を使い、ブラウザには渡さない。新しい環境変数は PORT だけ
- 例外処理：HTTP（/chat）は既存のルーティング・404 の流れに従う。Socket の各イベント処理は try/catch で捕まえ、ログには段階・エラー種別だけを出し、ブラウザには固定のコードを ack で返す。イベント処理の例外でサーバーが停止しない

## 8 前提と未確定事項
- 前提：単一ルーム（default）、ログインなし、ユーザー名は自己申告
- 要確認：文字数上限（講師の指定）、Vercel での WebSocket・long-polling の動作、授業後のデータ削除
