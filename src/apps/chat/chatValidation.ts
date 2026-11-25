// 投稿の入力検証（サーバー側の正。ブラウザでも同じ上限で事前に案内する）
export const USERNAME_MAX_LENGTH = 20;  // Unicodeコードポイント数
export const COMMENT_MAX_LENGTH = 500;  // Unicodeコードポイント数

export type ChatErrorCode =
  | 'NOT_JOINED'
  | 'INVALID_USERNAME'
  | 'USERNAME_TOO_LONG'
  | 'INVALID_COMMENT'
  | 'COMMENT_TOO_LONG'
  | 'SAVE_FAILED'
  | 'ROOM_FULL'
  | 'DB_UNAVAILABLE'
  | 'JOIN_FAILED';

export type PostValidation =
  | { ok: true; username: string; comment: string }
  | { ok: false; code: ChatErrorCode };

const codePointLength = (text: string): number => [...text].length;

// 型 → 前後の空白を除いた長さ の順に確認し、空白を除いた値を返す
export function validatePost(payload: unknown): PostValidation {
  const data = typeof payload === 'object' && payload !== null && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : {};

  if (typeof data.username !== 'string') return { ok: false, code: 'INVALID_USERNAME' };
  const username = data.username.trim();
  if (codePointLength(username) === 0) return { ok: false, code: 'INVALID_USERNAME' };
  if (codePointLength(username) > USERNAME_MAX_LENGTH) return { ok: false, code: 'USERNAME_TOO_LONG' };

  if (typeof data.comment !== 'string') return { ok: false, code: 'INVALID_COMMENT' };
  const comment = data.comment.trim();
  if (codePointLength(comment) === 0) return { ok: false, code: 'INVALID_COMMENT' };
  if (codePointLength(comment) > COMMENT_MAX_LENGTH) return { ok: false, code: 'COMMENT_TOO_LONG' };

  return { ok: true, username, comment };
}
