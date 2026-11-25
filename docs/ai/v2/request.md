# AI対話アプリ V2 要望書（docs/ai/v2/request.md）

- 根拠：授業テキスト「20261118 AI質問アプリ V2」の変更要望と授業の共通条件、講師リポジトリの docs/ai/v2/request.md（参考）
- 前提：V1（/ai、/api/ai）でローカルから実際の Gemini の回答・201・履歴保存を確認済み（docs/ai/test-results.md の T01）

## 1 背景・目的
V1 は 1 問 1 答で、前のやり取りを踏まえた追加質問や、話題ごとの会話の管理ができない。V2 では V1・TODO を変更せずに別の画面・API・テーブルとして、「文脈を引き継いだ連続対話」「話題ごとの会話の作成・切り替え」「再読み込み後の再開」を実現する。

## 2 変更要望
| 要望ID | 内容 |
| --- | --- |
| WISH-V2-01 | 前のやり取りを踏まえ、同じ会話で追加質問したい |
| WISH-V2-02 | 話題ごとに新しい会話を作成し、一覧から切り替えたい |
| WISH-V2-03 | 再読み込み後も、保存した会話を選んで再開したい |

## 3 授業の共通条件
| 項目 | 条件 |
| --- | --- |
| 引き継ぐもの | V1 の Express／TypeScript・Neon・Gemini API。既存の画面・API・履歴と TOP・TODO は維持 |
| 会話名 | 前後空白除去後 1〜50 Unicode コードポイント |
| 質問 | 前後空白除去後 1〜2,000 Unicode コードポイント |
| JSON 本文 | 16KiB 以内 |
| 画面表示 | 選択中の会話の最新 20 往復を古い順に表示 |
| Gemini へ渡す文脈 | 同じ会話の保存済み最新 5 往復を古い順に並べ、今回の質問を末尾に加える。新規会話の初回は今回の質問だけ |
| 保存 | 質問と回答を 1 往復として保存。Gemini の回答取得と DB 保存の両方が成功してから 201 |
| 失敗時 | 入力を残して再操作できる状態に戻す。自動再送しない |
| 公開 | 評価は原則ローカル。公開環境では V2 の API を停止 |
| 会話の区別 | 会話 ID で区別する |
| 発展課題 | ログイン、ユーザー別の権限管理、会話名の変更・削除、V1 履歴の移行 |
| データ | 実習データには架空の内容を使う |

## 4 現状調査の結果（2026-11-25）
| 項目 | 確認したこと |
| --- | --- |
| 起動方法 | `npm run dev`（tsx watch ./index.ts、ポート 3000）、`npm run build`（tsc）、`npm start` |
| 構成 | index.ts で /todo・/todo-v2・/ai の画面と /api/v1/todos・/api/v2/todos・/api/ai を登録。JSON 解析は各 Router 内。DB は db.ts の共有 pool |
| AI 機能の追加先 | src/apps/ai/v2/（新規）、public/ai/v2/（新規）、sql/ai/040_create_ai_conversations.sql（新規）、index.ts への登録のみ追記 |
| 壊してはいけない既存機能 | /、/api/db-check、/todo・/api/v1/todos、/todo-v2・/api/v2/todos、/ai・/api/ai（V1）、テーブル todo_tasks・v2_todo_tasks・ai_qa_logs |
| 資料の配置案と異なる点 | 資料のファイル構成図は docs/ai/01_requirements.md 形式だが、本リポジトリの V1 文書は request・requirements・spec・tasks・test-results の名前。V2 は授業テキストの各プロンプトが指定する保存先（requirements.md・design.md・implementation-plan.md・test-results.md）に合わせる |
| 不足情報 | 公開環境の停止方法（V1 と同じ AI_DEMO_ENABLED を使うか）→ 設計で決定。会話一覧の並び順 → 設計で決定 |
