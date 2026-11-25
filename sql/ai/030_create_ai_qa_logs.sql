-- AI質問アプリ：質問・回答の履歴（docs/ai/spec.md 第5章）
-- 既存の todo_tasks・v2_todo_tasks は変更・削除しない
CREATE TABLE IF NOT EXISTS ai_qa_logs (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  prompt TEXT NOT NULL CHECK (
    char_length(prompt) BETWEEN 1 AND 2000
    AND char_length(btrim(prompt)) > 0
  ),
  response_text TEXT NOT NULL CHECK (char_length(response_text) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 履歴（作成日時の降順、同日時はIDの降順）の取得用
CREATE INDEX IF NOT EXISTS ai_qa_logs_created_at_id_idx
  ON ai_qa_logs (created_at DESC, id DESC);

-- 実行後の確認（初回は0件）
-- SELECT id, prompt, response_text, created_at FROM ai_qa_logs ORDER BY created_at DESC, id DESC LIMIT 20;
