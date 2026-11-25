# TODO V2 テスト結果

- Gitのブランチ・コミット：feature/todo-v2（push 後に記入）
- Neonブランチ・DB名（接続文字列は書かない）：patient-recipe-90853169 / production / neondb（V1：todo_tasks、V2：v2_todo_tasks）
- Local URL、実施日時、結果：http://localhost:3000/todo-v2、2026-11-25、下表のとおり
- Preview URL、Deploymentのソースブランチ、実施日時、結果：未実施
- Production URL、Deploymentのソースブランチ、実施日時、結果：未実施

## V2 テスト表

| テスト | 期待結果 | Local | Preview | Production |
| --- | --- | --- | --- | --- |
| 0件の一覧 | 空のv2_todo_tasksで200、data: []、「TODOがありません」 | OK（初回表示） | 未実施 | 未実施 |
| 優先度付き登録 | 201、指定したpriority | OK（高・低で登録） | 未実施 | 未実施 |
| 優先度省略の登録 | 201、priority: normal | OK（画面の初期値「中」で登録）※API での省略は Preview で確認 | 未実施 | 未実施 |
| 完了切替 | 200、isCompletedだけ変わる | OK | 未実施 | 未実施 |
| 優先度の変更 | 200、priorityだけ変わる | OK | 未実施 | 未実施 |
| 絞り込み（completed=false） | 未完了だけ | OK | 未実施 | 未実施 |
| 絞り込み（completed=false&priority=high） | 未完了かつhighだけ（該当なしは0件） | OK（0件で「TODOがありません」） | 未実施 | 未実施 |
| 削除 | 204 | OK | 未実施 | 未実施 |
| completed不正（completed=yes） | 400 | OK（開発時の API テスト） | 未実施 | 未実施 |
| priority不正（urgent） | 422（GET・POST・PATCH） | OK（開発時の API テスト） | 未実施 | 未実施 |
| PATCHで項目なし（{}） | 400 | OK（開発時の API テスト） | 未実施 | 未実施 |
| 存在しないID | 404 | 未実施 | 未実施 | 未実施 |

## V1 回帰テスト

| テスト | 期待結果 | Local | Preview | Production |
| --- | --- | --- | --- | --- |
| /todo の一覧・登録・更新・削除 | V1 と同じ | OK | 未実施 | 未実施 |
| V1 と V2 のデータが分かれている | V2 の TODO が /todo に出ない | OK | 未実施 | 未実施 |
| / と /api/db-check | 従来どおり | OK | 未実施 | 未実施 |

## 見つかった不具合・差分
- 不具合：なし
- 文書の仕様と実装に残る差分：なし
