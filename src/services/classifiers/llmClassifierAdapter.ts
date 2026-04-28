import { buildClassificationPrompt } from '../../domain/classification/classificationPrompt';
import type {
  ClassificationInput,
  LlmClassificationResult,
  LlmUserType,
} from '../../domain/types';
import type { ClassifierAdapter } from './classifyContent';

const env = import.meta.env as Record<string, string | undefined>;
const BASE_URL = env.VITE_LLM_BASE_URL ?? '/api/llm/v1';
const MODEL = env.VITE_LLM_MODEL ?? 'qwen2.5:3b';
const API_KEY = env.VITE_LLM_API_KEY ?? 'ollama';

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

interface OpenAIChatCompletion {
  choices?: Array<{ message?: { content?: string } }>;
}

export const llmClassifierAdapter: ClassifierAdapter = {
  async classify(input: ClassificationInput): Promise<LlmClassificationResult> {
    const prompt = buildClassificationPrompt(input);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

    try {
      const response = await fetch(`${BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            {
              role: 'system',
              content:
                'You are a strict JSON classifier. Respond with a single JSON object only — no prose, no markdown fences.',
            },
            { role: 'user', content: prompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`LLM API ${response.status}: ${body.slice(0, 200)}`);
      }

      const completion = (await response.json()) as OpenAIChatCompletion;
      const content = completion.choices?.[0]?.message?.content;
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

function parseLlmResponse(raw: unknown): LlmClassificationResult {
  if (!raw || typeof raw !== 'object') {
    throw new Error('LLM response is not an object');
  }
  const obj = raw as Record<string, unknown>;

  const userType = obj.user_type;
  const confidence = obj.confidence;
  const keywords = obj.keywords;
  const reasoning = obj.reasoning;

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
  if (
    !Array.isArray(keywords) ||
    !keywords.every((k) => typeof k === 'string')
  ) {
    throw new Error('invalid keywords');
  }

  return {
    user_type: userType as LlmUserType,
    confidence,
    keywords,
    reasoning: typeof reasoning === 'string' ? reasoning : undefined,
  };
}
