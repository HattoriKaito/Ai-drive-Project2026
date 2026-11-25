# TODO機能 V1 実装手順書

- 根拠：docs/todo/01_requirements.md、docs/todo/02_design.md
- 作業ブランチ：feature/todo-app（main から作成済み）
- 既存の `/` と `/api/db-check` を壊さないことを各工程で確認する
- 1 工程ごとに確認し、終わったら「結果」欄に記録する

## 0 作業前の確認
| 項目 | 内容 |
| --- | --- |
| 対象ファイル | なし |
| 作業 | ブランチと既存機能の確認 |
| コマンド | `git branch --show-current` → `npm run build` → `npm run dev` |
| 期待結果 | feature/todo-app と表示。`/` と `/api/db-check`（connected）が開ける |
| 失敗時に見る場所 | .env の DATABASE_URL、ターミナルの最初のエラー |
| 結果 | |

## 1 SQL を Git に保存する
| 項目 | 内容 |
| --- | --- |
| 対象ファイル | sql/todo/020_create_todo_tasks.sql、sql/README.md |
| 作業 | 設計書第3章の CREATE TABLE を保存。README に記録欄を作る |
| コマンド | `git add sql` → `git commit -m "feat: todo_tasks の SQL を追加"` |
| 期待結果 | SQL ファイルがコミットされる |
| 失敗時に見る場所 | ファイルの保存場所（sql/todo/） |
| 結果 | |

## 2 Neon SQL Editor で SQL を手動実行する
| 項目 | 内容 |
| --- | --- |
| 対象ファイル | sql/README.md（記録のみ） |
| 作業 | Neon の SQL Editor で、DATABASE_URL と同じブランチ・DB を選んで 020 を実行。続けて `SELECT * FROM todo_tasks ORDER BY id;` を実行 |
| 期待結果 | エラーなし。初回は 0 件。Tables タブに todo_tasks が表示される |
| 失敗時に見る場所 | 選択中の Neon ブランチと DB、同名テーブルの有無（構造が違えば削除せず講師に確認） |
| 結果 | sql/README.md に対象・実行日・結果を記入 |

## 3 一覧 API（REQ-01）
| 項目 | 内容 |
| --- | --- |
| 対象ファイル | src/apps/todo/todoModel.ts、todoController.ts、todoRouter.ts、index.ts |
| 作業 | Model に listTodos と行の変換、Controller に一覧処理とエラー応答、Router に GET / と JSON エラー処理を作成。index.ts に import と `app.use('/api/v1/todos', todoRouter)` を追記 |
| コマンド | `npm run build` → `npm run dev` → `curl.exe -i http://localhost:3000/api/v1/todos` |
| 期待結果 | 200、`{"status":"success","data":[]}` |
| 失敗時に見る場所 | import のパス、ターミナルの最初のエラー、DB 接続先 |
| 結果 | |

## 4 登録 API（REQ-02）
| 項目 | 内容 |
| --- | --- |
| 対象ファイル | todoModel.ts（createTodo）、todoController.ts（入力チェック）、todoRouter.ts（POST /） |
| 作業 | title の型・空白・文字数のチェック。INSERT ... RETURNING で登録 |
| コマンド | ブラウザの Console で POST（資料の確認例）。title なし、空白だけ、101 文字も送る |
| 期待結果 | 正常 201 で ID 付き TODO。title なし 400、空白だけ・101 文字 422。一覧が 1 件増える |
| 失敗時に見る場所 | express.json() の位置、Content-Type ヘッダー、SQL のプレースホルダ |
| 結果 | |

## 5 更新 API（REQ-03）
| 項目 | 内容 |
| --- | --- |
| 対象ファイル | todoModel.ts（updateTodoCompleted）、todoController.ts、todoRouter.ts（PATCH /:id） |
| 作業 | ID の解析、isCompleted の型チェック、UPDATE ... RETURNING。0 行なら 404 |
| コマンド | 4 で作った ID に `{"isCompleted":true}` を PATCH。存在しない ID（例 999999）、`abc` も送る |
| 期待結果 | 正常 200 で該当行だけ true。存在しない ID 404、`abc` 400 |
| 失敗時に見る場所 | ID の解析、UPDATE の WHERE、RETURNING |
| 結果 | |

