import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { sendAiError } from './aiError';

// 問い合わせIDを付与する（応答とログで同じIDを使う）
export function assignRequestId(_req: Request, res: Response, next: NextFunction): void {
  const requestId = randomUUID();
  res.locals.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}

// デモ停止：AI_DEMO_ENABLEDが"true"のときだけAI APIを動かす（未設定・falseは停止）
export function requireDemoEnabled(_req: Request, res: Response, next: NextFunction): void {
  if (process.env.AI_DEMO_ENABLED !== 'true') {
    sendAiError(res, 'DEMO_DISABLED');
    return;
  }
  next();
}
