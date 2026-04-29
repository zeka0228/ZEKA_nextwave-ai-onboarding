# NextWave AI 온보딩 MVP QA 시나리오

## 0. 문서 개요

본 문서는 NextWave AI 온보딩 시스템 MVP 의 수동 QA 시나리오를 정의한다.

- **참조 문서**: `기능명세서_v0.4_revised.md` (§3-§5), `implementation-plan.md` (§7, §11), `implementation-extensions.md`
- **검증 기준**: `implementation-plan.md` §11 의 MVP 완료 정의 7개 조건을 빠짐없이 검증한다.
- **수행 시점**: 단계별 구현 완료 시 해당 섹션을 실행하고, 통합 데모 직전에 §K 골든 패스를 실행한다.

### 0.1 우선순위

| 등급 | 의미 | 대상 |
|---|---|---|
| 블로커 | 통과 못 하면 MVP 미완료 | A, B, C-1·C-2, D, E, F, H-1~H-3, I-1·I-2, K |
| 선택 | 정확도/UX 보강 | C-3, G-3, H-4·H-5, J, L |

### 0.2 환경 준비

- 데모 시작 전 debug 패널의 **영속 초기화 버튼 (resetState)** 으로 localStorage 비움
- 키: `nextwave-ai-onboarding:v1`
- 브라우저 DevTools → Application → Local Storage 로 영속 상태를 직접 확인 가능

---

## A. 콘텐츠 작성 (§3.3, §11-1)

### A-1. 메모 정상 작성

- **Given**: Dashboard 진입 후 `+ 새로 만들기` (또는 FAB) 클릭 → `ContentCreateModal` 열림
- **When**: 메모 탭 → 제목 `Q3 매출 보고서 회의`, 내용 `팀장님께 공유` 입력 → `생성 완료` 클릭
- **Then**:
  - 모달이 분석 상태로 전환됨
  - 콘텐츠가 `ContentList` 에 추가됨

### A-2. 일정 정상 작성

- **Given**: 모달 열림
- **When**: 일정 탭 → 제목/날짜 입력 → 생성 완료
- **Then**: 콘텐츠 type=`schedule`, `date` 필드 포함되어 저장

### A-3. Validation — 제목 누락

- **When**: 제목 비움 → `생성 완료` 버튼
- **Then**: 버튼 disabled (§3.3 입력 검증)

### A-4. Validation — 일정 탭 날짜 누락

- **When**: 일정 탭, 제목만 입력 후 생성 완료 시도
- **Then**: 차단 또는 에러 메시지 (§3.3)

### A-5. Validation — 길이 한계

- **When**: 제목 100자 초과 / 내용 2000자 초과 입력
- **Then**: 입력 차단 또는 잘림 (§3.3)

---

## B. AI 분석 상태 표시 (§3.3, §11-2)

### B-1. 로딩 표시

- **When**: A-1 직후
- **Then**: `AnalysisStatus` 가 "AI 분석 중..." (또는 "추천 준비 중...") 노출, 최대 5초 대기

### B-2. 5초 타임아웃 fallback

- **Given**: LLM adapter 모드에서 응답 지연 모킹
- **When**: 5초 경과
- **Then**: 분석 상태 종료 → §4.3 fallback 적용 후 메인으로 진행 (사용 이력 또는 개인 사용자)

---

## C. 분류 결과 표시 (§4, §11-3)

### C-1. user_type + confidence 노출

- **Given**: A-1 케이스 (직장인 키워드)
- **Then**: `ClassificationBadge` 가 `사용자 유형: 직장인 (신뢰도 0.87)` 형태로 표시

### C-2. AI 분석 근거 패널

- **Then**: `AnalysisReasonPanel` 에 reasoning 문구 + 감지 키워드 표시

### C-3. 테스트셋 정확도 (§4.5)

- **When**: 12개 테스트 케이스를 차례로 작성

| # | 제목 | 내용 | 기대 user_type |
|---|---|---|---|
| 1 | 중간고사 공부 계획 | 미적분, 선형대수 복습 | 대학생 |
| 2 | Q3 매출 보고서 회의 | 팀장님께 공유 | 직장인 |
| 3 | 클라이언트 A 납품 일정 | 납품일 3/15까지 마무리 | 프리랜서 |
| 4 | 우리 팀 스프린트 회고 | 김대리, 이과장과 | 팀 사용자 |
| 5 | 회의 준비 | (내용 없음) | unknown → fallback |
| 6 | 프로젝트 기획 | 시장조사 먼저 | unknown → fallback |
| 7 | 캡스톤 디자인 발표 | 교수님 피드백 반영 | 대학생 |
| 8 | 월요일 09:00 전사 회의 | 본사 1층 대회의실 | 직장인 |
| 9 | 외주 디자이너 미팅 | 로고 시안 검토 | 프리랜서 |
| 10 | 개발팀 주간 회의 | 스프린트 리뷰 | 팀 사용자 |
| 11 | 헬스장 PT 예약 | 오후 7시 | unknown → fallback |
| 12 | 책 독서 메모 | 행동 경제학 3장 | unknown → fallback |

