import { Request, Response } from 'express';
import { sendError } from '../todoController'; // V1と同じ統一エラーJSON
import {
  PRIORITIES,
  Priority,
  TodoV2Filter,
  TodoV2Changes,
  listTodosV2,
  createTodoV2,
  updateTodoV2,
  deleteTodoV2,
} from './todoV2Model';

const TITLE_MAX_LENGTH = 100;
const INTEGER_MAX = 2147483647;

type CheckResult<T> = { ok: true; value: T } | { ok: false; status: number; code: string; message: string; details: unknown[] };

const bad = (message: string, details: unknown[] = []): CheckResult<never> => ({
  ok: false, status: 400, code: 'BAD_REQUEST', message, details,
});
const invalid = (message: string, details: unknown[] = []): CheckResult<never> => ({
  ok: false, status: 422, code: 'VALIDATION_ERROR', message, details,
});

function sendCheckError(res: Response, r: Exclude<CheckResult<unknown>, { ok: true }>): void {
  sendError(res, r.status, r.code, r.message, r.details);
}

function parseId(raw: unknown): number | null {
  if (typeof raw !== 'string' || !/^[1-9][0-9]*$/.test(raw)) return null;
  const id = Number(raw);
  return id <= INTEGER_MAX ? id : null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPriority(value: string): value is Priority {
  return (PRIORITIES as readonly string[]).includes(value);
}

// priorityの検査：文字列以外は400、許可値以外は422
function checkPriority(value: unknown): CheckResult<Priority> {
  if (typeof value !== 'string') {
    return bad('priorityは文字列で指定してください', [{ field: 'priority', reason: 'type' }]);
  }
  if (!isPriority(value)) {
    return invalid('priorityはlow・normal・highのいずれかで指定してください', [
      { field: 'priority', reason: 'not_allowed', allowed: PRIORITIES },
    ]);
  }
  return { ok: true, value };
}

// 一覧のクエリを検査する
function checkFilter(query: Request['query']): CheckResult<TodoV2Filter> {
  const filter: TodoV2Filter = {};
  const { completed, priority } = query as Record<string, unknown>;

  if (completed !== undefined) {
    if (typeof completed !== 'string') {
      return bad('completedは1つだけ指定してください', [{ field: 'completed', reason: 'duplicate' }]);
    }
    if (completed !== 'true' && completed !== 'false') {
      return bad('completedはtrueまたはfalseで指定してください', [{ field: 'completed', reason: 'format' }]);
    }
    filter.completed = completed === 'true';
  }

  if (priority !== undefined) {
    if (typeof priority !== 'string') {
      return bad('priorityは1つだけ指定してください', [{ field: 'priority', reason: 'duplicate' }]);
    }
    const r = checkPriority(priority);
    if (!r.ok) return r;
    filter.priority = r.value;
  }
  return { ok: true, value: filter };
}

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

function handleUnexpected(res: Response, error: unknown, context: string): void {
  console.error(`${context}に失敗しました`, error);
  if (isDbUnavailable(error)) {
    sendError(res, 503, 'DB_UNAVAILABLE', 'データベースに接続できません');
    return;
  }
  if ((error as { code?: unknown })?.code === '23514') {
    sendError(res, 422, 'VALIDATION_ERROR', '入力内容が制約を満たしていません');
    return;
  }
  sendError(res, 500, 'INTERNAL_ERROR', 'サーバー内部でエラーが発生しました');
}

// GET /api/v2/todos
export async function getTodosV2(req: Request, res: Response): Promise<void> {
  const filter = checkFilter(req.query);
  if (!filter.ok) return sendCheckError(res, filter);
  try {
    const todos = await listTodosV2(filter.value);
    res.status(200).json({ status: 'success', data: todos });
  } catch (error) {
    handleUnexpected(res, error, 'V2のTODO一覧の取得');
  }
}

// POST /api/v2/todos
export async function postTodoV2(req: Request, res: Response): Promise<void> {
  const body: unknown = req.body;
  if (!isPlainObject(body)) {
    return sendError(res, 400, 'BAD_REQUEST', 'JSONオブジェクトを送信してください');
  }
  if (!('title' in body)) {
    return sendError(res, 400, 'BAD_REQUEST', 'titleは必須です', [{ field: 'title', reason: 'required' }]);
  }
  if (typeof body.title !== 'string') {
    return sendError(res, 400, 'BAD_REQUEST', 'titleは文字列で指定してください', [{ field: 'title', reason: 'type' }]);
  }

  // priorityは省略可（省略時normal）。型違いは400を先に返す
  let priority: Priority = 'normal';
  if (body.priority !== undefined) {
    if (typeof body.priority !== 'string') {
      return sendError(res, 400, 'BAD_REQUEST', 'priorityは文字列で指定してください', [{ field: 'priority', reason: 'type' }]);
    }
  }

  const title = body.title.trim();
  const titleLength = [...title].length;
  if (titleLength === 0) {
    return sendError(res, 422, 'VALIDATION_ERROR', 'titleを入力してください', [{ field: 'title', reason: 'blank' }]);
  }
  if (titleLength > TITLE_MAX_LENGTH) {
    return sendError(res, 422, 'VALIDATION_ERROR', `titleは${TITLE_MAX_LENGTH}文字以内で入力してください`, [
      { field: 'title', reason: 'too_long', max: TITLE_MAX_LENGTH },
    ]);
  }
  if (body.priority !== undefined) {
    const r = checkPriority(body.priority);
    if (!r.ok) return sendCheckError(res, r);
    priority = r.value;
  }

  try {
    const todo = await createTodoV2(title, priority);
    res.status(201).json({ status: 'success', data: todo });
  } catch (error) {
    handleUnexpected(res, error, 'V2のTODOの登録');
  }
}

// PATCH /api/v2/todos/:id
export async function patchTodoV2(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  if (id === null) {
    return sendError(res, 400, 'BAD_REQUEST', 'IDは1以上の整数で指定してください', [{ field: 'id', reason: 'format' }]);
  }
  const body: unknown = req.body;
  if (!isPlainObject(body)) {
    return sendError(res, 400, 'BAD_REQUEST', 'JSONオブジェクトを送信してください');
  }
  if (body.isCompleted === undefined && body.priority === undefined) {
    return sendError(res, 400, 'BAD_REQUEST', 'isCompletedまたはpriorityの少なくとも一方を指定してください', [
      { field: 'isCompleted|priority', reason: 'required' },
    ]);
  }

  const changes: TodoV2Changes = {};
  if (body.isCompleted !== undefined) {
    if (typeof body.isCompleted !== 'boolean') {
      return sendError(res, 400, 'BAD_REQUEST', 'isCompletedはtrueまたはfalseで指定してください', [
        { field: 'isCompleted', reason: 'type' },
      ]);
    }
    changes.isCompleted = body.isCompleted;
  }
  if (body.priority !== undefined) {
    const r = checkPriority(body.priority);
    if (!r.ok) return sendCheckError(res, r);
    changes.priority = r.value;
  }

  try {
    const todo = await updateTodoV2(id, changes);
    if (!todo) return sendError(res, 404, 'NOT_FOUND', '指定されたTODOが見つかりません');
    res.status(200).json({ status: 'success', data: todo });
  } catch (error) {
    handleUnexpected(res, error, 'V2のTODOの更新');
  }
}

// DELETE /api/v2/todos/:id
export async function removeTodoV2(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  if (id === null) {
    return sendError(res, 400, 'BAD_REQUEST', 'IDは1以上の整数で指定してください', [{ field: 'id', reason: 'format' }]);
  }
  try {
    const deleted = await deleteTodoV2(id);
    if (!deleted) return sendError(res, 404, 'NOT_FOUND', '指定されたTODOが見つかりません');
    res.status(204).end();
  } catch (error) {
    handleUnexpected(res, error, 'V2のTODOの削除');
  }
}
