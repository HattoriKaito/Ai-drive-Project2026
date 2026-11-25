# SQL 実行記録

SQL ファイルは Git に保存するだけでは実行されない。Neon SQL Editor でアプリの DATABASE_URL と同じブランチ・DB を選び、手動で実行してから下の表に記録する。接続文字列は書かない。

| ファイル | 対象（Neon プロジェクト / ブランチ / DB） | 実行日 | 結果 |
| --- | --- | --- | --- |
| todo/020_create_todo_tasks.sql | patient-recipe-90853169 / production（Primary） / neondb | 2026-11-25 | 成功。SELECT * FROM todo_tasks ORDER BY id で 0 件を確認 |
| todo/021_create_todo_tasks_v2.sql | patient-recipe-90853169 / production（Primary） / neondb | 2026-11-25 | 成功。v2_todo_tasks は 0 件。V1 の todo_tasks はテーブルが残っていることを確認（テストで作成した行は削除済みのため 0 件） |
| ai/030_create_ai_qa_logs.sql | patient-recipe-90853169 / production（Primary） / neondb | 2026-11-25 | 成功（CREATE TABLE・CREATE INDEX）。実行前の SELECT でテーブル未作成を確認後、作成 |
| ai/040_create_ai_conversations.sql | patient-recipe-90853169 / production（Primary） / neondb | 2026-11-25 | 成功（CREATE 3 件：ai_conversations、ai_conversation_turns、インデックス） |
