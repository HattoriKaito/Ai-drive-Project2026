# AI対話アプリ V2 テスト結果（docs/ai/v2/test-results.md）

- 対象ブランチ：feature/ai-app-v2
- 実施日：2026-11-25
- 環境の表記：Local＝本人の PC（実 DB・実 Gemini、AI_DEMO_ENABLED=true）、検証環境＝DB・Gemini に接続しないサーバーでの確認
- 回答文だけで判定せず、送信内容（contents の role の並び）をサーバーログで確認した

| テストID | 対象環境 | 操作 | 期待結果 | 実測 | 判定 |
| --- | --- | --- | --- | --- | --- |
| T-V2-01 | Local | 会話 A（ID 1）で「合言葉は『しろくま47』です。」→「さっきの合言葉は何ですか？」 | 合言葉に答える。A の 2 回目の送信が user,model,user | 2 回とも 201。2 回目は「さっきの合言葉は『しろくま47』です！」。ログは 1 回目 roles=user、2 回目 roles=user,model,user（conversationId=1） | 合格 |
| T-V2-02 | Local | 会話 B（ID 2）で「さっきの合言葉は何ですか？」、画面で A と B を切り替え | B の初回の送信が user のみ。B に A の履歴が出ない | 201。回答は「今回が初めての会話なので合言葉は決めていない」。ログは roles=user（conversationId=2）。画面で A → B → A と切り替え、B に A の履歴は表示されない | 合格 |
| T-V2-03 | Local | A を選んだ状態で再読み込みし、追加質問 | A の履歴が出て続けて質問できる | URL の #c=1 で A が開いて履歴を再取得し、追加質問が A の続きとして回答された | 合格 |
| T-V2-04 | 検証環境 | GET・POST /conversations/abc/turns、/conversations/0/turns | 400 INVALID_ID、Gemini を呼ばない | 400 INVALID_ID（contents のログが出ない＝Gemini 呼出し前に終了） | 合格 |
| T-V2-05 | Local | GET /conversations/999999/turns | 404 CONVERSATION_NOT_FOUND | 404 CONVERSATION_NOT_FOUND | 合格 |
| T-V2-06 | Local・検証環境 | 会話名が空白／51 文字、質問が空白／型違い | 400、保存しない | 会話名の空白は 400 INVALID_TITLE（Local）、51 文字は 400 TITLE_TOO_LONG、質問の空白・型違いは 400 INVALID_PROMPT（検証環境） | 合格 |
| T-V2-07 | Local | 送信失敗（DevTools でオフライン） | 成功扱いにせず質問を保持、操作復帰 | 案内表示、質問保持、ボタン復帰。AI 自体の失敗（502）は V2 では発生させていない（V1 の T10 で同じ変換処理を確認済み） | 合格（通信失敗）／AI 失敗は未実施 |
| T-V2-08 | 検証環境 | DB 障害時の送信 | 201 にならない | 会話の確認段階で 503 DB_UNAVAILABLE、Gemini は呼ばれない。「AI 成功・保存失敗」の 500 SAVE_FAILED は V2 では未発生（V1 で同じ構造を確認） | 一部合格／保存失敗は未実施 |
| T-V2-09 | 検証環境 | AI_DEMO_ENABLED 未設定で V2 の各 API | 全 API が 503 DEMO_DISABLED | GET・POST /conversations、GET /conversations/1/turns が 503 DEMO_DISABLED | 合格 |
| T-V2-10 | Local・検証環境 | V1 の /ai・/api/ai/history、TOP、/todo、/todo-v2 | 従来どおり動く | すべて 200。TOP に V2 へのリンクを追加（Hello World! は維持） | 合格 |
| T-V2-11 | ― | 21 往復以上の会話 | 最新 20 往復だけを古い順 | 未実施（SQL の `ORDER BY id DESC LIMIT 20` と古い順への並べ直しをコードで確認。Gemini を 21 回呼ぶ必要があるため実施していない） | 未実施 |

## 公開環境

| テストID | 対象環境 | 操作 | 期待結果 | 実測 | 判定 |
| --- | --- | --- | --- | --- | --- |
| T-V2-09P | Production（https://ai-drive-project2026-tau-ochre.vercel.app、PR #4 マージ後） | /api/ai/v2/conversations、/ai/v2、/ | V2 の API は 503 DEMO_DISABLED、画面は停止表示で操作不可、TOP は動く | API は 503 DEMO_DISABLED。/ai/v2 は「現在AI機能は停止中です。」と問い合わせ ID を表示し、会話の作成・送信ボタンが無効。会話一覧の取得失敗を 0 件表示にしない。TOP に V2 へのリンク | 合格 |
