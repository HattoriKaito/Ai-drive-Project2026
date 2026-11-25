-- AI対話アプリ V2：会話と往復（docs/ai/v2/design.md DES-V2-03）
-- 既存の todo_tasks・v2_todo_tasks・ai_qa_logs は変更・削除しない
CREATE TABLE IF NOT EXISTS ai_conversations (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title TEXT NOT NULL CHECK (
    char_length(title) BETWEEN 1 AND 50
    AND char_length(btrim(title)) > 0
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_conversation_turns (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES ai_conversations (id),
  prompt TEXT NOT NULL CHECK (
    char_length(prompt) BETWEEN 1 AND 2000
    AND char_length(btrim(prompt)) > 0
  ),
  response_text TEXT NOT NULL CHECK (char_length(response_text) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 会話ごとの最新N往復の取得用
CREATE INDEX IF NOT EXISTS ai_conversation_turns_conversation_id_id_idx
  ON ai_conversation_turns (conversation_id, id DESC);

-- 実行後の確認（初回はどちらも0件）
-- SELECT * FROM ai_conversations ORDER BY id;
-- SELECT * FROM ai_conversation_turns ORDER BY id;
