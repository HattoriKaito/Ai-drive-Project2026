import { pool } from '../../../db';

// APIで返す1件（DBの列名をcamelCaseに変換したもの）
export type AiQaLog = {
  id: number;
  prompt: string;
  response: string;
  createdAt: string;
};

type AiQaLogRow = {
  id: number;
  prompt: string;
  response_text: string;
  created_at: Date;
};

const COLUMNS = 'id, prompt, response_text, created_at';
export const HISTORY_LIMIT = 20;

function toAiQaLog(row: AiQaLogRow): AiQaLog {
  return {
    id: row.id,
    prompt: row.prompt,
    response: row.response_text,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

// 最新20件（作成日時の降順、同日時はIDの降順）
export async function listRecentLogs(): Promise<AiQaLog[]> {
  const result = await pool.query<AiQaLogRow>(
    `SELECT ${COLUMNS} FROM ai_qa_logs ORDER BY created_at DESC, id DESC LIMIT $1`,
    [HISTORY_LIMIT]
  );
  return result.rows.map(toAiQaLog);
}

// 質問と回答を1行保存し、保存した内容を返す
export async function saveLog(prompt: string, response: string): Promise<AiQaLog> {
  const result = await pool.query<AiQaLogRow>(
    `INSERT INTO ai_qa_logs (prompt, response_text) VALUES ($1, $2) RETURNING ${COLUMNS}`,
    [prompt, response]
  );
  return toAiQaLog(result.rows[0]);
}
