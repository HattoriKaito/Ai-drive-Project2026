# TODO機能 V1 設計書

- 根拠：docs/todo/01_requirements.md（REQ-01〜REQ-04 は変更せず参照する）
- 作業ブランチ：feature/todo-app
- 作成日：2026-11-25

## 1 作るものとファイルの役割

### 1.1 ファイル構成
```
プロジェクト直下/
├── index.ts                     既存。todoRouter の登録と /todo の表示を追記
├── db.ts                        既存。pool を共有（変更しない）
├── package.json / tsconfig.json 既存（変更しない）
├── src/apps/todo/
│   ├── todoRouter.ts            API のルーティング、JSON 解析、JSON エラー処理
│   ├── todoController.ts        入力チェック、ステータスと JSON の決定
│   └── todoModel.ts             SQL の実行、DB 行 → JSON 形式への変換
├── views/todo/index.ejs         TODO 画面（/todo）
├── public/todo/todo.js          ブラウザ用。TodoApi クラスと画面イベント
├── public/todo/todo.css         TODO 画面のスタイル
├── sql/README.md                SQL の実行記録
├── sql/todo/020_create_todo_tasks.sql
└── docs/todo/01〜04_*.md
```

### 1.2 各ファイルの責務
| ファイル | 責務 | やらないこと |
| --- | --- | --- |
| todoRouter.ts | URL とメソッドを Controller に割り当てる。express.json() と不正 JSON の 400 処理 | 入力チェック、SQL |
| todoController.ts | ID・本文の型、空白、文字数を調べ、ステータスと JSON を返す。DB エラーを 500/503 に変換 | SQL の組み立て |
| todoModel.ts | パラメーター化した SQL を実行し、TODO オブジェクトを返す | HTTP のステータス判断 |
| todo.js | TodoApi クラスに fetch と URL を集約。画面イベントから TodoApi を呼ぶ | 画面イベント内での fetch の直接記述 |
| index.ejs | フォーム、一覧、状態表示の HTML の骨組み | データの埋め込み（一覧は todo.js が描画） |

### 1.3 ビルドと公開時の扱い
- tsconfig.json の include は index.ts のみだが、tsc は import をたどるため src/apps/todo/ も dist/src/apps/todo/ に出力される
- views と public は既存設定どおり process.cwd() 直下を参照する。Vercel では public/ の中身がルートから配信されるため、ブラウザからは /todo/todo.js、/todo/todo.css で読み込む

## 2 リクエストはどこを通るか

### 2.1 index.ts への追記（最低限）
```ts
import { todoRouter } from './src/apps/todo/todoRouter';
// 既存の app.set(...) の後、既存ルートの後に追記
app.get('/todo', (_req, res) => res.render('todo/index'));
app.use('/api/v1/todos', todoRouter);
```
- express.json() は todoRouter の中で使う。不正 JSON のエラーを TODO API の中だけで 400 JSON に変換でき、既存ルートに影響しない
- 既存の `/` と `/api/db-check` は変更しない

### 2.2 API の流れ
```
ブラウザ（TodoApi） → index.ts → todoRouter → todoController → todoModel → pool（db.ts） → Neon
                                     ↑ 不正JSONは todoRouter のエラー処理で 400
```

### 2.3 画面の流れ
```
GET /todo → index.ts → views/todo/index.ejs を返す
  → ブラウザが /todo/todo.js を読み込む → TodoApi.list() → 一覧を描画
```

## 3 DB の設計

テーブル名：todo_tasks（sql/todo/020_create_todo_tasks.sql）

| 列 | 型・制約 | JSON | 備考 |
| --- | --- | --- | --- |
| id | INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY | id | 自動採番 |
| title | TEXT NOT NULL、CHECK（1〜100 文字かつ空白だけでない） | title | 前後の空白を除いて保存する |
| is_completed | BOOLEAN NOT NULL DEFAULT FALSE | isCompleted | |
| created_at | TIMESTAMPTZ NOT NULL DEFAULT NOW() | createdAt | ISO 8601 文字列で返す |

- Controller でも同じ制約を確認し、DB の CHECK 違反に頼らずに 422 を返す
- SQL は Neon SQL Editor で手動実行し、sql/README.md に記録する（push だけでは実行されない）

## 4 API の共通ルール

- ベース URL：/api/v1/todos
- リクエスト・レスポンスともに Content-Type: application/json（DELETE 204 は本文なし）
- 成功：`{"status":"success","data":...}`
- エラー：`{"status":"error","code":"...","message":"...","details":[]}`
- JSON のキーは camelCase、DB の列は snake_case。変換は todoModel が行う
- ID は `/^[1-9][0-9]*$/` に一致し、かつ 2147483647（INTEGER の上限）以下のときだけ有効。それ以外は 400
- SQL は必ず `$1` などのプレースホルダを使う

## 5 各機能の設計

### 5.1 REQ-01 TODO 一覧を取得する
| 項目 | 内容 |
| --- | --- |
| メソッド・URL | GET /api/v1/todos |
| リクエスト本文 | なし |
| 成功 | 200 `{"status":"success","data":[{"id":1,"title":"課題を提出する","isCompleted":false,"createdAt":"2026-11-25T06:30:00.000Z"}]}` |
| 0 件 | 200 `{"status":"success","data":[]}` |
| 失敗 | 503 DB_UNAVAILABLE / 500 INTERNAL_ERROR |
| DB 処理 | `SELECT id, title, is_completed, created_at FROM todo_tasks ORDER BY id` |
| Model | `listTodos(): Promise<Todo[]>` |
| TodoApi | `list()` → data の配列を返す |
| 確認方法 | `curl.exe -i http://localhost:3000/api/v1/todos`、/todo の表示 |

