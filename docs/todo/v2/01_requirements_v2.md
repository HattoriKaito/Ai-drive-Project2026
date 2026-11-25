# TODO機能 V2 要件定義書

- 対象リポジトリ：HattoriKaito/Ai-drive-Project2026
- 作業ブランチ：feature/todo-v2（V1 を提出した main から作成）
- 根拠：docs/todo/01_requirements.md（V1）
- 作成日：2026-11-25

## 1 目的・対象範囲

### 1.1 目的
V1 の TODO 機能を維持したまま、優先度（priority）と、完了状態・優先度による絞り込みを持つ V2 を追加する。V2 は V1 を上書きせず、別の URL・API・テーブルとして並存させる。

### 1.2 V1 との関係（維持条件）
| 項目 | V1（変更しない） | V2（追加） |
| --- | --- | --- |
| 画面 | /todo | /todo-v2 |
| API | /api/v1/todos | /api/v2/todos |
| テーブル | todo_tasks | v2_todo_tasks |
| ブラウザ側クラス | TodoApi | TodoApiV2 |

- V1 の API・画面・テーブル・応答形式は変更しない。V2 の追加後も V1 の 4 操作が動くこと
- V1 のデータは V2 へ自動移行しない（移行は対象外）
- 既存の `/` と `/api/db-check` も引き続き動くこと

### 1.3 対象外
- 認証、タイトルの編集、並び替えの切り替え、V1 から V2 へのデータ移行
- 個人情報や実在のデータの登録

## 2 追加・変更する機能

### REQ-V2-01 一覧を取得し、条件で絞り込む
| 項目 | 内容 |
| --- | --- |
| 操作 | /todo-v2 を開く。絞り込み欄で完了状態（すべて／未完了／完了）と優先度（すべて／low／normal／high）を選ぶ |
| API | GET /api/v2/todos、GET /api/v2/todos?completed=false&priority=high など |
| 入力 | クエリ completed（true または false）、priority（low・normal・high）。どちらも省略可 |
| 結果 | 200。条件なしなら全件、条件ありなら一致する行だけを id 昇順で返す。各 TODO に priority を含む |
| 0 件時 | 200 で `data: []`。画面に「TODOがありません」 |
| エラー | completed が true・false 以外、同じクエリが複数指定された場合は 400。priority の値が許可値以外なら 422 |
| 受け入れ条件 | 条件なしの GET で全件、`completed=false&priority=high` で未完了かつ high の行だけが返ること。`completed=yes` で 400、`priority=urgent` で 422 が返ること |
| 確認方法 | 画面の絞り込み、Network タブ、Console の fetch |

### REQ-V2-02 優先度を付けて登録する
| 項目 | 内容 |
| --- | --- |
| 操作 | タイトルを入力し、優先度を選んで登録する（初期選択は normal） |
| API | POST /api/v2/todos |
| 入力 | `{"title":"課題を提出する","priority":"high"}`。priority は省略可（省略時 normal） |
| 結果 | 201。登録した TODO（priority を含む）を返す |
| エラー | JSON 不正・title 欠落・title が文字列以外・priority が文字列以外は 400。title が空白だけ・101 文字以上、priority が許可値以外は 422 |
| 受け入れ条件 | priority を省略すると normal で登録され、指定するとその値で登録されること。`priority:"urgent"` では 422 で保存されないこと |
| 確認方法 | 画面から登録、Network タブ |

### REQ-V2-03 完了状態または優先度を部分更新する
| 項目 | 内容 |
| --- | --- |
| 操作 | 一覧のチェックボックスで完了状態を、各行の優先度の選択欄で優先度を変更する |
| API | PATCH /api/v2/todos/:id |
| 入力 | `{"isCompleted":true}`、`{"priority":"low"}`、または両方。少なくとも一方が必要 |
| 結果 | 200。更新後の TODO を返す。送らなかった項目は変わらない |
| エラー | ID 不正、どちらも含まない、isCompleted が真偽値以外、priority が文字列以外は 400。priority が許可値以外は 422。対象がなければ 404 |
| 受け入れ条件 | priority だけを送ると優先度だけが、isCompleted だけを送ると完了状態だけが変わること。空の本文 `{}` で 400、存在しない ID で 404 が返ること |
| 確認方法 | 画面で変更、Network タブ |

### REQ-V2-04 削除する
| 項目 | 内容 |
| --- | --- |
| 操作 | 削除ボタンを押し、確認ダイアログで OK を選ぶ |
| API | DELETE /api/v2/todos/:id |
| 結果 | 204、本文なし |
| エラー | ID 不正は 400、対象がなければ 404 |
| 受け入れ条件 | 存在する ID で 204 となり一覧から消えること。存在しない ID で 404 が返ること |
| 確認方法 | 画面から削除、Network タブ |

### REQ-V2-05 V1 の回帰確認
V2 の追加後も、/todo と /api/v1/todos の一覧・登録・更新・削除、`/`、`/api/db-check` が V1 と同じ結果になること。

## 3 共通のデータ・エラー条件

### 3.1 データ（テーブル v2_todo_tasks）
| 列 | 型・条件 | JSON |
| --- | --- | --- |
| id | INTEGER、自動採番、主キー | id |
| title | TEXT、必須、前後の空白を除き 1〜100 文字 | title |
| is_completed | BOOLEAN、必須、初期値 false | isCompleted |
| priority | TEXT、必須、low・normal・high のいずれか、初期値 normal | priority |
| created_at | TIMESTAMPTZ、必須、初期値 NOW() | createdAt |

### 3.2 応答形式
V1 と同じ。成功は `{"status":"success","data":...}`、エラーは `{"status":"error","code":"...","message":"...","details":[]}`、DELETE は 204 で本文なし。

### 3.3 400 と 422 の使い分け
- 400 BAD_REQUEST：形式が正しくない（JSON 不正、必須項目の欠落、型違い、ID 形式、completed が true・false 以外、クエリの重複）
- 422 VALIDATION_ERROR：形式は正しいが値が許可されない（title が空白だけ・101 文字以上、priority が low・normal・high 以外）

## 4 環境別の確認方法
| 環境 | V2 画面 | V1 回帰 |
| --- | --- | --- |
| Local | http://localhost:3000/todo-v2 | http://localhost:3000/todo |
| Preview | feature/todo-v2 の Preview URL/todo-v2 | 同 /todo |
| Production | マージ後に https://ai-drive-project2026-tau-ochre.vercel.app/todo-v2 | 同 /todo |

- Preview と Production は同じ Neon DB を参照する。自分が作った行だけを更新・削除する
- 結果は docs/todo/v2/04_test_results_v2.md に記録する

## 5 決定事項
1. 画面は V1 と同様、完了済みも同じ一覧に表示し打ち消し線で区別する
2. 一覧の各行で優先度を変更できる（選択欄）
3. 優先度は表示上「高・中・低」のラベルを併記する（API の値は high・normal・low）
4. 絞り込み条件を変えたら自動で一覧を再取得する
