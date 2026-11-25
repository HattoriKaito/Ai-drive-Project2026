import { Request, Response } from 'express';
import {
  DISPLAY_TURN_LIMIT,
  CONTEXT_TURN_LIMIT,
  listConversations,
  createConversation,
  conversationExists,
  listRecentTurns,
  saveTurn,
  Turn,
} from './aiV2Model';
import { buildContents, generateAnswerWithHistory } from './aiV2Service';
import { AiV2PublicError, sendAiV2Error, logAiV2Error, isDbUnavailable } from './aiV2Error';

const TITLE_MAX_LENGTH = 50;   // コードポイント数
const PROMPT_MAX_LENGTH = 2000; // コードポイント数
const INTEGER_MAX = 2147483647;

export function parseConversationId(raw: unknown): number | null {
  if (typeof raw !== 'string' || !/^[1-9][0-9]*$/.test(raw)) return null;
  const id = Number(raw);
  return id <= INTEGER_MAX ? id : null;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function codePointLength(text: string): number {
  return [...text].length;
}

function sendDbError(res: Response, stage: string, error: unknown): void {
  logAiV2Error(res, stage, error);
  sendAiV2Error(res, isDbUnavailable(error) ? 'DB_UNAVAILABLE' : 'INTERNAL_ERROR');
}

// GET /api/ai/v2/conversations
export async function getConversations(_req: Request, res: Response): Promise<void> {
  try {
    const items = await listConversations();
    res.status(200).json({ success: true, items });
  } catch (error) {
    sendDbError(res, 'list-conversations', error);
  }
}

// POST /api/ai/v2/conversations
export async function postConversation(req: Request, res: Response): Promise<void> {
  if (!req.is('application/json')) return sendAiV2Error(res, 'UNSUPPORTED_MEDIA_TYPE');
  const body: unknown = req.body;
  if (!isPlainObject(body) || typeof body.title !== 'string') return sendAiV2Error(res, 'INVALID_TITLE');
  const title = body.title.trim();
  const length = codePointLength(title);
  if (length === 0) return sendAiV2Error(res, 'INVALID_TITLE');
  if (length > TITLE_MAX_LENGTH) return sendAiV2Error(res, 'TITLE_TOO_LONG');

  try {
    const item = await createConversation(title);
    res.status(201).json({ success: true, item });
  } catch (error) {
    sendDbError(res, 'create-conversation', error);
  }
}

// GET /api/ai/v2/conversations/:id/turns（最新20往復を古い順）
export async function getTurns(req: Request, res: Response): Promise<void> {
  const conversationId = parseConversationId(req.params.id);
  if (conversationId === null) return sendAiV2Error(res, 'INVALID_ID');
  try {
    if (!(await conversationExists(conversationId))) return sendAiV2Error(res, 'CONVERSATION_NOT_FOUND');
    const items = await listRecentTurns(conversationId, DISPLAY_TURN_LIMIT);
    res.status(200).json({ success: true, items });
  } catch (error) {
    sendDbError(res, 'list-turns', error);
  }
}

// POST /api/ai/v2/conversations/:id/turns
// 入力・会話の確認 → 同じ会話の最新5往復 → contents組み立て → Gemini → 1往復の保存 → 201
export async function postTurn(req: Request, res: Response): Promise<void> {
  // 1. 入力検証（失敗したらGeminiを呼ばない）
  const conversationId = parseConversationId(req.params.id);
  if (conversationId === null) return sendAiV2Error(res, 'INVALID_ID');
  if (!req.is('application/json')) return sendAiV2Error(res, 'UNSUPPORTED_MEDIA_TYPE');
  const body: unknown = req.body;
  if (!isPlainObject(body) || typeof body.prompt !== 'string') return sendAiV2Error(res, 'INVALID_PROMPT');
  const prompt = body.prompt.trim();
  const length = codePointLength(prompt);
  if (length === 0) return sendAiV2Error(res, 'INVALID_PROMPT');
  if (length > PROMPT_MAX_LENGTH) return sendAiV2Error(res, 'PROMPT_TOO_LONG');

  // 2. 会話の存在確認と、同じ会話の最新5往復（古い順）の取得
  let history: Turn[];
  try {
    if (!(await conversationExists(conversationId))) return sendAiV2Error(res, 'CONVERSATION_NOT_FOUND');
    history = await listRecentTurns(conversationId, CONTEXT_TURN_LIMIT);
  } catch (error) {
    return sendDbError(res, 'load-context', error);
  }

  // 3. contentsの組み立て。送信内容の確認用に role の並びだけをログに出す（本文は出さない）
  const contents = buildContents(history, prompt);
  console.log('[ai-v2] contents', JSON.stringify({
    requestId: res.locals.requestId,
    conversationId,
    roles: contents.map((c) => c.role).join(','),
  }));

  // 4. Gemini呼び出し（失敗・空回答は保存しない）
  let answer: string;
  try {
    answer = await generateAnswerWithHistory(contents);
  } catch (error) {
    logAiV2Error(res, 'generate', error);
    return sendAiV2Error(res, error instanceof AiV2PublicError ? error.code : 'AI_UNAVAILABLE');
  }

  // 5. 1往復の保存が完了してから201（保存失敗では回答を返さない）
  try {
    const item = await saveTurn(conversationId, prompt, answer);
    res.status(201).json({ success: true, item });
  } catch (error) {
    logAiV2Error(res, 'save', error);
    sendAiV2Error(res, 'SAVE_FAILED');
  }
}
