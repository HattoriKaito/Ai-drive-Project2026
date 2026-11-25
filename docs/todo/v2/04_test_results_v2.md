# TODO V2 テスト結果

- Gitのブランチ・コミット：feature/todo-v2（Preview は 061d471 で実施）
- Neonブランチ・DB名（接続文字列は書かない）：patient-recipe-90853169 / production / neondb（V1：todo_tasks、V2：v2_todo_tasks）
- Local URL、実施日時、結果：http://localhost:3000/todo-v2、2026-11-25、下表のとおり
- Preview URL、Deploymentのソースブランチ、実施日時、結果：https://ai-drive-project2026-nnqqaxwkq-kaitos-projects-7f072cea.vercel.app/todo-v2、feature/todo-v2、2026-11-25、下表のとおり（ログイン済みブラウザで実施）
- Production URL、Deploymentのソースブランチ、実施日時、結果：未実施

## V2 テスト表

| テスト | 期待結果 | Local | Preview | Production |
| --- | --- | --- | --- | --- |
| 0件の一覧 | 空のv2_todo_tasksで200、data: []、「TODOがありません」 | OK（初回表示） | 未実施（共有DBのため。0 件は Local で確認） | 未実施 |
| 優先度付き登録 | 201、指定したpriority | OK（画面で高・低、API で high を登録） | OK（201、high） | 未実施 |
| 優先度省略の登録 | 201、priority: normal | OK（API で priority を省略して 201、priority: normal） | OK（201、normal） | 未実施 |
| 完了切替 | 200、isCompletedだけ変わる | OK（API：isCompleted のみ送信で priority は high のまま） | OK（200、priority は high のまま） | 未実施 |
| 優先度の変更 | 200、priorityだけ変わる | OK（API：priority のみ送信で isCompleted は false のまま） | OK（200、isCompleted は false のまま） | 未実施 |
| 絞り込み（completed=false） | 未完了だけ | OK | 未実施（completed=true&priority=high で絞り込みを確認） | 未実施 |
| 絞り込み（completed=false&priority=high） | 未完了かつhighだけ（該当なしは0件） | OK（画面で 0 件表示。API の completed=true&priority=high で完了かつ high の 2 件だけ） | OK（completed=true&priority=high で完了かつ high の 2 件だけ） | 未実施 |
| 削除 | 204 | OK（画面・API） | OK（204） | 未実施 |
| completed不正（completed=yes） | 400 | OK | OK（400） | 未実施 |
| priority不正（urgent） | 422（GET・POST・PATCH） | OK（GET・POST・PATCH とも 422、priority が数値の POST は 400） | OK（GET・POST・PATCH とも 422、数値は 400） | 未実施 |
| PATCHで項目なし（{}） | 400 | OK | OK（400） | 未実施 |
| 存在しないID | 404 | OK（PATCH・DELETE とも 404） | OK（PATCH・DELETE とも 404） | 未実施 |

## V1 回帰テスト

| テスト | 期待結果 | Local | Preview | Production |
| --- | --- | --- | --- | --- |
| /todo の一覧・登録・更新・削除 | V1 と同じ | OK（画面、API で 201→200→200→204） | OK（API で 201→200→200→204） | 未実施 |
| V1 と V2 のデータが分かれている | V2 の TODO が /todo に出ない | OK（V1 一覧に priority がなく、V2 の行も含まれない） | OK（V1 一覧に V2 の行・priority なし） | 未実施 |
| / と /api/db-check | 従来どおり | OK | 未実施 | 未実施 |

## 見つかった不具合・差分
- 不具合：なし
- 文書の仕様と実装に残る差分：なし
