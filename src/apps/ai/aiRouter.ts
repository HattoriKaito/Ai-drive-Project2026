import express, { Router, Request, Response, NextFunction } from 'express';
import { assignRequestId, requireDemoEnabled } from './aiMiddleware';
import { AiPublicError, sendAiError, logAiError } from './aiError';
import { getHistory } from './aiController';

export const aiRouter = Router();

// 1. 問い合わせID → 2. デモ停止（AI呼出し・履歴取得・JSON解析より前）→ 3. AI専用JSON解析（16KiB）
aiRouter.use(assignRequestId);
aiRouter.use(requireDemoEnabled);
aiRouter.use(express.json({ limit: 16384, type: 'application/json' }));

// 4. ルート
aiRouter.get('/history', getHistory); // 履歴（最新20件）
aiRouter.post('/ask', (_req: Request, res: Response) => {
  res.status(501).json({ success: false, error: { code: 'NOT_IMPLEMENTED', message: '未実装です（TASK-03で実装）', requestId: res.locals.requestId } });
});

// 5. /api/ai 配下の未定義URL・メソッド
aiRouter.use((_req: Request, res: Response) => {
  sendAiError(res, 'NOT_FOUND');
});

// 6. AI用のエラー処理（生の例外は返さない）
aiRouter.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const type = (err as { type?: unknown })?.type;
  if (type === 'entity.parse.failed') return sendAiError(res, 'INVALID_JSON');
  if (type === 'entity.too.large') return sendAiError(res, 'PAYLOAD_TOO_LARGE');
  if (err instanceof AiPublicError) return sendAiError(res, err.code);
  logAiError(res, 'router', err);
  sendAiError(res, 'INTERNAL_ERROR');
});
