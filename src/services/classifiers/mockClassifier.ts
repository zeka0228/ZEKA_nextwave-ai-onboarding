import type {
  ClassificationInput,
  LlmClassificationResult,
  LlmUserType,
} from '../../domain/types';
import type { ClassifierAdapter } from './classifyContent';

type MatchableUserType = Exclude<LlmUserType, 'unknown'>;

const keywordMap: Record<MatchableUserType, string[]> = {
  대학생: ['시험', '과제', '강의', '교수님', '학점', '캡스톤', '수업', '발표'],
  직장인: ['회의', '보고', '팀장', '업무', '결재', '본사', '팀원', '공유', '미팅'],
  프리랜서: ['클라이언트', '외주', '납품', '견적', '시안', '계약'],
  '팀 사용자': ['우리 팀', '공동', '협업', '스프린트', '개발팀', '부서'],
};

const reasoningTemplate: Record<MatchableUserType, string> = {
  대학생: '학업 일정과 학습 맥락이 감지되었습니다.',
  직장인: '회의와 팀원 공유 맥락이 업무 상황에 가깝습니다.',
  프리랜서: '클라이언트 또는 외주 납품 맥락이 감지되었습니다.',
  '팀 사용자': '팀 협업과 반복 업무 맥락이 감지되었습니다.',
};

const orderedTypes: MatchableUserType[] = ['직장인', '팀 사용자', '대학생', '프리랜서'];

export const mockClassifier: ClassifierAdapter = {
  async classify(input: ClassificationInput): Promise<LlmClassificationResult> {
    const haystack = `${input.title} ${input.content}`;

    let bestType: MatchableUserType | null = null;
    let bestMatches: string[] = [];

    for (const type of orderedTypes) {
      const matches = keywordMap[type].filter((kw) => haystack.includes(kw));
      if (matches.length > bestMatches.length) {
        bestType = type;
        bestMatches = matches;
      }
    }

    if (!bestType) {
      return {
        user_type: 'unknown',
        confidence: 0.4,
        reasoning: '명확한 업무 또는 학습 맥락이 감지되지 않았습니다.',
        keywords: [],
      };
    }

    const confidence = Math.min(0.7 + bestMatches.length * 0.06, 0.92);

    return {
      user_type: bestType,
      confidence: Number(confidence.toFixed(2)),
      reasoning: reasoningTemplate[bestType],
      keywords: bestMatches,
    };
  },
};
