import { Request, Response } from 'express';
import { USERNAME_MAX_LENGTH, COMMENT_MAX_LENGTH } from './chatValidation';

// GET /chat：チャット画面（文字数の上限を画面へ渡す）
export function showChat(_req: Request, res: Response): void {
  res.render('chat/index', { usernameMax: USERNAME_MAX_LENGTH, commentMax: COMMENT_MAX_LENGTH });
}
