import { resolveUserType } from '../../domain/classification/resolveUserType';
import type {
  Classification,
  ClassificationInput,
  LlmUserType,
  UserType,
} from '../../domain/types';
import { classifyContent } from './classifyContent';

export interface ClassificationOutcome {
  userType: UserType;
  source: Classification['source'];
  confidence: number;
  keywords: string[];
  reasoning?: string;
  rawUserType: LlmUserType;
  fallbackReason?: string;
}

export async function runClassificationFlow(
  input: ClassificationInput,
  history: Classification[],
): Promise<ClassificationOutcome> {
  const llmResult = await classifyContent(input);
  const resolved = resolveUserType({
    llmResult,
    classifications: history,
    classifierSource: 'llm_adapter',
  });

  return {
    userType: resolved.userType,
    source: resolved.source,
    confidence: llmResult?.confidence ?? 0,
    keywords: llmResult?.keywords ?? [],
    reasoning: llmResult?.reasoning,
    rawUserType: llmResult?.user_type ?? 'unknown',
    fallbackReason: resolved.fallbackReason,
  };
}
