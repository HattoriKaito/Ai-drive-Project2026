-- TODO機能 V2 のテーブル（docs/todo/v2/02_design_v2.md 第3章）
-- V1 の todo_tasks は変更・削除しない
CREATE TABLE IF NOT EXISTS v2_todo_tasks (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title TEXT NOT NULL CHECK (
    char_length(title) BETWEEN 1 AND 100
    AND char_length(btrim(title)) > 0
  ),
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 実行後の確認（初回は0件）
-- SELECT id, title, priority FROM v2_todo_tasks ORDER BY id;
-- V1 の確認（V1 のデータが残っていること）
-- SELECT * FROM todo_tasks ORDER BY id;
