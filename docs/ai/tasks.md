# AI質問機能 実装計画（docs/ai/tasks.md）

- 根拠：docs/ai/requirements.md、docs/ai/spec.md
- 1 TASK ごとに確認し、差分を確認してからコミットする。次の TASK へ自動で進まない

| 作業ID | 対応 REQ・DES | 変更対象 | 作業内容 | 確認方法 | 期待結果 | 結果 |
| --- | --- | --- | --- | --- | --- | --- |
| TASK-01 | F010、N001、N003 / DES-002、006 | src/apps/ai/aiRouter.ts、aiMiddleware.ts、aiError.ts、index.ts | 共通ひな型、問い合わせ ID、デモ停止、AI 専用 JSON 解析とエラー処理、Router 登録 | AI_DEMO_ENABLED 未設定で GET /api/ai/history と POST /api/ai/ask、/、/todo | 両 API 503 DEMO_DISABLED、TOP・TODO 正常 | |
| TASK-02 | F004、F005、D001〜D004 / DES-004、005 | sql/ai/030_create_ai_qa_logs.sql、sql/README.md、aiModel.ts、aiController.ts | SQL 作成（Neon で本人が実行）、最新 20 件の取得、列名変換、GET /history | .env で true にして GET /api/ai/history | 200、`{"success":true,"items":[]}` | |
| TASK-03 | F003、F006 / DES-004、008 | aiService.ts（模擬）、aiController.ts | 入力検証、模擬回答の生成、保存、201 | Console で POST、空白の POST、GET | 201＋模擬回答、DB に 1 行、空白は 400 で保存なし | |
| TASK-04 | F002、F007、F009、N002 / DES-001、008 | aiService.ts、package.json | @google/genai で実 AI に置き換え（30 秒、再試行なし、1024 トークン、空回答は失敗） | 正常な質問を 1 回だけ送る | 201、実 AI の回答、DB と履歴が一致。模擬回答が残っていない | |
| TASK-05 | F001、F004、F005、N004 / DES-003 | public/ai/index.html、app.js、style.css、index.ts | 画面、初期履歴取得、0 件表示、取得失敗、安全な描画 | /ai を開く、再読込 | 履歴表示、0 件と失敗の区別、操作可能に戻る | |
| TASK-06 | F002、F008、F009、N004、N006 / DES-003、008 | public/ai/app.js | 非同期送信、検証、busy・disabled、45 秒、res.ok と応答形の確認、成功時だけ質問を消す | 画面から質問、連打、オフライン | 画面遷移なし、重複なし、失敗後も質問が残る | |
| TASK-07 | 全 REQ / DES-010 | docs/ai/test-results.md | 必須テスト T01〜T20 と追加確認、TOP・TODO の回帰 | 表に沿って実行 | 期待と実測を記録 | |
| TASK-08 | F010、N002 / DES-009 | Vercel 設定、README.md、docs/ai/* | Preview・Production の AI_DEMO_ENABLED 確認、PR、README・報告 | 保護の確認、Production で両 API 503 | 停止確認、文書更新 | |

## 発展課題（今回は実装しない）
会話の記憶、Markdown 表示、ストリーミング、履歴の削除・検索、利用者ごとの履歴。

## 進捗メモ
- 2026-11-25 TASK-01：aiError.ts（固定コードと文言、限定ログ）、aiMiddleware.ts（問い合わせID、デモ停止）、aiRouter.ts（デモ停止→16KiBのJSON解析→ルート→404→エラー処理）を作成し、index.ts に /api/ai を登録。DB なしの検証環境で、AI_DEMO_ENABLED 未設定時に GET・POST とも 503 DEMO_DISABLED、/ と /todo は 200。true 時は不正 JSON 400、17,000 バイトで 413、未定義 URL 404、X-Request-Id の付与を確認
- 2026-11-25 TASK-02：sql/ai/030 を Neon で実行（sql/README.md に記録）。aiModel.ts（最新20件、列名変換）、aiController.ts（getHistory、DB障害は503 DB_UNAVAILABLE）を作成し Router に登録。DB なしの検証環境で 503 DB_UNAVAILABLE と、ログに requestId・段階・エラー種別だけが出ることを確認
- 2026-11-25 TASK-03：aiService.ts に模擬回答（ローカル限定、Vercel 上では AI_NOT_CONFIGURED）、aiModel.ts に saveLog、aiController.ts に askAi（検証→回答→保存→201）を実装。DB なしの検証環境で、空白・型違い・prompt なしは 400 INVALID_PROMPT、2,001 文字は 400 PROMPT_TOO_LONG、text/plain は 415、2,000 文字は検証を通過、模擬回答取得後の保存失敗は 500 SAVE_FAILED（回答を返さない）を確認
- 2026-11-25 TASK-04：aiService.ts を @google/genai による実 AI 呼出しに置き換え（30 秒、retryOptions.attempts: 1、maxOutputTokens 1024、空回答は失敗）。模擬回答が src に残っていないことを確認。検証環境で、キー・モデル未設定は 503 AI_NOT_CONFIGURED、通信できない場合は再試行せず即 502 AI_UNAVAILABLE（ログは requestId・段階・エラー種別のみ）を確認。実 AI の正常系は本人の PC で確認する
- 2026-11-25 TASK-05〜06：public/ai/index.html・app.js・style.css を作成し、index.ts に /ai を追加、TOP に各アプリへのリンクを追加（Hello World! は維持）。初期取得中の無効化、0 件と取得失敗の区別、textContent による描画、res.ok と応答形の確認、45 秒の待機、busy・disabled による重複送信防止、成功時だけ質問を消す、finally での復帰を実装。検証環境で /ai・/ai/・静的ファイル・/・/todo・/todo-v2 が 200、app.js に innerHTML がないことを確認
