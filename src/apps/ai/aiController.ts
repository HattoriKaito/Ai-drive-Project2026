import { Request, Response } from 'express';
import { listRecentLogs, saveLog } from './aiModel';
import { generateAnswer } from './aiService';
import { AiPublicError, sendAiError, logAiError } from './aiError';

const PROMPT_MAX_LENGTH = 2000; // Unicodeコードポイント数

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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

// POST /api/ai/ask：入力検証 → AI回答 → DB保存 → 201（保存まで完了したときだけ成功）
export async function askAi(req: Request, res: Response): Promise<void> {
  // 1. 入力検証（ここで失敗したらAIを呼ばず、保存もしない）
  if (!req.is('application/json')) {
    return sendAiError(res, 'UNSUPPORTED_MEDIA_TYPE');
  }
  const body: unknown = req.body;
  if (!isPlainObject(body) || typeof body.prompt !== 'string') {
    return sendAiError(res, 'INVALID_PROMPT');
  }
  const prompt = body.prompt.trim();
  const length = [...prompt].length; // コードポイント数（絵文字も1文字）
  if (length === 0) {
    return sendAiError(res, 'INVALID_PROMPT');
  }
  if (length > PROMPT_MAX_LENGTH) {
    return sendAiError(res, 'PROMPT_TOO_LONG');
  }

  // 2. AI回答の取得（今回の質問だけを渡す）
  let answer: string;
  try {
    answer = await generateAnswer(prompt);
  } catch (error) {
    logAiError(res, 'generate', error);
    return sendAiError(res, error instanceof AiPublicError ? error.code : 'AI_UNAVAILABLE');
  }

  // 3. DB保存（失敗したら回答は返さない）
  try {
    const item = await saveLog(prompt, answer);
    res.status(201).json({ success: true, item });
  } catch (error) {
    logAiError(res, 'save', error);
    sendAiError(res, 'SAVE_FAILED');
  }
}
