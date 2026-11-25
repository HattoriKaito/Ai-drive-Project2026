-- リアルタイムチャット（docs/chat/03_design.md DES-CHAT-003）
-- 既存のテーブルは変更・削除しない
CREATE TABLE IF NOT EXISTS chat_messages (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  room_id TEXT NOT NULL DEFAULT 'default',
  username TEXT NOT NULL CHECK (
    char_length(username) BETWEEN 1 AND 20
    AND char_length(btrim(username)) > 0
  ),
  comment TEXT NOT NULL CHECK (
    char_length(comment) BETWEEN 1 AND 500
    AND char_length(btrim(comment)) > 0
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ルームごとの最新N件・差分の取得用
CREATE INDEX IF NOT EXISTS chat_messages_room_id_id_idx
  ON chat_messages (room_id, id DESC);

-- 参加中の席（定員管理。複数台のサーバーで共有する）
CREATE TABLE IF NOT EXISTS chat_room_seats (
  seat_id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL DEFAULT 'default',
  instance_id TEXT NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_room_seats_room_id_last_seen_idx
  ON chat_room_seats (room_id, last_seen_at);

-- 実行後の確認（初回はどちらも0件）
-- SELECT * FROM chat_messages ORDER BY id;
-- SELECT * FROM chat_room_seats;
