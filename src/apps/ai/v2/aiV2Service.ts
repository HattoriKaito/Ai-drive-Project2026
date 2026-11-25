import { GoogleGenAI } from '@google/genai';
import { AiV2PublicError } from './aiV2Error';
import { Turn } from './aiV2Model';

// V1と同じ参考設定
const AI_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_TOKENS = 1024;

type Content = { role: 'user' | 'model'; parts: { text: string }[] };

// 同じ会話の過去の往復（古い順）を user → model に展開し、今回の質問を最後の user として加える
export function buildContents(history: Turn[], prompt: string): Content[] {
  const contents: Content[] = [];
  for (const turn of history) {
    contents.push({ role: 'user', parts: [{ text: turn.prompt }] });
    contents.push({ role: 'model', parts: [{ text: turn.response }] });
  }
  contents.push({ role: 'user', parts: [{ text: prompt }] });
  return contents;
}

// Geminiで回答を作る（サーバー側だけ。キーはブラウザへ渡さない）
export async function generateAnswerWithHistory(contents: Content[]): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL;
  if (!apiKey || !model) {
    throw new AiV2PublicError('AI_NOT_CONFIGURED');
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: { timeout: AI_TIMEOUT_MS, retryOptions: { attempts: 1 } }, // 再試行しない
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        abortSignal: controller.signal,
        httpOptions: { timeout: AI_TIMEOUT_MS, retryOptions: { attempts: 1 } },
      },
    });
    const text = response.text;
    if (typeof text !== 'string' || text.trim().length === 0) {
      const finishReason = response.candidates?.[0]?.finishReason;
      throw new AiV2PublicError('AI_UNAVAILABLE', {
        cause: { name: 'EmptyResponse', code: typeof finishReason === 'string' ? finishReason : 'UNKNOWN' },
      });
    }
    return text;
  } catch (error) {
    if (error instanceof AiV2PublicError) throw error;
    const name = (error as { name?: unknown })?.name;
    if (controller.signal.aborted || name === 'AbortError' || name === 'TimeoutError') {
      throw new AiV2PublicError('AI_TIMEOUT', { cause: error });
    }
    throw new AiV2PublicError('AI_UNAVAILABLE', { cause: error });
  } finally {
    clearTimeout(timer);
  }
}
