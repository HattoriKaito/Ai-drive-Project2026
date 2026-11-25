import express, { Router, Request, Response, NextFunction } from 'express';
import { assignRequestId, requireDemoEnabled } from '../aiMiddleware'; // V1の共通処理を共有（変更なし）
import { AiV2PublicError, sendAiV2Error, logAiV2Error } from './aiV2Error';
import { getConversations, postConversation, getTurns, postTurn } from './aiV2Controller';

export const aiV2Router = Router();

// 問い合わせID → デモ停止（V2の全APIに適用）→ AI専用JSON解析（16KiB）
aiV2Router.use(assignRequestId);
aiV2Router.use(requireDemoEnabled);
aiV2Router.use(express.json({ limit: 16384, type: 'application/json' }));

aiV2Router.get('/conversations', getConversations);          // 会話一覧
aiV2Router.post('/conversations', postConversation);         // 会話の作成
aiV2Router.get('/conversations/:id/turns', getTurns);        // 会話の履歴（最新20往復）
aiV2Router.post('/conversations/:id/turns', postTurn);       // 文脈付きの質問（最新5往復＋今回）

// /api/ai/v2 配下の未定義URL・メソッド
aiV2Router.use((_req: Request, res: Response) => {
  sendAiV2Error(res, 'NOT_FOUND');
});

// エラー処理（生の例外は返さない）
aiV2Router.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const type = (err as { type?: unknown })?.type;
  if (type === 'entity.parse.failed') return sendAiV2Error(res, 'INVALID_JSON');
  if (type === 'entity.too.large') return sendAiV2Error(res, 'PAYLOAD_TOO_LARGE');
  if (err instanceof AiV2PublicError) return sendAiV2Error(res, err.code);
  logAiV2Error(res, 'router', err);
  sendAiV2Error(res, 'INTERNAL_ERROR');
});
