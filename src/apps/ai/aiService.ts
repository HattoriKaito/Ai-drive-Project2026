import { GoogleGenAI } from '@google/genai';
import { AiPublicError } from './aiError';

// 参考設定（授業テキスト・設計書 DES-AI-008）
const AI_TIMEOUT_MS = 30_000;   // 外部AIの待機 30秒
const MAX_OUTPUT_TOKENS = 1024; // 出力予算

// Gemini API で回答を作る（サーバー側だけで実行。キーはブラウザへ渡さない）
// 今回の質問だけを送り、過去の履歴は送らない
export async function generateAnswer(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL;
  if (!apiKey || !model) {
    throw new AiPublicError('AI_NOT_CONFIGURED');
  }

  // SDKの再試行は既定で5回のため、attempts: 1（初回のみ）を明示する
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: { timeout: AI_TIMEOUT_MS, retryOptions: { attempts: 1 } },
  });

  // SDKのtimeoutに加えて、AbortControllerでも30秒で打ち切る
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        abortSignal: controller.signal,
        httpOptions: { timeout: AI_TIMEOUT_MS, retryOptions: { attempts: 1 } },
      },
    });

    const text = response.text;
    // 空回答（安全フィルター・出力上限などで本文なしを含む）は失敗とし、保存しない
    if (typeof text !== 'string' || text.trim().length === 0) {
      // ログ用に終了理由（STOP・MAX_TOKENS・SAFETY など）だけを残す。本文は残さない
      const finishReason = response.candidates?.[0]?.finishReason;
      throw new AiPublicError('AI_UNAVAILABLE', {
        cause: { name: 'EmptyResponse', code: typeof finishReason === 'string' ? finishReason : 'UNKNOWN' },
      });
    }
    return text;
  } catch (error) {
    if (error instanceof AiPublicError) throw error;
    const name = (error as { name?: unknown })?.name;
    if (controller.signal.aborted || name === 'AbortError' || name === 'TimeoutError') {
      throw new AiPublicError('AI_TIMEOUT', { cause: error });
    }
    // 通信エラー・利用枠超過・キー不正などは固定コードへ変換（生の例外は返さない）
    throw new AiPublicError('AI_UNAVAILABLE', { cause: error });
  } finally {
    clearTimeout(timer);
  }
}