- **Then**: 정확도 ≥ 80%

> **현행 측정 결과 (2026-04-29, gemma4:e4b)**: 정확도 100% (12/12), Macro-F1 1.000, latency mean 512ms / p95 793ms — 합격 기준 큰 마진 통과. 동일 평가셋이 `src/services/classifiers/__eval__/testset.ts` `qaScenarioCases` 에 fixture 화되어 있으며 `npm run eval:classifier -- --qa` 로 자동 측정. 진단 과정·전체 33건 회귀 결과는 `notes/classifier-eval.md` (.gitignore), 누적 변경 요약은 `implementation-extensions.md` §10 참조.

---

## D. 추천 카드 표시 (§5.1-5.2, §11-4)

### D-1. user_type별 1순위 매핑

| 입력 user_type | 기대 가이드 (guideId) | CTA |
|---|---|---|
| 대학생 | `student_notification_rule` | 알림 설정하기 |
| 직장인 | `workmate_team_invite` | 팀원 초대하기 |
| 프리랜서 | `freelancer_notification_rule` | 알림 설정하기 |
| 팀 사용자 | `team_notification_rule` | 규칙 만들기 |
| 개인 사용자 | `personal_note_share` | 메모 공유하기 |

→ 각 user_type 상태에서 `RecommendationCard` 의 title/description/cta 가 §5.2 문구와 일치하는지 확인.

### D-2. 동시 노출 금지

- **Then**: 화면에 추천 카드는 항상 1개만 노출 (§5.3)

---

## E. 사용 이력 결합 우선순위 (§5.4, §11-4)

### E-1. 1순위 기능 이미 사용

- **Given**: 직장인 분류 + `usedFeatures.team_invite = 1`
- **Then**: `team_invite` 추천이 노출되지 않고, 다음 우선순위 (`notification_rule`) 가이드로 fallback

### E-2. 개인 사용자 fallback 우선순위

- **Given**: 개인 사용자 분류, 모든 feature 미사용
- **Then**: `team_invite` 가이드 (workmate 카탈로그 fallback) 노출
- **When**: CTA 수락
- **Then**: 다음 추천은 `notification_rule` 가이드

### E-3. 모든 feature 사용 완료

- **Given**: 3개 feature 모두 used
- **Then**: 추천 카드 영역이 비거나 "추천 없음" 상태로 전환됨 (`selectRecommendation` 이 `null` 반환)

---

## F. CTA 수락 → mock API → 대시보드 반영 (§7.1, §11-5,6)

### F-1. 팀원 초대 흐름

- **Given**: 직장인 추천 노출
- **When**: `팀원 초대하기` 클릭
- **Then**:
  - `mockFeatureApi.inviteTeamMember` 성공 응답
  - `usedFeatures.team_invite` += 1
  - `StatsPanel` 의 collaborationRate / completionRate 등 mock delta 적용
  - `ContentList` 에 `[팀원 초대 완료]` 활동 항목 추가
  - `ProjectDriveMock` 에 공유 폴더/문서 mock 추가 (해당되는 경우)

### F-2. 알림 자동화 흐름

- **When**: 알림 CTA 수락
- **Then**: `notificationAdoptionRate` 증가, `ContentList` 에 `[알림 규칙 생성]` 추가

### F-3. 메모 공유 흐름

- **When**: 메모 공유 CTA 수락
- **Then**: `deliveryRate` 증가, `ProjectDriveMock` 에 공유 링크 추가

### F-4. Mock 라벨 노출

- **Then**: 대시보드 수치 영역에 `데모 지표` 또는 `Mock data` 라벨이 시인성 있게 표시 (`implementation-plan.md` §1, §6.2)

---

## G. 노출 제어 (§5.3)

### G-1. "나중에" — 세션 한정

- **When**: `나중에 하기` 클릭
- **Then**:
  - 같은 세션 동일 가이드 미노출, 다음 우선순위 fallback
  - 새로고침 시 다시 노출됨 (`sessionDismissedGuides` 영속 제외)

### G-2. "다시 보지 않기" — 영구

- **When**: `다시 보지 않기` 클릭
- **Then**: localStorage `dismissedGuides` 에 저장, 새로고침 후에도 미노출

### G-3. 30초 미반응 반투명 처리

- **When**: 추천 카드 노출 후 30초간 무반응
- **Then**: 카드 반투명 처리 (§5.3)
- **비고**: 현재 구현 여부 확인 필요. 미구현이면 별도 이슈로 트래킹.

### G-4. "나중에 하기" 무한 루프 회귀 (`implementation-extensions.md` §53)

