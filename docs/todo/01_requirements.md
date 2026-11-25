# TODO機能 V1 要件定義書

- 対象リポジトリ：HattoriKaito/Ai-drive-Project2026
- 作業ブランチ：feature/todo-app
- 作成日：2026-11-25
- 版：V1

## 1 目的・対象範囲

### 1.1 目的
既存の Express＋TypeScript＋EJS サイトに、Neon（PostgreSQL）へ保存する TODO 機能を追加する。REST API（/api/v1/todos）と、Fetch で API を操作する画面（/todo）を作り、ローカル・Vercel Preview・Vercel Production の 3 環境で同じ動作を確認できる状態にすることを目的とする。

### 1.2 対象者
授業の受講者（作成者本人）と講師。認証は行わないため、公開 URL を知っている人は誰でも操作できる。

### 1.3 実装環境
| 項目 | 内容 |
| --- | --- |
| サーバー | Node.js、Express 5、TypeScript、EJS |
| DB | 作成者自身の Neon PostgreSQL（プロジェクト webapp-class） |
| DB 接続 | 既存の db.ts（pg の Pool）と環境変数 DATABASE_URL を使う |
| 公開先 | Vercel（Production＝main ブランチ、Preview＝main 以外のブランチ） |
| 画面 URL | /todo |
| API URL | /api/v1/todos |

### 1.4 既存機能の維持
既存のトップページ `/` と DB 接続確認 `/api/db-check` は変更せずに残す。TODO 機能の追加によってこれらが動かなくなってはならない。

### 1.5 対象外（V1 では作らない）
- 認証・ログイン、ユーザーごとのデータ分離
- 優先度、絞り込み、並び替えの切り替え（V2 で扱う）
- タイトルの編集（更新は完了状態のみ）
- 個人情報や実在のデータの登録（架空の授業用データのみを使う）

## 2 機能要件

### REQ-01 TODO 一覧を取得・表示する
| 項目 | 内容 |
| --- | --- |
| 操作 | /todo を開く、または登録・更新・削除の後に一覧を再取得する |
| API | GET /api/v1/todos |
| 入力 | なし |
| 結果 | 200。全 TODO を id の昇順で返す。画面では未完了・完了済みを同じ一覧に表示し、完了済みは打ち消し線で区別する |
| 0 件時 | 200 で `data: []`。画面に「TODOがありません」と表示する |
| エラー | DB 利用不可は 503、その他の内部エラーは 500。画面にエラーメッセージを表示する |
| 受け入れ条件 | データ 0 件なら GET の data が空配列になり、画面に「TODOがありません」と表示されること。1 件以上なら id 昇順で全件が表示されること |
| 確認方法 | ブラウザで /todo を表示、curl.exe -i またはブラウザの Network タブで GET の応答を確認 |

### REQ-02 TODO を登録する
| 項目 | 内容 |
| --- | --- |
| 操作 | 画面の入力欄にタイトルを入力し、登録ボタンを押す |
| API | POST /api/v1/todos |
| 入力 | JSON `{"title":"課題を提出する"}` |
| 入力制約 | title は必須の文字列。前後の空白を除いて 1〜100 文字 |
| 結果 | 201。登録した TODO（id 付き、isCompleted は false）を返す。画面の一覧に追加される |
| エラー | JSON 不正・title 欠落・文字列以外は 400。空白だけ・101 文字以上は 422 |
| 受け入れ条件 | 正しい title を送ると 201 で ID 付きの TODO が返り、再取得した一覧が 1 件増えること。不正な入力では DB に保存されず、400 または 422 の統一エラー JSON が返ること |
| 確認方法 | 画面から登録、Network タブで POST の応答、一覧の件数を確認 |

### REQ-03 完了状態を部分更新する
| 項目 | 内容 |
| --- | --- |
| 操作 | 一覧の各 TODO のチェックボックスを切り替える（オン＝完了、オフ＝未完了に戻す） |
| API | PATCH /api/v1/todos/:id |
| 入力 | パスの id（1 以上の整数）、JSON `{"isCompleted":true}` または `{"isCompleted":false}` |
| 結果 | 200。更新後の TODO を返す。画面の表示が切り替わる |
| エラー | id が整数でない・isCompleted が真偽値でない・JSON 不正は 400。該当 id がなければ 404 |
| 受け入れ条件 | 存在する id に isCompleted を送ると 200 が返り、その行だけ完了状態が変わること。存在しない id では 404 の統一エラー JSON が返ること |
| 確認方法 | 画面で切り替え、Network タブで PATCH の応答、再取得後の状態を確認 |

