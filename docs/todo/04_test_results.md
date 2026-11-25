# TODO V1 テスト結果

- Gitのブランチ・コミット：feature/todo-app（コミットIDは push 後に記入）
- Neonブランチ・DB名（接続文字列は書かない）：patient-recipe-90853169 / production / neondb
- Local URL、実施日時、結果：http://localhost:3000/todo、2026-11-25、下表のとおり
- Preview URL、Deploymentのソースブランチ、実施日時、結果：未実施
- Production URL、Deploymentのソースブランチ、実施日時、結果：未実施

## テスト表

| テスト | 期待結果 | Local | Preview | Production |
| --- | --- | --- | --- | --- |
| 0件の一覧 | 空DBで200、dataが空配列、画面に「TODOがありません」 | OK（画面表示を確認） | 未実施 | 未実施 |
| 登録 | 201、ID付きTODO | OK（Console で 201、画面から登録） | 未実施 | 未実施 |
| 完了切替 | 200、状態が変わる | OK（Console で 200 isCompleted:true、画面で完了・未完了の切替） | 未実施 | 未実施 |
| 削除 | 204、本文なし | OK（Console で 204、画面で確認ダイアログ→削除） | 未実施 | 未実施 |
| title欠落 | 400、統一エラーJSON | OK（開発時の API テストで確認） | 未実施 | 未実施 |
| 空白だけのtitle | 422、統一エラーJSON | OK（画面にエラーメッセージ表示） | 未実施 | 未実施 |
| 存在しないID | 404、統一エラーJSON | OK（削除済みIDの再DELETEで 404） | 未実施 | 未実施 |
| 既存TOPとDB確認 | 従来の機能が動く | OK | 未実施 | 未実施 |

## 機能別

- REQ-01 一覧（0件を含む）：Local OK
- REQ-02 登録（正常、title欠落、空白、101文字）：Local OK（正常・空白は画面、title欠落・101文字は開発時の API テスト）
- REQ-03 更新（正常、存在しないID）：Local 正常 OK、存在しないIDは未実施
- REQ-04 削除（正常、存在しないID）：Local OK
- 既存TOPとDB確認：Local OK
- 見つかった不具合、原因、修正後の再テスト：/todo が /todo/ へリダイレクトされた。public/todo/ フォルダーと画面URLが重なり express.static がリダイレクトしていたため、redirect: false を追加。修正後 /todo が 200 で表示されることを確認
- 文書の仕様と実装に残る差分：なし（express.static の設定追加は設計書第8章に追記済み）
