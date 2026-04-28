import type {
  ClassificationInput,
  LlmClassificationResult,
} from '../../domain/types';
import { llmClassifierAdapter } from './llmClassifierAdapter';
import { mockClassifier } from './mockClassifier';

export interface ClassifierAdapter {
  classify(input: ClassificationInput): Promise<LlmClassificationResult>;
}

const env = import.meta.env as Record<string, string | undefined>;
const useMock = env.VITE_USE_MOCK_CLASSIFIER === 'true';

const defaultAdapter: ClassifierAdapter = useMock
  ? mockClassifier
  : llmClassifierAdapter;

export async function classifyContent(
  input: ClassificationInput,
  adapter: ClassifierAdapter = defaultAdapter,
): Promise<LlmClassificationResult | null> {
  try {
    return await adapter.classify(input);
  } catch (error) {
    console.warn('[classifyContent] adapter failed; using fallback.', error);
    return null;
  }
}