## 6 削除 API（REQ-04）
| 項目 | 内容 |
| --- | --- |
| 対象ファイル | todoModel.ts（deleteTodo）、todoController.ts、todoRouter.ts（DELETE /:id） |
| 作業 | DELETE の rowCount で有無を判定。成功時は 204 で本文なし |
| コマンド | 4 で作った ID を DELETE。同じ ID をもう一度 DELETE |
| 期待結果 | 1 回目 204（本文なし）、一覧から消える。2 回目 404 |
| 失敗時に見る場所 | DELETE の WHERE、rowCount、204 で本文を返していないか |
| 結果 | |

## 7 TodoApi クラス
| 項目 | 内容 |
| --- | --- |
| 対象ファイル | public/todo/todo.js |
| 作業 | list / create / update / delete の 4 メソッドと共通の通信処理。res.ok でなければ code・message を持つ Error を投げる。204 では res.json() を呼ばない |
| コマンド | 8 の画面から確認 |
| 期待結果 | 画面イベント側に fetch や URL の直接記述がない |
| 失敗時に見る場所 | Network タブの URL・メソッド・応答 |
| 結果 | |

## 8 画面（/todo）
| 項目 | 内容 |
| --- | --- |
| 対象ファイル | views/todo/index.ejs、public/todo/todo.css、public/todo/todo.js（画面イベント）、index.ts（`app.get('/todo', ...)`） |
| 作業 | フォーム、一覧（チェックボックス・打ち消し線・削除ボタン）、処理中・エラー・0 件の表示。削除は確認ダイアログ |
| コマンド | `npm run dev` → http://localhost:3000/todo で登録 → 完了 → 未完了に戻す → 削除 |
| 期待結果 | 再読み込みなしで画面が変わる。0 件で「TODOがありません」 |
| 失敗時に見る場所 | Console のエラー、Network、todo.js の読み込みパス（/todo/todo.js） |
| 結果 | |

## 9 ローカルのビルド後確認
| 項目 | 内容 |
| --- | --- |
| 対象ファイル | なし |
| 作業 | ビルド後の起動で同じ動作か確認 |
| コマンド | `npm run build` → `npm start` → `/`、`/api/db-check`、`/todo` |
| 期待結果 | すべて表示され、EJS・JS・CSS が読み込まれる |
| 失敗時に見る場所 | views/todo/ と public/todo/ のパス、dist/ の出力 |
| 結果 | 04_test_results.md の Local 欄に記録 |

## 10 Preview で確認
| 項目 | 内容 |
| --- | --- |
| 対象ファイル | 全変更ファイル |
| 作業 | `git status` と `git diff --cached --name-only` で .env が含まれないことを確認してコミット・push |
| コマンド | `git add .` → `git commit -m "feat: TODO V1"` → `git push -u origin feature/todo-app` |
| 期待結果 | Vercel に Preview Deployment ができ Ready。Preview URL で 04 のテスト表がすべて期待どおり |
| 失敗時に見る場所 | Build Logs、Function Logs、Vercel の DATABASE_URL が Preview に適用されているか |
| 結果 | 04_test_results.md の Preview 欄に記録 |

## 11 Pull Request
| 項目 | 内容 |
| --- | --- |
| 作業 | GitHub で feature/todo-app → main の PR を作成。変更内容、Preview URL、テスト結果、未解決事項を記載 |
| 期待結果 | PR URL ができる |
| 結果 | |

## 12 マージと Production 確認
| 項目 | 内容 |
| --- | --- |
| 作業 | PR を main にマージ。Production Deployment が Ready になったら Production URL でテスト |
| 期待結果 | Production でも 04 のテスト表がすべて期待どおり。既存の `/`、`/api/db-check` も動く |
| 失敗時に見る場所 | Production Deployment の Build Logs、ソースブランチが main か |
| 結果 | 04_test_results.md の Production 欄に記録し、main に反映 |

## 進捗メモ
（作業単位が終わるたびに、変更したファイルと確認結果を追記する）
