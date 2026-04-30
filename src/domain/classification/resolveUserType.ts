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

function deriveLlmFailureReason(
  llmResult: LlmClassificationResult | null,
): string {
  if (!llmResult) return '어댑터 호출 실패 (timeout/parse error)';
  if (llmResult.user_type === 'unknown') return 'LLM이 타입을 unknown으로 판단';
  if (llmResult.confidence < CLASSIFICATION_THRESHOLD) {
    const got = Math.round(llmResult.confidence * 100);
    const need = Math.round(CLASSIFICATION_THRESHOLD * 100);
    return `신뢰도 부족 (${got}% < ${need}%)`;
  }
  if (!isAllowedLlmUserType(llmResult.user_type)) {
    return `허용되지 않은 타입 (${llmResult.user_type})`;
  }
  return '알 수 없음';
}

export interface ResolvedUserType {
  userType: Classification['userType'];
  source: Classification['source'];
  fallbackReason?: string;
}

export function resolveUserType(params: {
  llmResult: LlmClassificationResult | null;
  classifications: Classification[];
  classifierSource: 'mock_classifier' | 'llm_adapter';
}): ResolvedUserType {
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

  const llmFailureReason = deriveLlmFailureReason(llmResult);

  const confirmed = classifications.filter(
    (item) => item.confidence >= CLASSIFICATION_THRESHOLD,
  );

  if (confirmed.length > 0) {
    return {
      userType: modeWithLatestTieBreak(confirmed),
      source: 'history_fallback',
      fallbackReason: llmFailureReason,
    };
  }

  return {
    userType: '개인 사용자',
    source: 'default_fallback',
    fallbackReason: `${llmFailureReason} + 사용기록 부족`,
  };
}
