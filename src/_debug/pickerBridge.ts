import type { ClassificationInput } from '../domain/types';
import type { ClassificationOutcome } from '../services/classifiers/classificationFlow';

type PickerImpl = (input: ClassificationInput) => Promise<ClassificationOutcome>;

let pickerImpl: PickerImpl | null = null;

export function registerPicker(impl: PickerImpl): void {
  pickerImpl = impl;
}

export function unregisterPicker(): void {
  pickerImpl = null;
}

export async function requestPick(
  input: ClassificationInput,
): Promise<ClassificationOutcome> {
  if (!pickerImpl) {
    throw new Error(
      '[manual picker] ManualPickerHost is not mounted. ' +
        'Mount <ManualPickerHost /> in the app tree to use manual classification.',
    );
  }
  return pickerImpl(input);
}
