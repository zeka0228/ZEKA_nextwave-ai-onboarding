import type {
  Classification,
  LlmClassificationResult,
  UserType,
} from '../types';

export const CLASSIFICATION_THRESHOLD = 0.75;

const ALLOWED_LLM_USER_TYPES: ReadonlyArray<UserType> = [
  '대학생',
  '직장인',
  '프리랜서',
  '팀 사용자',
];

function isAllowedLlmUserType(value: string): value is UserType {
  return (ALLOWED_LLM_USER_TYPES as ReadonlyArray<string>).includes(value);
}

function modeWithLatestTieBreak(classifications: Classification[]): UserType {
  const counts = new Map<UserType, { count: number; latest: number }>();

  for (const item of classifications) {
    const current = counts.get(item.userType);
    if (current) {
      current.count += 1;
      current.latest = Math.max(current.latest, item.createdAt);
    } else {
      counts.set(item.userType, { count: 1, latest: item.createdAt });
    }
  }

  let bestType: UserType = '개인 사용자';
  let bestCount = -1;
  let bestLatest = -1;

  counts.forEach((value, type) => {
    if (
      value.count > bestCount ||
      (value.count === bestCount && value.latest > bestLatest)
    ) {
      bestType = type;
      bestCount = value.count;
      bestLatest = value.latest;
    }
  });

  return bestType;
}

export function resolveUserType(params: {
  llmResult: LlmClassificationResult | null;
  classifications: Classification[];
  classifierSource: 'mock_classifier' | 'llm_adapter';
}): Pick<Classification, 'userType' | 'source'> {
  const { llmResult, classifications, classifierSource } = params;

  if (
    llmResult &&
    llmResult.user_type !== 'unknown' &&
    llmResult.confidence >= CLASSIFICATION_THRESHOLD &&
    isAllowedLlmUserType(llmResult.user_type)
  ) {
    return {
      userType: llmResult.user_type,
      source: classifierSource,
    };
  }

  const confirmed = classifications.filter(
    (item) => item.confidence >= CLASSIFICATION_THRESHOLD,
  );

  if (confirmed.length > 0) {
    return {
      userType: modeWithLatestTieBreak(confirmed),
      source: 'history_fallback',
    };
  }

  return {
    userType: '개인 사용자',
    source: 'default_fallback',
  };
}
