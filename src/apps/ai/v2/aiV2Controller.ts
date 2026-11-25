import { Request, Response } from 'express';
import {
  DISPLAY_TURN_LIMIT,
  listConversations,
  createConversation,
  conversationExists,
  listRecentTurns,
} from './aiV2Model';
import { sendAiV2Error, logAiV2Error, isDbUnavailable } from './aiV2Error';

const TITLE_MAX_LENGTH = 50;   // コードポイント数
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
