import { Response } from 'express';

// V2の公開用エラー（応答形式はV1と同じ。V1のaiError.tsは変更しない）
const AI_V2_ERRORS = {
  INVALID_JSON: { status: 400, message: '送信データの形式が正しくありません。' },
  INVALID_ID: { status: 400, message: '会話IDが正しくありません。' },
  INVALID_TITLE: { status: 400, message: '会話名を入力してください。' },
  TITLE_TOO_LONG: { status: 400, message: '会話名は50文字以内で入力してください。' },
  INVALID_PROMPT: { status: 400, message: '質問を入力してください。' },
  PROMPT_TOO_LONG: { status: 400, message: '質問は2000文字以内で入力してください。' },
  PAYLOAD_TOO_LARGE: { status: 413, message: '送信データが大きすぎます。' },
  UNSUPPORTED_MEDIA_TYPE: { status: 415, message: 'JSON形式で送信してください。' },
  CONVERSATION_NOT_FOUND: { status: 404, message: '指定された会話が見つかりません。' },
  NOT_FOUND: { status: 404, message: '指定されたAPIは存在しません。' },
  AI_UNAVAILABLE: { status: 502, message: 'AIから回答を取得できませんでした。時間をおいて再度お試しください。' },
  AI_NOT_CONFIGURED: { status: 503, message: 'AI機能の設定が完了していません。' },
  AI_TIMEOUT: { status: 504, message: 'AIの応答が時間内に返りませんでした。時間をおいて再度お試しください。' },
  SAVE_FAILED: { status: 500, message: '回答を保存できませんでした。もう一度送信してください。' },
  DB_UNAVAILABLE: { status: 503, message: 'データベースに接続できません。' },
  INTERNAL_ERROR: { status: 500, message: 'サーバー内部でエラーが発生しました。' },
} as const;

export type AiV2ErrorCode = keyof typeof AI_V2_ERRORS;

export class AiV2PublicError extends Error {
  readonly code: AiV2ErrorCode;
  constructor(code: AiV2ErrorCode, options?: { cause?: unknown }) {
    super(code, options);
    this.name = 'AiV2PublicError';
    this.code = code;
  }
}

export function sendAiV2Error(res: Response, code: AiV2ErrorCode): void {
  const { status, message } = AI_V2_ERRORS[code];
  const requestId = typeof res.locals.requestId === 'string' ? res.locals.requestId : undefined;
  res.status(status).json({ success: false, error: { code, message, requestId } });
}

// ログは requestId・段階・エラー種別だけ（本文・キー・接続文字列は出さない）
export function logAiV2Error(res: Response, stage: string, error: unknown): void {
  const err = error as { name?: unknown; code?: unknown; status?: unknown; cause?: unknown };
  const cause = err?.cause as { name?: unknown; code?: unknown; status?: unknown } | undefined;
  console.error('[ai-v2]', JSON.stringify({
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

// DBに接続できないエラーかどうか
export function isDbUnavailable(error: unknown): boolean {
  const err = error as { code?: unknown; message?: unknown };
  const code = typeof err?.code === 'string' ? err.code : '';
  const message = typeof err?.message === 'string' ? err.message : '';
  return (
    code.startsWith('08') ||
    ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET', '57P01', '57P03'].includes(code) ||
    /timeout|Connection terminated/i.test(message)
  );
}
