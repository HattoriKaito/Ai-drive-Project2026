import { Response } from 'express';

// 公開用のエラーコード（応答に出すのはこの固定のコードと文言だけ）
const AI_ERRORS = {
  DEMO_DISABLED: { status: 503, message: '現在AI機能は停止中です。' },
  INVALID_JSON: { status: 400, message: '送信データの形式が正しくありません。' },
  INVALID_PROMPT: { status: 400, message: '質問を入力してください。' },
  PROMPT_TOO_LONG: { status: 400, message: '質問は2000文字以内で入力してください。' },
  PAYLOAD_TOO_LARGE: { status: 413, message: '送信データが大きすぎます。' },
  UNSUPPORTED_MEDIA_TYPE: { status: 415, message: 'JSON形式で送信してください。' },
  AI_UNAVAILABLE: { status: 502, message: 'AIから回答を取得できませんでした。時間をおいて再度お試しください。' },
  AI_NOT_CONFIGURED: { status: 503, message: 'AI機能の設定が完了していません。' },
  AI_TIMEOUT: { status: 504, message: 'AIの応答が時間内に返りませんでした。時間をおいて再度お試しください。' },
  SAVE_FAILED: { status: 500, message: '回答を保存できませんでした。もう一度送信してください。' },
  DB_UNAVAILABLE: { status: 503, message: 'データベースに接続できません。' },
  HISTORY_FAILED: { status: 500, message: '履歴を取得できませんでした。' },
  NOT_FOUND: { status: 404, message: '指定されたAPIは存在しません。' },
  INTERNAL_ERROR: { status: 500, message: 'サーバー内部でエラーが発生しました。' },
} as const;

export type AiErrorCode = keyof typeof AI_ERRORS;

// 処理の途中で投げる公開用エラー（元の例外はログ用にcauseへ保持し、応答には出さない）
export class AiPublicError extends Error {
  readonly code: AiErrorCode;
  constructor(code: AiErrorCode, options?: { cause?: unknown }) {
    super(code, options);
    this.name = 'AiPublicError';
    this.code = code;
  }
}

// 統一形式のエラー応答を返す
export function sendAiError(res: Response, code: AiErrorCode): void {
  const { status, message } = AI_ERRORS[code];
  const requestId = typeof res.locals.requestId === 'string' ? res.locals.requestId : undefined;
  res.status(status).json({ success: false, error: { code, message, requestId } });
}

// ログに残す情報を限定する（質問本文・回答・キー・接続文字列は出さない）
export function logAiError(res: Response, stage: string, error: unknown): void {
  const err = error as { name?: unknown; code?: unknown; status?: unknown; cause?: unknown };
  const cause = err?.cause as { name?: unknown; code?: unknown; status?: unknown } | undefined;
  console.error('[ai]', JSON.stringify({
    requestId: res.locals.requestId,
    stage,
    name: typeof err?.name === 'string' ? err.name : undefined,
    code: typeof err?.code === 'string' ? err.code : undefined,
    status: typeof err?.status === 'number' ? err.status : undefined,
    causeName: typeof cause?.name === 'string' ? cause.name : undefined,
    causeCode: typeof cause?.code === 'string' ? cause.code : undefined,
    causeStatus: typeof cause?.status === 'number' ? cause.status : undefined,
  }));
}
