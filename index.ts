import express, { Request, Response } from 'express';
import path from 'path';
import { pool } from './db'; // DB設定を読み込み
import { todoRouter } from './src/apps/todo/todoRouter'; // TODO API
import { todoV2Router } from './src/apps/todo/v2/todoV2Router'; // TODO API V2
import { aiRouter } from './src/apps/ai/aiRouter'; // AI質問API

const app = express(); // Expressアプリケーションを作成
const port: number = 3000; // ローカルで使用するポート番号

// ------------------------------
// Expressの基本設定
// ------------------------------
app.use(express.urlencoded({ extended: true })); // フォームから送信されたデータを受け取れるようにする
app.use(express.static(path.join(process.cwd(), 'public'), { redirect: false })); // CSSや画像などの静的ファイルを公開する（/todo と public/todo/ が重なるため、フォルダーへのリダイレクトを無効化）
app.set('view engine', 'ejs'); // テンプレートエンジンにEJSを設定
app.set('views', path.join(process.cwd(), 'views')); // EJSファイルを保存するフォルダーを指定

// ------------------------------
// ルーティング
// ------------------------------
// 「/」にアクセスされたときの処理
app.get('/', (req: Request, res: Response): void => {
  res.send('Hello World!');
});

// DB接続確認
app.get('/api/db-check', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT 1 AS connection_test');
    res.json({
      status: 'ok',
      database: result.rows[0].connection_test === 1 ? 'connected' : 'error',
    });
  } catch (error) {
    console.error('DB接続確認に失敗しました', error);
    res.status(503).json({ status: 'error', database: 'unavailable' });
  }
});

// TODO画面（/todo）
app.get('/todo', (_req: Request, res: Response): void => {
  res.render('todo/index');
});

// TODO API（/api/v1/todos）
app.use('/api/v1/todos', todoRouter);

// TODO V2画面（/todo-v2）
app.get('/todo-v2', (_req: Request, res: Response): void => {
  res.render('todo-v2/index');
});

// TODO API V2（/api/v2/todos）
app.use('/api/v2/todos', todoV2Router);

// AI質問API（/api/ai）
app.use('/api/ai', aiRouter);

// ------------------------------
// サーバー起動
// ------------------------------
app.listen(port, (): void => {
  console.log(`Server started: http://localhost:${port}`);
});
