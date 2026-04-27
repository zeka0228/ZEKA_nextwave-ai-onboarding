import type {
  ClassificationInput,
  LlmClassificationResult,
} from '../../domain/types';
import { mockClassifier } from './mockClassifier';

export interface ClassifierAdapter {
  classify(input: ClassificationInput): Promise<LlmClassificationResult>;
}

export async function classifyContent(
  input: ClassificationInput,
  adapter: ClassifierAdapter = mockClassifier,
): Promise<LlmClassificationResult | null> {
  try {
    return await adapter.classify(input);
  } catch (error) {
    console.warn('[classifyContent] adapter failed; using fallback.', error);
    return null;
  }
}
