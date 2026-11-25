import { AiPublicError } from './aiError';

// ------------------------------------------------------------
// 【TASK-03 模擬回答】実AIへの通信は行わない。
// TASK-04 でこのファイルの generateAnswer を Gemini API の呼出しに置き換える。
// ------------------------------------------------------------
export const MOCK_ANSWER = '接続確認用の模擬回答です。';

export async function generateAnswer(_prompt: string): Promise<string> {
  // 模擬回答はローカル検証中だけ。Vercel上では成功扱いにしない
  if (process.env.VERCEL) {
    throw new AiPublicError('AI_NOT_CONFIGURED');
  }
  return MOCK_ANSWER;
}
