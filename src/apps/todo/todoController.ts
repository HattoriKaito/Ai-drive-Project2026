import { Request, Response } from 'express';
import {
  listTodos,
  createTodo,
  updateTodoCompleted,
  deleteTodo,
} from './todoModel';

const TITLE_MAX_LENGTH = 100;
const INTEGER_MAX = 2147483647; // PostgreSQLのINTEGERの上限

// 統一エラーJSONを返す
export function sendError(
  res: Response,
  status: number,
  code: string,
  message: string,
  details: unknown[] = []
): void {
  res.status(status).json({ status: 'error', code, message, details });
}

// パスのIDを解析する（1以上の整数でなければnull）
function parseId(raw: unknown): number | null {
  if (typeof raw !== 'string' || !/^[1-9][0-9]*$/.test(raw)) return null;
  const id = Number(raw);
  return id <= INTEGER_MAX ? id : null;
}

// 本文がJSONオブジェクトかどうか
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

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

// 想定外のエラーを500または503に変換する（詳細はログのみ）
function handleUnexpected(res: Response, error: unknown, context: string): void {
  console.error(`${context}に失敗しました`, error);
  if (isDbUnavailable(error)) {
    sendError(res, 503, 'DB_UNAVAILABLE', 'データベースに接続できません');
    return;
  }
  if ((error as { code?: unknown })?.code === '23514') {
    // DBのCHECK制約違反（通常はController側で先に422になる）
    sendError(res, 422, 'VALIDATION_ERROR', '入力内容が制約を満たしていません');
    return;
  }
  sendError(res, 500, 'INTERNAL_ERROR', 'サーバー内部でエラーが発生しました');
}

// GET /api/v1/todos
export async function getTodos(_req: Request, res: Response): Promise<void> {
  try {
    const todos = await listTodos();
    res.status(200).json({ status: 'success', data: todos });
  } catch (error) {
    handleUnexpected(res, error, 'TODO一覧の取得');
  }
}

// POST /api/v1/todos
export async function postTodo(req: Request, res: Response): Promise<void> {
  const body: unknown = req.body;
  if (!isPlainObject(body)) {
    sendError(res, 400, 'BAD_REQUEST', 'JSONオブジェクトを送信してください');
    return;
  }
  if (!('title' in body)) {
    sendError(res, 400, 'BAD_REQUEST', 'titleは必須です', [
      { field: 'title', reason: 'required' },
    ]);
    return;
  }
  if (typeof body.title !== 'string') {
    sendError(res, 400, 'BAD_REQUEST', 'titleは文字列で指定してください', [
      { field: 'title', reason: 'type' },
    ]);
    return;
  }

  const title = body.title.trim();
  const titleLength = [...title].length; // 絵文字も1文字として数える（DBのchar_lengthと同じ）
  if (titleLength === 0) {
    sendError(res, 422, 'VALIDATION_ERROR', 'titleを入力してください', [
      { field: 'title', reason: 'blank' },
    ]);
    return;
  }
  if (titleLength > TITLE_MAX_LENGTH) {
    sendError(res, 422, 'VALIDATION_ERROR', `titleは${TITLE_MAX_LENGTH}文字以内で入力してください`, [
      { field: 'title', reason: 'too_long', max: TITLE_MAX_LENGTH },
    ]);
    return;
  }

  try {
    const todo = await createTodo(title);
    res.status(201).json({ status: 'success', data: todo });
  } catch (error) {
    handleUnexpected(res, error, 'TODOの登録');
  }
}

// PATCH /api/v1/todos/:id
export async function patchTodo(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  if (id === null) {
    sendError(res, 400, 'BAD_REQUEST', 'IDは1以上の整数で指定してください', [
      { field: 'id', reason: 'format' },
    ]);
    return;
  }
  const body: unknown = req.body;
  if (!isPlainObject(body) || typeof body.isCompleted !== 'boolean') {
    sendError(res, 400, 'BAD_REQUEST', 'isCompletedをtrueまたはfalseで指定してください', [
      { field: 'isCompleted', reason: 'type' },
    ]);
    return;
  }

  try {
    const todo = await updateTodoCompleted(id, body.isCompleted);
    if (!todo) {
      sendError(res, 404, 'NOT_FOUND', '指定されたTODOが見つかりません');
      return;
    }
    res.status(200).json({ status: 'success', data: todo });
  } catch (error) {
    handleUnexpected(res, error, 'TODOの更新');
  }
}

// DELETE /api/v1/todos/:id
export async function removeTodo(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  if (id === null) {
    sendError(res, 400, 'BAD_REQUEST', 'IDは1以上の整数で指定してください', [
      { field: 'id', reason: 'format' },
    ]);
    return;
  }

  try {
    const deleted = await deleteTodo(id);
    if (!deleted) {
      sendError(res, 404, 'NOT_FOUND', '指定されたTODOが見つかりません');
      return;
    }
    res.status(204).end(); // 本文なし
  } catch (error) {
    handleUnexpected(res, error, 'TODOの削除');
  }
}