### REQ-04 TODO を削除する
| 項目 | 内容 |
| --- | --- |
| 操作 | 一覧の各 TODO の削除ボタンを押し、確認ダイアログで OK を選ぶ（キャンセル時は何もしない） |
| API | DELETE /api/v1/todos/:id |
| 入力 | パスの id（1 以上の整数） |
| 結果 | 204、本文なし。画面の一覧から消える |
| エラー | id が整数でない場合は 400。該当 id がなければ 404 |
| 受け入れ条件 | 存在する id を指定すると 204（本文なし）が返り、その id が一覧から消えること。存在しない id では 404 の統一エラー JSON が返ること |
| 確認方法 | 画面から削除、Network タブで DELETE のステータス、一覧の再取得を確認 |

## 3 共通のデータ・エラー条件

### 3.1 データ（テーブル todo_tasks）
| 列 | 型・条件 | JSON のキー |
| --- | --- | --- |
| id | INTEGER、自動採番、主キー | id |
| title | TEXT、必須、前後の空白を除き 1〜100 文字 | title |
| is_completed | BOOLEAN、必須、初期値 false | isCompleted |
| created_at | TIMESTAMPTZ、必須、初期値 NOW() | createdAt |

JSON のキーは camelCase、DB の列は snake_case とする。

### 3.2 成功時のレスポンス
- GET・POST・PATCH：`{"status":"success","data":...}`
- 一覧の data は配列、登録・更新の data は TODO 1 件 `{id,title,isCompleted,createdAt}`
- DELETE：204、本文なし

### 3.3 エラー時のレスポンス
本文は `{"status":"error","code":"...","message":"...","details":[]}` に統一する。SQL 文や接続文字列は返さない。

| 条件 | ステータス | code |
| --- | --- | --- |
| JSON 不正、title の欠落、型違い、不正な ID 形式 | 400 | BAD_REQUEST |
| title が空白だけ、101 文字以上 | 422 | VALIDATION_ERROR |
| 対象の ID が存在しない | 404 | NOT_FOUND |
| 内部エラー | 500 | INTERNAL_ERROR |
| DB 利用不可 | 503 | DB_UNAVAILABLE |

### 3.4 画面の共通条件
- 画面のイベントからは Fetch で API を呼ぶ（呼び出しをまとめる TodoApi クラスは設計書で定義する）
- 操作の後は一覧を再取得して表示し直す（ページの再読み込みは不要）
- 処理中・エラー・0 件の状態を画面に表示する
- タイトルは HTML として解釈させず、文字列として表示する

## 4 環境別の確認方法

| 環境 | URL | 参照する DB |
| --- | --- | --- |
| Local | http://localhost:3000/todo | .env の DATABASE_URL（Neon 通常接続） |
| Preview | feature/todo-app を push したときの Vercel Preview URL | Vercel 環境変数 DATABASE_URL（Neon プール接続） |
| Production | https://ai-drive-project2026-tau-ochre.vercel.app/todo | 同上 |

- Preview と Production は同じ Neon DB を参照する。Preview で削除したデータは Production からも消える
- テストには個人情報を含まない一意のタイトルを使い、自分が作った行の ID だけを更新・削除する
- 0 件の確認は、空の状態のテーブルで行う。既存の行がある場合は件数を記録し、他のデータを TRUNCATE しない
- 各環境で既存の `/` と `/api/db-check` が動くことも確認する
- 結果は docs/todo/04_test_results.md に記録する

## 5 決定事項・要確認事項

### 5.1 決定事項
1. 一覧の表示：完了済みの TODO も未完了と同じ一覧に表示し、完了済みは打ち消し線で区別する
2. 完了の取り消し：チェックボックスで切り替え、完了済みを未完了に戻せるようにする
3. 削除：削除前に確認ダイアログを表示する

### 5.2 要確認事項
1. 実際のファイル配置（src/apps/todo/、views/todo/、public/todo/）は設計書で確定する
