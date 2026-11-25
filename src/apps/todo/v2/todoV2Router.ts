import express, { Router, Request, Response, NextFunction } from 'express';
import { sendError } from '../todoController';
import { getTodosV2, postTodoV2, patchTodoV2, removeTodoV2 } from './todoV2Controller';

export const todoV2Router = Router();

todoV2Router.use(express.json());

todoV2Router.get('/', getTodosV2);         // REQ-V2-01 一覧・絞り込み
todoV2Router.post('/', postTodoV2);        // REQ-V2-02 登録
todoV2Router.patch('/:id', patchTodoV2);   // REQ-V2-03 部分更新
todoV2Router.delete('/:id', removeTodoV2); // REQ-V2-04 削除

todoV2Router.use((_req: Request, res: Response) => {
  sendError(res, 404, 'NOT_FOUND', '指定されたAPIは存在しません');
});

todoV2Router.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if ((err as { type?: unknown })?.type === 'entity.parse.failed') {
    sendError(res, 400, 'BAD_REQUEST', 'JSONの形式が正しくありません');
    return;
  }
  console.error('V2 TODO APIで想定外のエラーが発生しました', err);
  sendError(res, 500, 'INTERNAL_ERROR', 'サーバー内部でエラーが発生しました');
});