- **Given**: 직장인 분류, `dismissedGuides` / `sessionDismissedGuides` 모두 비어 있음
- **When**: `나중에 하기` 1회 클릭
- **Then**: 동일 가이드가 즉시 재노출되지 않고, cross-userType fallback 으로 다른 가이드로 자연 진행
- **회귀 위험**: plan 원안 코드는 `usedFeatures` 만 보고 fallback 후보를 결정해 동일 가이드가 무한 재노출됨. 강화된 코드는 fallback 후보에도 `canShowGuide` 를 다시 통과시킨다.

---

## H. Fallback 매트릭스 (§4.3, §11-7)

| # | 유발 조건 | 1차 처리 결과 | 2차 (신규 유저) |
|---|---|---|---|
| H-1 | 5초 타임아웃 | 사용 이력 user_type 채택 | 개인 사용자 |
| H-2 | confidence < θ | 사용 이력 채택 | 개인 사용자 |
| H-3 | LLM 가 `unknown` 반환 | 사용 이력 채택 | 개인 사용자 |
| H-4 | JSON 파싱 실패 | 사용 이력 + 에러 로그 | 개인 사용자 |
| H-5 | user_type 다회 충돌 | 사용 이력 (최빈/최신) | 개인 사용자 |
| H-6 | 신규 분류가 기존보다 낮은 confidence | 기존 user_type 유지 | — |

→ 각 케이스에서 UI 가 에러를 강조하지 않고 정상 추천으로 진행되는지 확인 (§7.2).

### H-7. 사용 이력 최빈값 + 동률 시 최신 (§4.6)

- **Given**: classifications = `[직장인 0.9, 대학생 0.85, 직장인 0.8, 대학생 0.95]` (동률 2:2)
- **When**: 분류 실패 → 이력 fallback
- **Then**: 최신값 우선 → `대학생` 채택

---

## I. 영속성 (§6, `implementation-plan.md` §3, §8-1)

### I-1. 저장 대상

- **When**: 일련의 작성/CTA/dismiss 후 새로고침
- **Then** 복원되어야 함:
  - `userId`, `displayName`, `userType`
  - `classifications`
  - `dismissedGuides`
  - `usedFeatures`
  - contents, dashboard 상태

### I-2. 영속 제외

- **Then**: `sessionDismissedGuides` 는 빈 배열로 초기화 (`storage.ts:10-12` 의 `PersistedUserState = Omit<UserState, 'sessionDismissedGuides'>`)

### I-3. resetState

- **When**: debug 패널의 영속 초기화 클릭
- **Then**: localStorage 비워지고 분류 선택 (또는 초기 화면) 부터 재시작 가능

---

## J. 누적 재분류 (§4.4, 선택)

### J-1. 3개 누적 시점 재분석

- **Given**: 콘텐츠 1·2개 작성 시점
- **Then**: user_type 잠정 표시 (확정 보류 표시 — 구현 시)
- **When**: 3번째 작성 완료
- **Then**: 전체 재분석 → 최종 user_type 확정, 추천 카드 재선정
- **비고**: 미구현이면 단일 분류만 사용 (§4.4 명시).

---

## K. 엔드투엔드 골든 패스 (§7.1)

**시나리오**: 신규 사용자 → 직장인 메모 → 추천 → CTA → 대시보드 확인

1. 빈 상태로 진입 (또는 resetState 적용)
2. 모달 열고 `Q3 매출 보고서 회의` 작성 → 분석 → `직장인 0.87` 확인
3. `RecommendationCard` 가 `동료와 함께하면 더 편해요` 표시
4. `팀원 초대하기` 클릭
5. `usedFeatures.team_invite = 1`, `StatsPanel` 갱신, `ContentList` 활동 추가 확인
6. 두 번째 메모 작성 → 추천이 `notification_rule` 로 이동했는지 확인
7. 새로고침 → 위 상태 모두 복원, 추천 우선순위 유지

→ 흐름이 한 번도 끊기지 않고 위 7단계가 모두 통과하면 `implementation-plan.md` §11 MVP 완료 정의 7개 조건이 모두 충족된 것으로 본다.

---

## L. P1+ 영역 (참고용, MVP 합격 기준 외)

- 로그인/튜토리얼 mock 화면 (§3.1, 3.2 — `implementation-plan.md` 우선순위 P2)
- 실제 LLM adapter 연결 후 §H 매트릭스 재검증
- 피드백 수집·재추천 트리거 (C 범위, 문서만)

---

## 변경 이력

| 일자 | 변경 사항 |
|---|---|
| 2026-04-28 | 초안 작성. 기능명세서 v0.4-revised + implementation-plan §11 기준 |
| 2026-04-29 | C-3 에 LLM 분류기 측정 결과 기록 (100% / Macro-F1 1.000 / latency p95 793ms) |
