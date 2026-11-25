# TODO機能 V2 実装手順書

- 根拠：docs/todo/v2/01_requirements_v2.md、docs/todo/v2/02_design_v2.md
- 作業ブランチ：feature/todo-v2
- 各工程で V1（/todo、/api/v1/todos）を壊していないことを確認する

| 工程 | 対象ファイル | 作業 | 確認コマンド・操作 | 期待結果 | 失敗時に見る場所 | 結果 |
| --- | --- | --- | --- | --- | --- | --- |
| 0 作業前 | なし | ブランチと V1 の確認 | `git branch --show-current`、/todo で一覧表示 | feature/todo-v2、V1 が動く | .env、ターミナルのエラー | |
| 1 SQL 保存 | sql/todo/021_create_todo_tasks_v2.sql、sql/README.md | 021 を保存 | `git add sql` | ファイルがある | 保存場所 | |
| 2 SQL 実行 | sql/README.md（記録） | Neon SQL Editor で 021 を実行。`SELECT id, title, priority FROM v2_todo_tasks ORDER BY id` と `SELECT * FROM todo_tasks ORDER BY id` | v2 は 0 件、V1 のデータは残っている | Neon のブランチ・DB、同名テーブル | |
| 3 V2 一覧・絞り込み API | src/apps/todo/v2/*、index.ts | Model の listTodosV2、Controller のクエリ検査、Router の GET、index.ts に登録 | `/api/v2/todos`、`?completed=yes`、`?priority=urgent` | 200 [] / 400 / 422 | import パス、クエリの検査 | |
| 4 V2 登録 API | 同上 | createTodoV2、priority の省略時 normal | Console で POST（priority あり／なし／urgent） | 201 high / 201 normal / 422 | express.json、priority の検査 | |
| 5 V2 更新 API | 同上 | updateTodoV2（送られた項目だけ SET） | priority のみ、isCompleted のみ、`{}`、存在しない ID | 200 / 200 / 400 / 404 | SET 句の組み立て、プレースホルダ番号 | |
| 6 V2 削除 API | 同上 | deleteTodoV2 | 2 回 DELETE | 204 → 404 | rowCount | |
| 7 TodoApiV2 | public/todo-v2/todo-v2.js | list / create / update / delete | 8 の画面で確認 | 画面イベントに fetch・URL がない | Network | |
| 8 V2 画面 | views/todo-v2/index.ejs、public/todo-v2/*、index.ts | フォーム、絞り込み、一覧（優先度変更・完了・削除） | /todo-v2 で操作 | 再読み込みなしで反映、絞り込みが効く | Console、Network | |
| 9 V1 回帰 | なし | V1 の 4 操作を確認 | /todo、Console で /api/v1/todos | V1 と同じ結果 | index.ts のルート | |
| 10 ビルド後 | なし | `npm run build` → `npm start` | /、/api/db-check、/todo、/todo-v2 | すべて表示 | dist/、views・public のパス | |
| 11 Preview | 全変更 | .env が含まれないことを確認して push | `git push -u origin feature/todo-v2` | Preview が Ready、V1・V2 とも期待どおり | Build Logs、Function Logs | |
| 12 PR | なし | V1 との差分、021 の実行先、V1 回帰テスト、Preview URL を記載 | GitHub で PR 作成 | PR URL | | |
| 13 Production | なし | マージ後に V1・V2 を確認 | Production URL | 期待どおり | Deployment のソースブランチ | |

## 進捗メモ
- 2026-11-25 工程1〜2：021 SQL を作成し、Neon（patient-recipe-90853169 / production / neondb）で実行。v2_todo_tasks 0 件、V1 の todo_tasks が残っていることを確認
- 2026-11-25 工程3〜8：src/apps/todo/v2/（todoV2Router.ts、todoV2Controller.ts、todoV2Model.ts）、views/todo-v2/index.ejs、public/todo-v2/（todo-v2.js、todo-v2.css）を作成し、index.ts に V2 Router と /todo-v2 を登録。V1 のファイルは変更なし。DB なしの状態で 400（completed=yes、クエリ重複、priority の型違い、PATCH {}）、422（priority=urgent、空白 title）、/todo-v2 と静的ファイルの 200 を確認
