import { Router } from 'express';
import { showChat } from './chatController';

export const chatRouter = Router();

chatRouter.get(['/chat', '/chat/'], showChat); // チャット画面
