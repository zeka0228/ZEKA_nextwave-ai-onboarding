import type { ClassificationInput, LlmUserType } from '../../../domain/types';

export interface EvalCase {
  id: string;
  input: ClassificationInput;
  expected: LlmUserType;
  difficulty: 'easy' | 'edge';
  note?: string;
}

export const evalCases: EvalCase[] = [
  // 대학생 (8)
  {
    id: 'student-01',
    expected: '대학생',
    difficulty: 'easy',
    input: {
      type: 'schedule',
      title: '자료구조 중간고사',
      content: '5/15 09:00 309호. 챕터 4~7 정리, 트리/그래프 위주 문제풀이 마무리.',
    },
  },
  {
    id: 'student-02',
    expected: '대학생',
    difficulty: 'easy',
    input: {
      type: 'memo',
      title: '캡스톤 발표 준비',
      content: '팀플 슬라이드 30장 분량, 교수님 피드백 반영해 데모 시나리오 다시 짜기.',
    },
  },
  {
    id: 'student-03',
    expected: '대학생',
    difficulty: 'easy',
    input: {
      type: 'memo',
      title: '알고리즘 과제 제출',
      content: '백준 11657, 1753 풀어서 PR 올리고 조교 메일로 학번 적어 제출.',
    },
  },
  {
    id: 'student-04',
    expected: '대학생',
    difficulty: 'easy',
    input: {
      type: 'schedule',
      title: '동아리 정기모임',
      content: '학생회관 304호 19:00. 신입 부원 OT 일정 정하기.',
    },
  },
  {
    id: 'student-05',
    expected: '대학생',
    difficulty: 'easy',
    input: {
      type: 'memo',
      title: '졸업학점 정리',
      content: '전공 필수 3학점 부족. 다음 학기 수강신청 때 데이터베이스 꼭 잡아야 함.',
    },
  },
  {
    id: 'student-06',
    expected: '대학생',
    difficulty: 'easy',
    input: {
      type: 'memo',
      title: '교양 과제 마감',
      content: 'A4 5장 보고서, 내일 자정까지 LMS 업로드. 인용 출처 정리 필요.',
    },
  },
  {
    id: 'student-07',
    expected: '대학생',
    difficulty: 'edge',
    note: '학회 — 학생/직장인 모두 가능, 학부생 맥락 단서',
    input: {
      type: 'schedule',
      title: '학회 참석',
      content: '학부 연구실 인솔로 한국정보과학회 포스터 세션 발표. 지도교수님 동행.',
    },
  },
  {
    id: 'student-08',
    expected: '대학생',
    difficulty: 'edge',
    note: '짧은 입력, 키워드 적음',
    input: {
      type: 'memo',
      title: '시험기간',
      content: '도서관 자리 맡기. 카페인 보충.',
    },
  },

  // 직장인 (8)
  {
    id: 'worker-01',
    expected: '직장인',
    difficulty: 'easy',
    input: {
      type: 'schedule',
      title: '주간 회의록 정리',
      content: '안건: 4월 KPI 리뷰, 5월 결산 보고. 팀장 결재 후 본사 공유.',
    },
  },
  {
    id: 'worker-02',
    expected: '직장인',
    difficulty: 'easy',
    input: {
      type: 'memo',
      title: '분기 결산 보고서',
      content: '재무팀 데이터 수합, 임원 보고용 1장 요약 + 부록 첨부. 결재선 확인.',
    },
  },
  {
    id: 'worker-03',
    expected: '직장인',
    difficulty: 'easy',
    input: {
      type: 'schedule',
      title: '거래처 미팅',
      content: '14:00 강남 본사. 계약 갱신 조건 협상, 법무팀 검토안 지참.',
    },
  },
  {
    id: 'worker-04',
    expected: '직장인',
    difficulty: 'easy',
    input: {
      type: 'schedule',
      title: '부산 출장 일정',
      content: 'KTX 07:30. 지사 방문, 호텔 1박. 출장신청서 사전 제출 완료.',
    },
  },
  {
    id: 'worker-05',
    expected: '직장인',
    difficulty: 'easy',
    input: {
      type: 'memo',
      title: '인사평가 자기기술서',
      content: '상반기 성과 지표 정리. 매니저 1on1 전까지 초안 마감.',
    },
  },
  {
    id: 'worker-06',
    expected: '직장인',
    difficulty: 'easy',
    input: {
      type: 'memo',
      title: '영업보고서 v2',
      content: '4월 매출 전월대비 12% 상승, 신규 거래처 3곳. 본부장 보고용 정리.',
    },
  },
  {
    id: 'worker-07',
    expected: '직장인',
    difficulty: 'edge',
    note: '단순 영수증 정리 — 사적 가계부와 헷갈릴 수',
    input: {
      type: 'memo',
      title: '법인카드 영수증',
      content: '4월 사용분 회계팀 제출용 정리. 거래처 식대 항목 분리 필요.',
    },
  },
  {
    id: 'worker-08',
    expected: '직장인',
    difficulty: 'edge',
    note: '워크샵 — 팀 사용자와 헷갈릴 수, 사내 행사 단서',
    input: {
      type: 'schedule',
      title: '사내 워크샵',
      content: '6/3~6/4 양평. 본사 전사 인원 참석, 부서별 발표 세션 포함.',
    },
  },

  // 프리랜서 (6)
  {
    id: 'freelancer-01',
    expected: '프리랜서',
    difficulty: 'easy',
    input: {
      type: 'memo',
      title: '클라이언트 견적서 발송',
      content: 'A사 외주 건, 작업기간 3주 / 200만원 견적. 수정 1회 포함 명시.',
    },
  },
  {
    id: 'freelancer-02',
    expected: '프리랜서',
    difficulty: 'easy',
    input: {
      type: 'schedule',
      title: '디자인 시안 1차 납품',
      content: '브랜드 로고 시안 3종 클라이언트 메일 전달. 피드백 반영 일정 잡기.',
    },
  },
  {
    id: 'freelancer-03',
    expected: '프리랜서',
    difficulty: 'easy',
    input: {
      type: 'memo',
      title: '외주 계약서 검토',
      content: '저작권 귀속 조항 수정 요청. 인지세 부담 주체 확인 필요.',
    },
  },
  {
    id: 'freelancer-04',
    expected: '프리랜서',
    difficulty: 'easy',
    input: {
      type: 'memo',
      title: '포트폴리오 업데이트',
      content: '3월 납품한 쇼핑몰 리뉴얼 케이스 추가. 비밀유지 부분 마스킹.',
    },
  },
  {
    id: 'freelancer-05',
    expected: '프리랜서',
    difficulty: 'easy',
    input: {
      type: 'memo',
      title: '세금계산서 발행',
      content: '4월 작업분 클라이언트 3곳 분할 발행. 사업자번호 재확인.',
    },
  },
  {
    id: 'freelancer-06',
    expected: '프리랜서',
    difficulty: 'edge',
    note: '신규 클라이언트 미팅 — 직장인 영업과 헷갈릴 수',
    input: {
      type: 'schedule',
      title: '신규 클라이언트 미팅',
      content: '스타트업 B사 마케팅 페이지 외주 의뢰 건, 단가 협의 및 일정 가능 여부 확정.',
    },
  },

  // 팀 사용자 (6)
  {
    id: 'team-01',
    expected: '팀 사용자',
    difficulty: 'easy',
    input: {
      type: 'schedule',
      title: '스프린트 회고',
      content: '우리 팀 2주차 스프린트 KPT 회고. 액션아이템 노션에 공동 정리.',
    },
  },
  {
    id: 'team-02',
    expected: '팀 사용자',
    difficulty: 'easy',
    input: {
      type: 'memo',
      title: '우리 팀 2분기 OKR',
      content: 'KR1: 응답시간 30% 개선. KR2: 협업 문서 표준화. 팀원 모두에게 공유.',
    },
  },
  {
    id: 'team-03',
    expected: '팀 사용자',
    difficulty: 'easy',
    input: {
      type: 'schedule',
      title: '개발팀 코드리뷰 데이',
      content: '매주 수요일 16:00. PR 리스트 공동 검토, 페어 리뷰 로테이션.',
    },
  },
  {
    id: 'team-04',
    expected: '팀 사용자',
    difficulty: 'easy',
    input: {
      type: 'memo',
      title: '부서 KPI 공유',
      content: '부서원 모두 접근 가능한 공동 대시보드. 주간 단위 갱신.',
    },
  },
  {
    id: 'team-05',
    expected: '팀 사용자',
    difficulty: 'easy',
    input: {
      type: 'memo',
      title: '협업 문서 템플릿',
      content: '팀 내 RFC 양식 통일. 스프린트 시작 전 작성 의무화.',
    },
  },
  {
    id: 'team-06',
    expected: '팀 사용자',
    difficulty: 'edge',
    note: '직장인 회의와 헷갈릴 수 — 협업/공동 단서',
    input: {
      type: 'schedule',
      title: '팀 빌딩 워크샵',
      content: '개발팀 + 디자인팀 합동, 협업 프로세스 회고 후 공동 액션아이템 도출.',
    },
  },

  // unknown (5)
  {
    id: 'unknown-01',
    expected: 'unknown',
    difficulty: 'easy',
    input: {
      type: 'memo',
      title: '마트 장보기',
      content: '우유, 식빵, 계란 한 판, 사과 5개. 카드 할인 요일 확인.',
    },
  },
  {
    id: 'unknown-02',
    expected: 'unknown',
    difficulty: 'easy',
    input: {
      type: 'memo',
      title: '헬스 루틴',
      content: '월: 가슴/삼두, 수: 등/이두, 금: 하체. 유산소 20분 추가.',
    },
  },
  {
    id: 'unknown-03',
    expected: 'unknown',
    difficulty: 'easy',
    input: {
      type: 'memo',
      title: '볼만한 영화',
      content: '인터스텔라 재관람, 듄2, 패스트라이브즈. 주말에 한 편 골라 보기.',
    },
  },
  {
    id: 'unknown-04',
    expected: 'unknown',
    difficulty: 'easy',
    input: {
      type: 'schedule',
      title: '제주도 여행',
      content: '5/10~5/12 2박3일. 렌터카 예약 완료, 숙소 결제 남음.',
    },
  },
  {
    id: 'unknown-05',
    expected: 'unknown',
    difficulty: 'edge',
    note: '짧고 맥락 모호',
    input: {
      type: 'memo',
      title: '내일 할 일',
      content: '아침에 먼저 할 거 정리. 나머지는 그때 보고 결정.',
    },
  },
];

