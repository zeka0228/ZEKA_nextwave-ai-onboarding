import { buildClassificationPrompt } from '../../domain/classification/classificationPrompt';
import type {
  ClassificationInput,
  LlmClassificationResult,
} from '../../domain/types';
import type { ClassifierAdapter } from './classifyContent';

export const LLM_TIMEOUT_MS = 5000;

export const llmClassifierAdapter: ClassifierAdapter = {
  async classify(input: ClassificationInput): Promise<LlmClassificationResult> {
    const prompt = buildClassificationPrompt(input);
    void prompt;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

    try {
      throw new Error(
        'llmClassifierAdapter is not wired to a real backend yet. ' +
          'Implement the call (예: /api/classify, Gemma, Ollama) and parse JSON to LlmClassificationResult.',
      );
    } finally {
      clearTimeout(timer);
    }
  },
};
