# TODO機能 V2 設計書

- 根拠：docs/todo/v2/01_requirements_v2.md、docs/todo/02_design.md（V1）
- 作業ブランチ：feature/todo-v2

## 1 V1 との差分とファイル構成

```
プロジェクト直下/
├── index.ts                         V2 Router の登録と /todo-v2 の表示を追記（V1 の行は変更しない）
├── src/apps/todo/                   V1（変更しない）
│   └── v2/
│       ├── todoV2Router.ts          V2 API のルーティング、JSON 解析、JSON エラー処理
│       ├── todoV2Controller.ts      入力・クエリのチェック、ステータスと JSON の決定
│       └── todoV2Model.ts           v2_todo_tasks への SQL、行 → JSON 変換
├── views/todo-v2/index.ejs          V2 画面
├── public/todo-v2/todo-v2.js        TodoApiV2 クラスと画面イベント
├── public/todo-v2/todo-v2.css       V2 画面の追加スタイル（基本は /todo/todo.css を共用）
├── sql/todo/021_create_todo_tasks_v2.sql
└── docs/todo/v2/
```

- V1 の Controller にある `sendError`（統一エラー JSON）を V2 からも import して使い、形式を V1 と完全に一致させる。V1 のファイル自体は変更しない
- V2 のクラス・ファイル・テーブルには v2 / V2 を付け、V1 と名前が衝突しないようにする

### index.ts への追記
```ts
import { todoV2Router } from './src/apps/todo/v2/todoV2Router';
app.get('/todo-v2', (_req, res) => res.render('todo-v2/index'));
app.use('/api/v2/todos', todoV2Router);
```

## 2 リクエストの流れ
```
ブラウザ（TodoApiV2） → index.ts → todoV2Router → todoV2Controller → todoV2Model → pool（db.ts） → v2_todo_tasks
```
V1（TodoApi → todoRouter → … → todo_tasks）とは Router 以降が完全に分かれる。

## 3 DB の設計（v2_todo_tasks）
| 列 | 型・制約 | JSON |
| --- | --- | --- |
| id | INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY | id |
| title | TEXT NOT NULL、CHECK（1〜100 文字かつ空白だけでない） | title |
| is_completed | BOOLEAN NOT NULL DEFAULT FALSE | isCompleted |
| priority | TEXT NOT NULL DEFAULT 'normal'、CHECK（low・normal・high） | priority |
| created_at | TIMESTAMPTZ NOT NULL DEFAULT NOW() | createdAt |

- 授業用の少量データのため、インデックスは追加しない（追加する場合は v2_ で始まる名前にする）
- V1 の todo_tasks は変更・削除しない。021 は Neon SQL Editor で手動実行し sql/README.md に記録する

## 4 API の共通ルール
- ベース URL：/api/v2/todos。応答形式・ID の規則（1〜2147483647 の整数）は V1 と同じ
- priority の許可値：`low`、`normal`、`high`（小文字のみ）
- SQL はすべてプレースホルダを使う。絞り込みの WHERE 句は条件の有無で組み立てるが、値は必ず `$n` で渡す

## 5 各 API の設計

### 5.1 REQ-V2-01 GET /api/v2/todos
| 項目 | 内容 |
| --- | --- |
| クエリ | completed：`true`／`false`（省略可）。priority：`low`／`normal`／`high`（省略可） |
| 成功 | 200 `{"status":"success","data":[{"id":1,"title":"...","isCompleted":false,"priority":"high","createdAt":"..."}]}` |
| 400 | completed が true・false 以外、completed または priority が複数指定（`?priority=a&priority=b`） |
| 422 | priority が許可値以外 |
| DB 処理 | `SELECT ... FROM v2_todo_tasks [WHERE is_completed = $1 AND priority = $2] ORDER BY id` |
| Model | `listTodosV2(filter: { completed?: boolean; priority?: Priority })` |
| TodoApiV2 | `list({ completed, priority })` |

### 5.2 REQ-V2-02 POST /api/v2/todos
| 項目 | 内容 |
| --- | --- |
| 本文 | `{"title":"...","priority":"high"}`（priority 省略時は normal） |
| 成功 | 201、登録した TODO |
| 400 | JSON 不正、本文がオブジェクトでない、title 欠落・文字列以外、priority が文字列以外 |
| 422 | title が空白だけ・101 文字以上、priority が許可値以外 |
| DB 処理 | `INSERT INTO v2_todo_tasks (title, priority) VALUES ($1, $2) RETURNING ...` |
| Model | `createTodoV2(title, priority)` |
| TodoApiV2 | `create(title, priority)` |

### 5.3 REQ-V2-03 PATCH /api/v2/todos/:id
| 項目 | 内容 |
| --- | --- |
| 本文 | `{"isCompleted":true}`、`{"priority":"low"}`、または両方 |
| 成功 | 200、更新後の TODO |
| 400 | ID 不正、JSON 不正、isCompleted も priority も含まない、isCompleted が真偽値以外、priority が文字列以外 |
| 422 | priority が許可値以外 |
| 404 | 対象の ID がない |
| DB 処理 | 送られた項目だけを `SET is_completed = $n, priority = $m` に入れて `UPDATE ... WHERE id = $k RETURNING ...`。0 行なら 404 |
| Model | `updateTodoV2(id, { isCompleted?, priority? })` |
| TodoApiV2 | `update(id, changes)` |

### 5.4 REQ-V2-04 DELETE /api/v2/todos/:id
| 項目 | 内容 |
| --- | --- |
| 成功 | 204、本文なし |
| 400 / 404 | ID 不正 / 対象なし |
| DB 処理 | `DELETE FROM v2_todo_tasks WHERE id = $1`、rowCount 0 なら 404 |
| Model | `deleteTodoV2(id)` |
| TodoApiV2 | `delete(id)` |

## 6 画面と TodoApiV2
| 要素 | 内容 |
| --- | --- |
| 登録フォーム | タイトル入力、優先度の選択（高 high／中 normal／低 low、初期値 normal）、登録ボタン |
| 絞り込み | 完了状態（すべて／未完了／完了）、優先度（すべて／高／中／低）。変更時に一覧を再取得 |
| 一覧 | チェックボックス（完了切替）、タイトル、優先度の選択欄（変更で PATCH）、削除ボタン（確認ダイアログ） |
| 状態表示 | 読み込み中・エラー・「TODOがありません」 |

- TodoApiV2 は V1 の TodoApi と同じ通信・エラー処理の方針（res.ok の確認、204 で res.json() を呼ばない）
- 画面イベントは TodoApiV2 だけを呼ぶ。タイトルは textContent で表示
- V1 の TodoApi（public/todo/todo.js）は変更しない

## 7 エラー処理
V1 と同じ配置（不正 JSON は Router、入力・クエリは Controller、DB 接続エラーは 503）。クエリの検査は Controller で行う。

## 8 注意事項
- index.ts への追記は import 1 行とルート 2 行のみ。V1 のルートの順番・内容は変えない
- /todo-v2 と public/todo-v2/ の名前が重なるが、V1 で追加した express.static の `redirect: false` により /todo-v2/ へリダイレクトされない
- V1 と V2 は別テーブルのため、V1 で登録した TODO は V2 には表示されない（仕様）
