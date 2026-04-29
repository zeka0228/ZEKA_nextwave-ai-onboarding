import { buildClassificationPrompt } from '../../domain/classification/classificationPrompt';
import type {
  ClassificationInput,
  LlmClassificationResult,
  LlmUserType,
} from '../../domain/types';
import type { ClassifierAdapter } from './classifyContent';

const env = import.meta.env as Record<string, string | undefined>;
// Ollama host root. native /api/chat 으로 호출하기 위해 v1 prefix 제거.
// thinking 모델 (gemma3 시리즈 등) 의 reasoning trace 차단에는 native API 의 think:false 가 필요.
const BASE_URL = env.VITE_LLM_BASE_URL ?? '/api/llm';
const MODEL = env.VITE_LLM_MODEL ?? 'qwen2.5:3b';
const API_KEY = env.VITE_LLM_API_KEY ?? 'ollama';
// idle 상태에서도 모델을 GPU 메모리에 유지. cold start (~5~7s) 회피.
// 운영 환경 (Groq 등) 으로 swap 시 무시됨 (Ollama 한정 옵션).
const KEEP_ALIVE = env.VITE_LLM_KEEP_ALIVE ?? '30m';

// plan §4.7 명세는 5초이지만 로컬 LLM cold start 흡수 위해 env 로 override 가능.
const parsedTimeout = Number(env.VITE_LLM_TIMEOUT_MS);
export const LLM_TIMEOUT_MS =
  Number.isFinite(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : 5000;

const ALLOWED_USER_TYPES: LlmUserType[] = [
  '대학생',
  '직장인',
  '프리랜서',
  '팀 사용자',
  'unknown',
];

interface OllamaChatResponse {
  message?: { content?: string };
}

export const llmClassifierAdapter: ClassifierAdapter = {
  async classify(input: ClassificationInput): Promise<LlmClassificationResult> {
    const prompt = buildClassificationPrompt(input);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

    try {
      const response = await fetch(`${BASE_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          stream: false,
          think: false,
          format: 'json',
          keep_alive: KEEP_ALIVE,
          options: { temperature: 0 },
          messages: [
            {
              role: 'system',
              content:
                'You are a strict JSON classifier. Respond with a single JSON object only — no prose, no markdown fences.',
            },
            { role: 'user', content: prompt },
          ],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`LLM API ${response.status}: ${body.slice(0, 200)}`);
      }

      const completion = (await response.json()) as OllamaChatResponse;
      const content = completion.message?.content;
      if (typeof content !== 'string' || content.length === 0) {
        throw new Error('LLM response missing content');
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`LLM JSON parse failed: ${message}`);
      }

      return parseLlmResponse(parsed);
    } finally {
      clearTimeout(timer);
    }
  },
};

/**
 * 모델을 GPU 메모리에 미리 적재해 첫 사용자 액션의 cold start 를 회피.
 * 앱 첫 마운트 시 1회 호출. mock classifier 사용 중이거나 Ollama 미가동 시 silent fail.
 */
export async function warmupClassifier(): Promise<void> {
  try {
    await llmClassifierAdapter.classify({
      type: 'memo',
      title: 'warmup',
      content: 'init',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[warmupClassifier] failed (will retry on first user action):', msg);
  }
}

function parseLlmResponse(raw: unknown): LlmClassificationResult {
  if (!raw || typeof raw !== 'object') {
    throw new Error('LLM response is not an object');
  }
  const obj = raw as Record<string, unknown>;

  const userType = obj.user_type;
  const confidence = obj.confidence;

  if (
    typeof userType !== 'string' ||
    !ALLOWED_USER_TYPES.includes(userType as LlmUserType)
  ) {
    throw new Error(`invalid user_type: ${String(userType)}`);
  }
  if (
    typeof confidence !== 'number' ||
    Number.isNaN(confidence) ||
    confidence < 0 ||
    confidence > 1
  ) {
    throw new Error(`invalid confidence: ${String(confidence)}`);
  }

  return {
    user_type: userType as LlmUserType,
    confidence,
    keywords: [],
  };
}
