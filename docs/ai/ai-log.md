# AI活用記録（docs/ai/ai-log.md）

| 日付 | 工程 | AIへの依頼 | 提案 | 判断 | 自分の確認 | 対応ID |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-11-25 | 現状調査 | 既存構成（index.ts、TODO の Router 構成、JSON 解析の位置）と追加先の調査 | src/apps/ai/ に追加、index.ts に全体の JSON 解析がないため AI 専用の解析を Router 内に置く案 | 採用 | index.ts を確認し、TODO も Router 内で express.json() を使っていることを確認 | DES-AI-006 |
| 2026-11-25 | 要件定義 | 要望書と共通条件から要件定義書を作成 | 参考例は履歴取得をデモ停止の対象外にしていた | 不採用。授業テキストの「デモ停止は質問・履歴とも 503」に合わせた | 授業テキスト 7.2 の標準 URL 表で確認 | REQ-AI-F010 |
| 2026-11-25 | 設計 | SDK の待機・再試行の設定方法の確認 | @google/genai の retryOptions.attempts は省略時 5 回 | attempts: 1 を明示する設計にした | SDK の型定義（HttpRetryOptions）で既定値を確認 | DES-AI-008 |
| 2026-11-25 | 設計 | 授業テキストの local.ts の扱い | local.ts を新設してローカル起動を分ける構成 | 不採用。既存 index.ts の app.listen でローカル・Vercel とも動いており、変更すると既存機能に影響するため | 既存の Production で /、/todo が動作していることを確認済み | DES-AI-002 |
