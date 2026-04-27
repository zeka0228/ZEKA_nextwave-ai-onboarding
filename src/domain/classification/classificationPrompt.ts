import type { ClassificationInput } from '../types';

export function buildClassificationPrompt(input: ClassificationInput): string {
  return `당신은 사용자의 생산성 도구 사용 맥락을 분석하는 분류기입니다.

사용자가 작성한 메모 또는 일정의 제목과 내용을 보고 다음 user_type 중 하나를 선택하세요.

[user_type]
- 대학생: 강의, 시험, 과제, 팀플, 동아리, 학점, 수업 등 학업 맥락
- 직장인: 회의, 보고, 미팅, 업무, 결재, 출장 등 조직 내 업무 맥락
- 프리랜서: 클라이언트, 프로젝트 납품, 견적, 외주, 개인 사업 맥락
- 팀 사용자: 우리 팀, 부서, 공동, 협업, 스프린트 등 복수 인원 협업 맥락
- unknown: 사적 메모이거나 맥락이 모호한 경우

[입력]
제목: ${input.title}
내용: ${input.content}
타입: ${input.type}

[출력]
JSON으로만 답변하세요.
{
  "user_type": "대학생|직장인|프리랜서|팀 사용자|unknown",
  "confidence": 0.0,
  "reasoning": "판단 근거 한 문장",
  "keywords": ["감지 키워드"]
}`;
}
