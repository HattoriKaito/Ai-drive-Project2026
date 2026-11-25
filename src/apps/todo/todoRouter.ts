import express, { Router, Request, Response, NextFunction } from 'express';
import { getTodos, postTodo, patchTodo, removeTodo, sendError } from './todoController';

export const todoRouter = Router();

// TODO APIの中だけでJSONを解析する（既存ルートに影響させない）
todoRouter.use(express.json());

todoRouter.get('/', getTodos);         // REQ-01 一覧
todoRouter.post('/', postTodo);        // REQ-02 登録
todoRouter.patch('/:id', patchTodo);   // REQ-03 完了状態の部分更新
todoRouter.delete('/:id', removeTodo); // REQ-04 削除

// 定義していないURL・メソッド
todoRouter.use((_req: Request, res: Response) => {
  sendError(res, 404, 'NOT_FOUND', '指定されたAPIは存在しません');
});

// 不正なJSONなどのエラーをHTMLではなく統一エラーJSONで返す
todoRouter.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const type = (err as { type?: unknown })?.type;
  if (type === 'entity.parse.failed') {
    sendError(res, 400, 'BAD_REQUEST', 'JSONの形式が正しくありません');
    return;
  }
  console.error('TODO APIで想定外のエラーが発生しました', err);
  sendError(res, 500, 'INTERNAL_ERROR', 'サーバー内部でエラーが発生しました');
});
