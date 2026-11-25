# AI対話アプリ V2 実装手順書（docs/ai/v2/implementation-plan.md）

- 根拠：docs/ai/v2/requirements.md、docs/ai/v2/design.md
- 1 TASK ずつ実装・確認し、実測と判定を記録してから次へ進む

| TASK | REQ／DES | 変更ファイル・確認先 | 操作 | 期待結果 | 次へ進む条件 | 実測 | 判定 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TASK-V2-01 | REQ-V2-06／DES-V2-05 | V1 の /ai、/api/ai | V1 で実際の回答・201・履歴保存を確認し、`git switch -c feature/ai-app-v2` | V1 正常、ブランチ作成 | V1 の動作を記録済み | V1 は docs/ai/test-results.md の T01 で確認済み（2026-11-25） | |
| TASK-V2-02 | REQ-V2-01・02／DES-V2-02・03・05 | sql/ai/040_create_ai_conversations.sql、src/apps/ai/v2/（Router・Controller・Model・Error）、index.ts | SQL を Neon で実行。会話 A・B を作成、一覧と各会話の空の履歴を取得 | 201×2、一覧 200 で 2 件、各 turns 200・[]、存在しない ID 404、不正 ID 400 | A・B の会話 ID を記録できた | A（ID 1）・B（ID 2）を 201 で作成、一覧 200 で 2 件（新しい順）、各 turns 200・[]、ID 999999 は 404 CONVERSATION_NOT_FOUND、空白の会話名は 400 INVALID_TITLE | 合格 |
| TASK-V2-03 | REQ-V2-03〜05／DES-V2-03・04 | src/apps/ai/v2/aiV2Service.ts、Controller、Model | A で合言葉を伝え、A で追加質問。B で同じ追加質問 | A の 2 回目のログが user,model,user、B の初回が user。A は合言葉に答え、B は答えられない。201 と保存 | 送信内容と保存が一致 | A 1 回目・2 回目・B 初回とも 201。A の 2 回目は「しろくま47」と回答、B は「初めての会話なので合言葉は決めていない」と回答。ログの roles は A：user → user,model,user、B：user | 合格 |
| TASK-V2-04 | REQ-V2-01・02・05／DES-V2-01 | public/ai/v2/、index.ts | 画面で A → B → A の切り替え、再読み込み後の再開、失敗時の入力保持 | 会話ごとの履歴、再開、入力保持と操作復帰 | すべて確認 | A → B → A で各会話の履歴だけを表示。再読み込み後 #c=1 で A が開き追加質問できた。会話 C の作成で一覧の先頭に追加・自動選択・0 件表示。オフライン送信で案内表示・質問保持・操作復帰 | 合格 |
| TASK-V2-05 | REQ-V2-01〜06／DES-V2-01〜05 | docs/ai/v2/test-results.md | 下のテストを実施。PR に結果を記載 | 下表のとおり | 記録と提出 | | |

## テスト（docs/ai/v2/test-results.md に記録）
| テストID | 内容 | 期待結果 |
| --- | --- | --- |
| T-V2-01 | 同じ会話 A での追加質問 | 合言葉に答える。A の 2 回目の送信が user,model,user |
| T-V2-02 | 別会話 B への混入防止 | B の初回の送信が user のみ。B の画面に A の履歴がない |
| T-V2-03 | 再読み込み後の再開 | 再読み込み後に A を開くと A の履歴が出て、続けて質問できる |
| T-V2-04 | 不正な会話 ID（abc、0） | 400 INVALID_ID、Gemini を呼ばない |
| T-V2-05 | 存在しない会話 ID | 404 CONVERSATION_NOT_FOUND、Gemini を呼ばない |
| T-V2-06 | 会話名・質問の検証（空白、51 文字、2,001 文字） | 400、保存しない |
| T-V2-07 | AI 失敗 | 502 など、保存しない、質問が残る |
| T-V2-08 | DB 保存失敗 | 500 SAVE_FAILED、回答を返さない（検証環境で確認） |
| T-V2-09 | V2 API 停止（AI_DEMO_ENABLED 未設定・false） | V2 の全 API が 503 DEMO_DISABLED |
| T-V2-10 | V1 と TOP・TODO | 従来どおり動く |
| T-V2-11 | 21 往復以上の会話 | 画面に最新 20 往復だけ古い順（検証環境で確認） |

## 進捗メモ
- 2026-11-25 TASK-V2-01：V1 の実 AI 接続は docs/ai/test-results.md T01 で確認済み。feature/ai-app-v2 を作成
- 2026-11-25 TASK-V2-02：040 を Neon で実行（sql/README.md に記録）。src/apps/ai/v2/（aiV2Error.ts、aiV2Model.ts、aiV2Controller.ts、aiV2Router.ts）を作成し、index.ts で /api/ai/v2 を V1 の /api/ai より前に登録。DB なしの検証環境で、会話名の空白・51 文字は 400、不正 ID（abc、0）は 400 INVALID_ID、未定義 URL は 404、DB 障害は 503、AI_DEMO_ENABLED 未設定で全 API 503 DEMO_DISABLED を確認
- 2026-11-25 TASK-V2-03：aiV2Service.ts（buildContents、generateAnswerWithHistory）と postTurn を実装。contents の role の並びだけをログに出す。検証環境で buildContents が A の 2 回目 user,model,user、B の初回 user、5 往復で 11 件になること、空白・型違いは 400 INVALID_PROMPT、不正 ID は 400、DB 障害は 503（Gemini を呼ばない）を確認
- 2026-11-25 TASK-V2-04：public/ai/v2/（index.html、app.js、style.css）を作成し、index.ts に /ai/v2 と TOP へのリンクを追加。会話の切り替え時は前の履歴を消してから取得し、古い応答は loadToken で破棄。選択中の会話は #c=ID で保持し、再読み込み後に開き直す。検証環境で /ai/v2・/ai/v2/・静的ファイル・V1・TOP・TODO が 200、innerHTML がないことを確認
