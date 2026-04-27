import type { Classification, ClassificationInput } from '../domain/types';
import type { ClassificationOutcome } from '../services/classifiers/classificationFlow';
import { requestPick } from './pickerBridge';

export type { ClassificationOutcome };

export async function runClassificationFlow(
  input: ClassificationInput,
  history: Classification[],
): Promise<ClassificationOutcome> {
  void history;
  return requestPick(input);
}