### 5.2 REQ-02 TODO を登録する
| 項目 | 内容 |
| --- | --- |
| メソッド・URL | POST /api/v1/todos |
| リクエスト本文 | `{"title":"課題を提出する"}` |
| 成功 | 201 `{"status":"success","data":{"id":2,"title":"課題を提出する","isCompleted":false,"createdAt":"..."}}` |
| 失敗 | 400 BAD_REQUEST（不正 JSON、本文がオブジェクトでない、title 欠落、title が文字列でない）/ 422 VALIDATION_ERROR（空白だけ、前後の空白を除いて 101 文字以上）/ 503 / 500 |
| DB 処理 | `INSERT INTO todo_tasks (title) VALUES ($1) RETURNING id, title, is_completed, created_at` |
| Model | `createTodo(title: string): Promise<Todo>` |
| TodoApi | `create(title)` → data の TODO を返す |
| 確認方法 | 画面から登録、Console の fetch、一覧の件数 |

### 5.3 REQ-03 完了状態を変える
| 項目 | 内容 |
| --- | --- |
| メソッド・URL | PATCH /api/v1/todos/:id |
| リクエスト本文 | `{"isCompleted":true}` または `{"isCompleted":false}` |
| 成功 | 200 `{"status":"success","data":{...更新後の TODO...}}` |
| 失敗 | 400 BAD_REQUEST（不正な ID、不正 JSON、isCompleted 欠落・真偽値以外）/ 404 NOT_FOUND / 503 / 500 |
| DB 処理 | `UPDATE todo_tasks SET is_completed = $1 WHERE id = $2 RETURNING id, title, is_completed, created_at`。0 行なら 404 |
| Model | `updateTodoCompleted(id: number, isCompleted: boolean): Promise<Todo \| null>` |
| TodoApi | `update(id, isCompleted)` → data の TODO を返す |
| 確認方法 | 画面のチェックボックス、Network の PATCH、存在しない ID で 404 |

### 5.4 REQ-04 TODO を削除する
| 項目 | 内容 |
| --- | --- |
| メソッド・URL | DELETE /api/v1/todos/:id |
| リクエスト本文 | なし |
| 成功 | 204、本文なし |
| 失敗 | 400 BAD_REQUEST（不正な ID）/ 404 NOT_FOUND / 503 / 500 |
| DB 処理 | `DELETE FROM todo_tasks WHERE id = $1`。rowCount が 0 なら 404 |
| Model | `deleteTodo(id: number): Promise<boolean>` |
| TodoApi | `delete(id)` → 値を返さない（res.json() を呼ばない） |
| 確認方法 | 画面の削除（確認ダイアログ）、Network の DELETE が 204、存在しない ID で 404 |

## 6 画面と TodoApi の設計

### 6.1 画面（views/todo/index.ejs）
| 要素 | 内容 |
| --- | --- |
| 入力フォーム | タイトル入力欄（maxlength は付けず、サーバー側の 422 を確認できるようにする）、登録ボタン |
| 状態表示 | 処理中（「読み込み中…」）、エラーメッセージ、0 件時の「TODOがありません」 |
| 一覧 | 各行にチェックボックス（完了切替）、タイトル、削除ボタン。完了済みは打ち消し線 |

### 6.2 TodoApi クラス（public/todo/todo.js）
| メソッド | 呼ぶ API | 戻り値 |
| --- | --- | --- |
| list() | GET /api/v1/todos | TODO の配列 |
| create(title) | POST /api/v1/todos | 登録した TODO |
| update(id, isCompleted) | PATCH /api/v1/todos/:id | 更新した TODO |
| delete(id) | DELETE /api/v1/todos/:id | なし |

- 共通の内部メソッドで fetch を行い、res.ok でないときはエラー本文の code と message を持つ Error を投げる
- 204 のときは res.json() を呼ばない
- 画面イベントは TodoApi のメソッドだけを呼び、操作後は list() で一覧を描画し直す
- タイトルは textContent で表示する（innerHTML に入れない）
- 削除は confirm() で OK のときだけ TodoApi.delete() を呼ぶ

## 7 エラーはどこで処理するか

| 発生場所 | 例 | 処理する場所 | 応答 |
| --- | --- | --- | --- |
| JSON 解析 | 壊れた JSON | todoRouter のエラー処理 | 400 BAD_REQUEST |
| 入力チェック | title 欠落、ID 不正 | todoController | 400 |
| 入力チェック | 空白だけ、101 文字以上 | todoController | 422 |
| 対象なし | 存在しない ID | todoController（Model が null / false を返す） | 404 |
| DB 接続 | 接続不可、タイムアウト | todoController（エラー種別を判定） | 503 DB_UNAVAILABLE |
| その他 | 想定外の例外 | todoController / todoRouter | 500 INTERNAL_ERROR |
| 通信 | ネットワーク切断 | todo.js | 画面にエラー表示 |

- サーバー内部の詳細は console.error でログに出し、レスポンスには SQL や接続文字列を含めない
- DB 接続エラーの判定：pg のエラーコードが 08 で始まる、または ECONNREFUSED・ENOTFOUND・ETIMEDOUT・接続タイムアウトのとき 503

## 8 実装への注意事項
- index.ts の追記は import 1 行とルート 2 行に留める
- app.use('/api/v1/todos', todoRouter) は既存ルートと URL が重ならないことを確認する
- テスト用の ID をソースコードに固定しない
- 公開 URL は認証なしで誰でも操作できるため、個人情報や重要データを登録しない
- Preview と Production は同じ Neon DB を参照するため、テストでは自分が作った行だけを操作する
- 実装後は npm run build → npm start でも /todo、/todo/todo.js、/todo/todo.css が表示されることを確認する