/**
 * docs/qa-scenarios.md §C-3 의 12 케이스.
 * MVP 합격 기준: 정확도 ≥ 80% (10/12 이상).
 * fallback 으로 명시된 케이스는 raw user_type='unknown' 또는 threshold 미만이 정답.
 */
export const qaScenarioCases: EvalCase[] = [
  {
    id: 'qa-01',
    expected: '대학생',
    difficulty: 'easy',
    input: { type: 'memo', title: '중간고사 공부 계획', content: '미적분, 선형대수 복습' },
  },
  {
    id: 'qa-02',
    expected: '직장인',
    difficulty: 'easy',
    input: { type: 'memo', title: 'Q3 매출 보고서 회의', content: '팀장님께 공유' },
  },
  {
    id: 'qa-03',
    expected: '프리랜서',
    difficulty: 'easy',
    input: {
      type: 'schedule',
      title: '클라이언트 A 납품 일정',
      content: '납품일 3/15까지 마무리',
    },
  },
  {
    id: 'qa-04',
    expected: '팀 사용자',
    difficulty: 'easy',
    input: { type: 'memo', title: '우리 팀 스프린트 회고', content: '김대리, 이과장과' },
  },
  {
    id: 'qa-05',
    expected: 'unknown',
    difficulty: 'edge',
    note: 'unknown → fallback',
    input: { type: 'memo', title: '회의 준비', content: '' },
  },
  {
    id: 'qa-06',
    expected: 'unknown',
    difficulty: 'edge',
    note: 'unknown → fallback',
    input: { type: 'memo', title: '프로젝트 기획', content: '시장조사 먼저' },
  },
  {
    id: 'qa-07',
    expected: '대학생',
    difficulty: 'easy',
    input: {
      type: 'memo',
      title: '캡스톤 디자인 발표',
      content: '교수님 피드백 반영',
    },
  },
  {
    id: 'qa-08',
    expected: '직장인',
    difficulty: 'easy',
    input: {
      type: 'schedule',
      title: '월요일 09:00 전사 회의',
      content: '본사 1층 대회의실',
    },
  },
  {
    id: 'qa-09',
    expected: '프리랜서',
    difficulty: 'easy',
    input: {
      type: 'schedule',
      title: '외주 디자이너 미팅',
      content: '로고 시안 검토',
    },
  },
  {
    id: 'qa-10',
    expected: '팀 사용자',
    difficulty: 'easy',
    input: { type: 'schedule', title: '개발팀 주간 회의', content: '스프린트 리뷰' },
  },
  {
    id: 'qa-11',
    expected: 'unknown',
    difficulty: 'easy',
    note: 'unknown → fallback',
    input: { type: 'schedule', title: '헬스장 PT 예약', content: '오후 7시' },
  },
  {
    id: 'qa-12',
    expected: 'unknown',
    difficulty: 'easy',
    note: 'unknown → fallback',
    input: { type: 'memo', title: '책 독서 메모', content: '행동 경제학 3장' },
  },
];
