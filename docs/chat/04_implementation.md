# リアルタイムチャット 実装手順書（docs/chat/04_implementation.md）

- 根拠：docs/chat/02_requirements.md、docs/chat/03_design.md
- 起動・ビルド：`npm run dev`（tsx watch ./index.ts）、`npm run build`（tsc）、`npm start`。型検査は `npm run build`
- DB 接続：既存の db.ts（DATABASE_URL）を再利用。新しい環境変数は PORT（任意）のみ

## A 既存アプリの確認・Socket.IO の追加・接続ログ
| 項目 | 内容 |
| --- | --- |
| 目的 | 既存機能が動くことを確認し、/chat と Socket.IO の接続を用意する（REQ-CHAT-001、016／DES-CHAT-001） |
| 変更ファイル | package.json（socket.io）、index.ts、src/apps/chat/chatRouter.ts・chatController.ts、views/chat/index.ejs、public/chat/ |
| コマンド（プロジェクト直下） | `git switch -c feature/chat`、`npm install socket.io`、`npm run dev` |
| 処理 | `app.listen` を `http.createServer(app)` ＋ `initChat(httpServer)` ＋ `httpServer.listen` に置き換え（二重に待機しない） |
| 確認 | /chat が表示される。DevTools の Network に /socket.io/ の通信（WS 欄、または Fetch/XHR の polling）がある。/、/todo、/ai、存在しない URL の 404 が従来どおり |
| 切り分け | /chat が 404 → chatRouter の登録位置。接続できない → /socket.io/socket.io.js の取得、initChat に渡した HTTP サーバー |

## B SQL の適用と Model
| 項目 | 内容 |
| --- | --- |
| 目的 | 投稿の保存と最新 20 件の取得、席の表（REQ-CHAT-003、004、006／DES-CHAT-003） |
| 変更ファイル | sql/chat/040_create_chat_messages.sql、src/apps/chat/chatModel.ts |
| 操作 | Neon SQL Editor で 040 を実行し、sql/README.md に記録 |
| 確認 | chat_messages・chat_room_seats が作成され 0 件 |
| 切り分け | 入室で DB_UNAVAILABLE → .env の DATABASE_URL、SQL を実行したブランチ・DB |

## C 投稿・検証・保存後の配信
| 項目 | 内容 |
| --- | --- |
| 目的 | chat:send の検証、保存成功後だけ同じルームへ chat:message（REQ-CHAT-002、003、011、014／DES-CHAT-002、004、006） |
| 変更ファイル | src/apps/chat/chatValidation.ts・chatService.ts、public/chat/chat.js |
| 確認 | タブ A・B で順番に送り、両方に同じ投稿が各 1 件。DB に 1 行。空白・文字数超過は理由を表示して保存されない |
| 切り分け | 片方にしか出ない → 両タブの入室結果（「入室済み」か）、イベント名、配信先のルーム |

## D 5 人制限・席の解放・再入室と履歴同期・例外表示
| 項目 | 内容 |
| --- | --- |
| 目的 | REQ-CHAT-004〜008、012、013／DES-CHAT-004、005 |
| 変更ファイル | chatModel.ts（acquireSeat・releaseSeat・touchSeats）、chatService.ts、chat.js |
| 確認 | 6 タブ目で満席案内、履歴・新着・投稿なし。1 つ閉じて再試行で入室。オフライン → 復帰で最新 20 件を取り直す |
| 切り分け | 6 人目が入れる → chat_room_seats の行数、期限切れの判定。席が減らない → disconnect の処理、60 秒後の回収 |

## E 複数台の同期・共有定員・回帰確認
| 項目 | 内容 |
| --- | --- |
| 目的 | REQ-CHAT-009、010、016／DES-CHAT-005 |
| 操作 | ターミナル 1：`npm run dev`（3000）。ターミナル 2：PowerShell で `$env:PORT=3001; npm run dev` |
| 確認 | 3000 の A と 3001 の B の間で双方向に届く（最大約 2 秒）。2 台合計 4 接続から両台で同時に入室し、成功は 1 件 |
| 切り分け | 届かない → 両プロセスが同じ DB か、同期のログ（[chat] sync） |

## 進捗メモ
- 2026-11-25 A〜D のコードを作成（chatValidation・chatModel・chatService・chatController・chatRouter、views/chat/index.ejs、public/chat/chat.js・chat.css、index.ts の起動処理）。DB なしの検証環境で、/chat・/chat/・静的ファイル・/socket.io/socket.io.js が 200、既存の /・/todo・/ai・/ai/v2 が 200、存在しない URL が 404。未入室の chat:send は NOT_JOINED、DB に接続できない入室は DB_UNAVAILABLE（サーバーは停止しない）
- 2026-11-25 E：2 台（3000・3001）で双方向の配信と、合計 4 席からの同時入室で成功 1 件・ROOM_FULL 1 件を確認。docs/chat/05・06 を作成
