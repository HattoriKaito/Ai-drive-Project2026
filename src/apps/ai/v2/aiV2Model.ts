import { pool } from '../../../../db';

export const DISPLAY_TURN_LIMIT = 20; // 画面に表示する往復数
export const CONTEXT_TURN_LIMIT = 5;  // Geminiへ渡す往復数

export type Conversation = { id: number; title: string; createdAt: string };
export type Turn = { id: number; conversationId: number; prompt: string; response: string; createdAt: string };

type ConversationRow = { id: number; title: string; created_at: Date };
type TurnRow = { id: number; conversation_id: number; prompt: string; response_text: string; created_at: Date };

const CONVERSATION_COLUMNS = 'id, title, created_at';
const TURN_COLUMNS = 'id, conversation_id, prompt, response_text, created_at';

function toConversation(row: ConversationRow): Conversation {
  return { id: row.id, title: row.title, createdAt: new Date(row.created_at).toISOString() };
}

function toTurn(row: TurnRow): Turn {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    prompt: row.prompt,
    response: row.response_text,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

// 会話一覧（新しく作った会話が上）
export async function listConversations(): Promise<Conversation[]> {
  const result = await pool.query<ConversationRow>(
    `SELECT ${CONVERSATION_COLUMNS} FROM ai_conversations ORDER BY id DESC`
  );
  return result.rows.map(toConversation);
}

// 会話の作成
export async function createConversation(title: string): Promise<Conversation> {
  const result = await pool.query<ConversationRow>(
    `INSERT INTO ai_conversations (title) VALUES ($1) RETURNING ${CONVERSATION_COLUMNS}`,
    [title]
  );
  return toConversation(result.rows[0]);
}

// 会話が存在するか
export async function conversationExists(id: number): Promise<boolean> {
  const result = await pool.query('SELECT 1 FROM ai_conversations WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}

// 同じ会話の最新N往復を取得し、古い順に並べ直して返す（会話IDで必ず絞り込む）
export async function listRecentTurns(conversationId: number, limit: number): Promise<Turn[]> {
  const result = await pool.query<TurnRow>(
    `SELECT ${TURN_COLUMNS} FROM ai_conversation_turns
      WHERE conversation_id = $1
      ORDER BY id DESC
      LIMIT $2`,
    [conversationId, limit]
  );
  return result.rows.map(toTurn).reverse();
}

// 1往復を保存
export async function saveTurn(conversationId: number, prompt: string, response: string): Promise<Turn> {
  const result = await pool.query<TurnRow>(
    `INSERT INTO ai_conversation_turns (conversation_id, prompt, response_text)
      VALUES ($1, $2, $3) RETURNING ${TURN_COLUMNS}`,
    [conversationId, prompt, response]
  );
  return toTurn(result.rows[0]);
}
