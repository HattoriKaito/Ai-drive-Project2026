import { Request, Response } from 'express';
import { listRecentLogs } from './aiModel';
import { sendAiError, logAiError } from './aiError';

// DBに接続できないエラーかどうか
function isDbUnavailable(error: unknown): boolean {
  const err = error as { code?: unknown; message?: unknown };
  const code = typeof err?.code === 'string' ? err.code : '';
  const message = typeof err?.message === 'string' ? err.message : '';
  return (
    code.startsWith('08') ||
    ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET', '57P01', '57P03'].includes(code) ||
    /timeout|Connection terminated/i.test(message)
  );
}

// GET /api/ai/history：0件でも200と空配列
export async function getHistory(_req: Request, res: Response): Promise<void> {
  try {
    const items = await listRecentLogs();
    res.status(200).json({ success: true, items });
  } catch (error) {
    logAiError(res, 'history', error);
    sendAiError(res, isDbUnavailable(error) ? 'DB_UNAVAILABLE' : 'HISTORY_FAILED');
  }
}
