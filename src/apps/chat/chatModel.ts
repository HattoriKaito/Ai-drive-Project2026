import { pool } from '../../../db';

export const DEFAULT_ROOM_ID = 'default';
export const MAX_ROOM_SEATS = 5;          // 1ルームの定員（接続単位）
export const SEAT_TTL_SECONDS = 60;       // 更新が止まった席を回収するまでの時間
export const HISTORY_LIMIT = 20;          // 入室・再入室時に表示する件数

export type ChatMessage = { id: number; username: string; comment: string; createdAt: string };

type ChatMessageRow = { id: string; username: string; comment: string; created_at: Date };

// BIGINTはpgでは文字列で返るため数値に変換する
function toChatMessage(row: ChatMessageRow): ChatMessage {
  return {
    id: Number(row.id),
    username: row.username,
    comment: row.comment,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

// 投稿を保存し、DBで確定したID・作成日時を含めて返す
export async function insertMessage(roomId: string, username: string, comment: string): Promise<ChatMessage> {
  const result = await pool.query<ChatMessageRow>(
    `INSERT INTO chat_messages (room_id, username, comment)
     VALUES ($1, $2, $3)
     RETURNING id, username, comment, created_at`,
    [roomId, username, comment]
  );
  return toChatMessage(result.rows[0]);
}

// ルームの最新20件を選び、その20件を古い順に返す
export async function selectLatestMessages(roomId: string): Promise<ChatMessage[]> {
  const result = await pool.query<ChatMessageRow>(
    `SELECT id, username, comment, created_at FROM (
       SELECT id, username, comment, created_at
       FROM chat_messages
       WHERE room_id = $1
       ORDER BY id DESC
       LIMIT $2
     ) AS latest
     ORDER BY id ASC`,
    [roomId, HISTORY_LIMIT]
  );
  return result.rows.map(toChatMessage);
}

// 複数台の同期用：指定IDより新しい投稿を古い順に返す
export async function selectMessagesAfter(roomId: string, afterId: number): Promise<ChatMessage[]> {
  const result = await pool.query<ChatMessageRow>(
    `SELECT id, username, comment, created_at
     FROM chat_messages
     WHERE room_id = $1 AND id > $2
     ORDER BY id ASC
     LIMIT 100`,
    [roomId, afterId]
  );
  return result.rows.map(toChatMessage);
}

export async function selectMaxMessageId(roomId: string): Promise<number> {
  const result = await pool.query<{ max_id: string | null }>(
    'SELECT MAX(id) AS max_id FROM chat_messages WHERE room_id = $1',
    [roomId]
  );
  return Number(result.rows[0]?.max_id ?? 0);
}

// 席の確保：ルーム単位のロックで「期限切れの回収 → 人数の確認 → 追加」を一続きに行う
// （複数台のサーバーが同時に入室処理をしても6席目は作られない）
export async function acquireSeat(params: {
  roomId: string;
  seatId: string;
  instanceId: string;
}): Promise<{ acquired: boolean; activeCount: number }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`chat_room:${params.roomId}`]);
    await client.query(
      `DELETE FROM chat_room_seats
       WHERE room_id = $1 AND last_seen_at < NOW() - ($2 * INTERVAL '1 second')`,
      [params.roomId, SEAT_TTL_SECONDS]
    );
    const countResult = await client.query<{ count: string }>(
      'SELECT COUNT(*) AS count FROM chat_room_seats WHERE room_id = $1',
      [params.roomId]
    );
    const activeCount = Number(countResult.rows[0].count);
    if (activeCount >= MAX_ROOM_SEATS) {
      await client.query('COMMIT');
      return { acquired: false, activeCount };
    }
    await client.query(
      'INSERT INTO chat_room_seats (seat_id, room_id, instance_id) VALUES ($1, $2, $3)',
      [params.seatId, params.roomId, params.instanceId]
    );
    await client.query('COMMIT');
    return { acquired: true, activeCount: activeCount + 1 };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function releaseSeat(seatId: string): Promise<void> {
  await pool.query('DELETE FROM chat_room_seats WHERE seat_id = $1', [seatId]);
}

// このサーバーが持つ席の最終確認時刻を更新する
export async function touchSeats(seatIds: string[]): Promise<void> {
  if (seatIds.length === 0) return;
  await pool.query('UPDATE chat_room_seats SET last_seen_at = NOW() WHERE seat_id = ANY($1::text[])', [seatIds]);
}
