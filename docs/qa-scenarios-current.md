# NextWave 현행 빌드 QA 시나리오 (필수 MVP)

## 0. 문서 개요

본 문서는 **현재 레포 (`dashboard-flow` 브랜치) 에 실제 구현된 코드** 만을 대상으로 하는 수동 QA 시나리오이다.
스펙 (`기능명세서_v0.4_revised.md`) 전체 범위 검증은 `qa-scenarios.md` 를 참조한다.

### 0.1 현행 빌드 상태 요약

| 항목 | 상태 | 비고 |
|---|---|---|
| Dashboard 단일 화면 | ✅ 구현 | `DashboardScreen` |
| 콘텐츠 작성 모달 | ✅ 구현 | 메모/일정 탭 (날짜 필드 없음) |
| 분류 흐름 | ⚠️ **수동 picker 모드** | `_debug/ManualPickerHost` 활성. 자동 mockClassifier 아님 |
| AI 분석 상태 표시 | ✅ 구현 | 800ms 지연 (`DEMO_ANALYSIS_DELAY_MS`) |
| 분류 결과 표시 | ✅ 구현 | `ClassificationBadge`, `AnalysisReasonPanel` |
| 추천 카드 | ✅ 구현 | `RecommendationCard` |
| 사용 이력 결합 우선순위 | ✅ 구현 | `selectRecommendation` |
| CTA → mock API → 대시보드 반영 | ✅ 구현 | 3종 feature 모두 |
| 나중에 / 다시 보지 않기 | ✅ 구현 | session vs 영속 분리 |
| localStorage 영속 | ✅ 구현 | 키: `nextwave-ai-onboarding:v1` |
| 영속 초기화 (resetState) | ✅ 구현 | manual picker 헤더 우측 버튼 |

### 0.2 현행 미구현 (검증 대상 제외)

- **자동 LLM/mock 분류**: 현재 모든 콘텐츠 제출은 manual picker 를 띄움. 12개 테스트셋 자동 정확도 검증 불가.
- **일정 탭 날짜 입력**: `ContentForm` 에 date 필드 없음. 일정 탭과 메모 탭의 입력 필드가 동일.
- **5초 타임아웃 fallback**: 현재 picker 가 응답할 때까지 영구 대기.
- **JSON 파싱 실패 / 다회 충돌 fallback**: 자동 분류 미사용으로 자연 발생 불가 (manual picker 의 "실패1·실패2" 버튼으로만 시뮬레이션).
- **30초 미반응 반투명 처리**.
- **누적 재분류** (3개 누적 시점 전체 재분석).
- **로그인 / 튜토리얼 화면**.
- **입력 길이 검증** (제목 100자 / 내용 2000자 한계).
- **제목만으로 작성 가능** (스펙은 내용 선택, 현행은 **제목·내용 모두 필수**).

### 0.3 환경 준비

- 개발 서버: `npm run dev` → `http://localhost:5173/`
- 시작 전 manual picker 헤더 우측 **영속 초기화** 버튼으로 localStorage 비움
- DevTools → Application → Local Storage → `nextwave-ai-onboarding:v1` 페이로드로 영속 상태 직접 확인

---

## A. 콘텐츠 작성 (`ContentCreateModal`)

### A-1. 모달 열기/닫기

- **Given**: Dashboard 진입 후 우측 상단 `새로 만들기` 클릭
- **Then**: 모달이 오버레이로 표시되며 제목/내용 입력 가능
- **When**: 우측 `×` 또는 좌측 `취소` 또는 오버레이 외부 클릭
- **Then**: 모달 닫힘

### A-2. 메모 작성 정상 흐름

- **Given**: 모달 열림. 기본값으로 제목 `회의 준비`, 내용 `팀원들과 공유할 내용 정리` 가 미리 채워져 있음
- **When**: (그대로 또는 수정 후) `생성 완료` 클릭
- **Then**:
  - 모달이 닫힘
  - `RecommendationCard` 가 분석 상태로 전환 (분석 중 카피 노출)
  - manual picker 가 약 800ms 후 (`DEMO_ANALYSIS_DELAY_MS`) 표시됨

### A-3. 일정 탭 작성

- **Given**: 모달 열림 → `일정` 탭 선택
- **Then**: 입력 필드는 메모 탭과 동일 (제목·내용). **날짜 필드 없음** — 현행 사양
- **When**: `생성 완료`
- **Then**: 콘텐츠 type=`schedule` 으로 저장 (`ContentList` 에서 메모/일정 구분 표시 확인)

### A-4. Validation — 제목 또는 내용 비움 ⚠️

- **When**: 제목 또는 내용을 모두 비우고 시도
- **Then**: `생성 완료` 버튼 disabled (`isValid = title.trim() && body.trim()`)
- **비고**: 스펙 §3.3 은 내용을 선택으로 두지만 **현행은 둘 다 필수**. 회귀 발생 시 우선 현행 동작 기준으로 판정.

---

## B. AI 분석 상태 표시 (`AnalysisStatus`)

### B-1. 분석 중 카피

- **When**: A-2 직후, manual picker 가 뜨기 전 ~800ms
- **Then**: `RecommendationCard` 가 "방금 작성하신 내용을 분석하고 있어요. 잠시만 기다려주세요." 로 표시되고 `AnalysisStatus state="analyzing"` 노출

### B-2. 분석 완료 표시

- **When**: manual picker 에서 user_type 선택 완료
- **Then**: 카드가 `AnalysisStatus state="done"` + 분류 결과 + 추천 가이드 영역으로 전환

---

## C. Manual Picker 분류 분기 (`_debug/ManualPickerHost`)

> 현행 빌드는 자동 분류 대신 수동 picker 가 분류 결과를 결정한다. picker 의 3가지 분기를 모두 검증한다.

### C-1. 성공 경로 → user_type 직접 선택

- **When**: picker 1단계에서 `성공` 클릭 → user_type 4종 (`대학생`/`직장인`/`프리랜서`/`팀 사용자`) 중 1개 선택
- **Then**:
  - `ClassificationBadge` 가 `사용자 유형: {선택값} (신뢰도 0.87)` 표시
  - `AnalysisReasonPanel` 에 `[수동] mock_classifier 경로로 {타입} 선택` reasoning 노출, 키워드 `수동`, `선택` 표시
  - `RecommendationCard` 에 §D-1 매핑에 따른 추천 노출

### C-2. 실패1 → 사용 이력 폴백 → user_type 선택

- **Given**: 이전 작성에서 `성공` 으로 confidence ≥ 0.75 인 분류 이력이 1개 이상 존재
- **When**: 새 콘텐츠 작성 → picker 에서 `실패1` → `사용이력 성공` → user_type 선택
- **Then**: `AnalysisReasonPanel` reasoning 에 `history_fallback` 표기, 추천 카드는 §D-1 매핑대로 노출

### C-3. 실패1 → 이력도 없음 → default fallback

- **Given**: resetState 직후 (이력 0건)
- **When**: picker 에서 `실패1` → `실패2` (또는 1단계에서 바로 `실패2`)
- **Then**:
  - 분류 결과: `개인 사용자`, confidence `0`
  - reasoning: `[수동] default fallback 으로 강제 분류`
  - 추천: `personal_note_share` (메모 공유)

### C-4. picker 단계 뒤로가기

- **When**: `실패1` 진입 후 또는 `성공 → user_type 선택` 진입 후 `← 처음으로` 클릭
- **Then**: 1단계로 복귀, 동일 콘텐츠에 대해 다른 분기 선택 가능

---

## D. 추천 카드 표시 (`RecommendationCard` + `selectRecommendation`)

### D-1. user_type별 1순위 가이드

C-1 또는 C-2 의 user_type 선택 결과별로 다음 가이드가 노출되는지 확인 (`guideCatalog.ts`).

| user_type | guideId | title | CTA |
|---|---|---|---|
| 대학생 | `student_notification_rule` | 중요한 일정을 놓치지 않게 알림을 설정하세요 | 알림 설정하기 |
| 직장인 | `workmate_team_invite` | 동료와 함께하면 더 편해요 | 팀원 초대하기 |
| 프리랜서 | `freelancer_notification_rule` | 마감을 놓치지 않는 알림을 설정해보세요 | 알림 설정하기 |
| 팀 사용자 | `team_notification_rule` | 반복되는 알림을 자동화해 효율을 높이세요 | 규칙 만들기 |
| 개인 사용자 | `personal_note_share` | 이 메모를 다른 사람과 공유할 수 있어요 | 메모 공유하기 |

### D-2. 동시 노출 금지

- **Then**: 화면에 추천 카드는 항상 1개만 노출

### D-3. 분석 근거 패널 구성

- **Then**: `AnalysisReasonPanel` 의 points 영역에 다음 3줄이 순서대로 표시되는지 확인
  1. `이번 메모의 주제: '{lastContent.title}'`
  2. `classification.reasoning` (또는 fallback 텍스트)
  3. `추천 가이드: {recommendation.title}`

---

## E. 사용 이력 결합 우선순위 (`selectRecommendation`)

### E-1. 1순위 기능 사용 후 다음 우선순위로 이동

- **Given**: resetState → 직장인 분류 → CTA 수락 (`팀원 초대하기`) → `usedFeatures.team_invite = 1`
- **When**: 새 콘텐츠 작성 → picker 에서 `직장인` 다시 선택
- **Then**: `team_invite` 추천이 노출되지 않고 `student_notification_rule` (또는 `notification_rule` featureKey 를 가진 다른 카탈로그 가이드 중 catalog 순서상 먼저 매칭되는 것) 로 fallback

### E-2. 개인 사용자 fallback 의 cross-userType 동작

- **Given**: resetState → 첫 작성에서 `실패1 → 실패2` 로 default fallback (개인 사용자)
- **Then**: 추천이 `personal_note_share` (note_share) 가 1순위지만 `team_invite` 가 globalFeaturePriority 에서 우선
  - `globalFeaturePriority` = `team_invite → notification_rule → note_share`
  - 결과: `workmate_team_invite` (직장인 카탈로그) cross-userType fallback 으로 노출
- **검증 포인트**: 카드 title 이 `동료와 함께하면 더 편해요`, CTA 가 `팀원 초대하기` 인지 확인

### E-3. 모든 feature 사용 완료 시 추천 종료

- **Given**: 3종 feature 모두 CTA 수락 완료 (`team_invite`, `notification_rule`, `note_share` 가 1 이상)
- **When**: 새 콘텐츠 작성 후 user_type 선택
- **Then**: `RecommendationCard` 가 분류 결과만 노출하고 추천 영역이 빈 상태가 되거나, "메모나 일정을 작성하면 맞춤 추천을 보여드릴게요" 류의 fallback 메시지로 전환됨 (`selectRecommendation` 이 `null` 반환)

---

## F. CTA 수락 → mock API → 대시보드 반영 (`acceptCta`, `applyCtaToDashboard`)

### F-1. 팀원 초대 (`team_invite`)

- **Given**: 직장인 추천 노출
- **When**: `팀원 초대하기` 클릭
- **Then**:
  - `mockFeatureApi.invokeMockFeature('team_invite')` 성공 응답
  - `usedFeatures.team_invite` += 1
  - `StatsPanel` 의 metrics 갱신 (`ctaDeltas.team_invite` 적용)
  - `ContentList`/완료 작업 영역에 `팀 초대 완료` (`kind: 'team_invite'`) 항목 추가
  - 이벤트 로그에 `[팀 초대] {content.title}` 기록
  - 추천 카드 → 다음 우선순위 추천으로 갱신

### F-2. 알림 자동화 (`notification_rule`)

- **When**: 알림 CTA (대학생/프리랜서/팀 사용자 분류 시) 수락
- **Then**:
  - `완료 작업` 에 `알림 규칙 생성` 추가
  - 이벤트: `[알림 규칙] {content.title}`
  - metrics 에 `ctaDeltas.notification_rule` 적용

### F-3. 메모 공유 (`note_share`)

- **When**: 개인 사용자 추천에서 `메모 공유하기` 클릭
- **Then**:
  - `ProjectDriveMock` 에 `{content.title} (공유 링크)` 항목 추가 (`kind: 'shared_link'`)
  - 이벤트: `[메모 공유] {content.title}`
  - metrics 에 `ctaDeltas.note_share` 적용

### F-4. 활성 추천 없을 때 CTA 호출

- **Given**: 추천 영역이 빈 상태 (`activeRecommendation = null`)
- **When**: CTA 버튼이 노출되지 않음
- **Then**: 사용자가 CTA 를 트리거할 수 없음 (`acceptCta` 의 early return — 이론 검증)

---

## G. 노출 제어

### G-1. "나중에 하기" — 세션 한정

- **When**: 추천 카드의 `나중에 하기` 클릭
- **Then**:
  - `sessionDismissedGuides` 에 해당 guideId 추가 (DevTools 로 확인)
  - 같은 세션에서 동일 가이드 미노출, 다음 우선순위 가이드로 fallback
  - localStorage 페이로드에는 해당 guideId 가 **저장되지 않음**

### G-2. "나중에 하기" + 새로고침

- **Given**: G-1 직후 상태
- **When**: 브라우저 새로고침
- **Then**: `sessionDismissedGuides` 빈 배열로 초기화 → 직전에 dismiss 했던 가이드가 다시 노출됨

### G-3. "다시 보지 않기" — 영구

- **When**: `다시 보지 않기` 클릭
- **Then**: `dismissedGuides` 에 추가, localStorage 에도 저장
- **When**: 새로고침
- **Then**: 동일 가이드 영구 미노출

### G-4. 무한 루프 회귀 방지 (`implementation-extensions.md` §53)

- **Given**: resetState → 직장인 분류 → 추천 노출
- **When**: `나중에 하기` 1회 클릭
- **Then**: 동일한 `workmate_team_invite` 가 재노출되지 않고, fallback 으로 `notification_rule` 계열 다른 가이드로 자연 진행
- **회귀 시 증상**: 같은 가이드가 dismiss 후 즉시 다시 표시됨

---

## H. 영속성 / 초기화

### H-1. 영속 저장 대상

- **When**: 작성 + CTA + dismiss 등 일련의 동작 후 새로고침
- **Then** 복원되어야 함:
  - `user.userId`, `displayName`, `userType`
  - `user.classifications`
  - `user.dismissedGuides`
  - `user.usedFeatures`
  - `contents`
  - `guideImpressions`
  - `dashboard` 전체 (metrics, completedWorks, projectDriveItems, events 등)

### H-2. 영속 제외

- **Then**: `user.sessionDismissedGuides` 는 새로고침 시 빈 배열로 초기화 (`storage.ts` 의 `PersistedUserState = Omit<UserState, 'sessionDismissedGuides'>` + `AppStateProvider.tsx:76` 의 강제 초기화)

### H-3. resetState

- **Given**: 임의 진행 상태
- **When**: manual picker 헤더 우측 `영속 초기화` 클릭 → confirm 다이얼로그에서 확인
- **Then**:
  - localStorage 에서 키 삭제
  - 새로고침 없이 즉시 초기 상태로 복귀
  - 이전에 진행 중이던 picker 의 promise 는 의도적으로 resolve 되지 않음 (race 방지) → `submitContent` 의 매달린 await 는 다음 GC 에 정리됨
  - 새 작성 흐름이 정상 동작

### H-4. 진행 중 picker 강제 초기화 race 검증

- **Given**: 콘텐츠 작성 → picker 가 떠있는 상태 (아직 user_type 미선택)
- **When**: picker 우측 `영속 초기화` 클릭
- **Then**: 매달린 picker 가 사라지고 dashboard 가 초기 상태로 갱신. 이후 새 콘텐츠 작성·picker 재진입 가능. `ANALYSIS_RESOLVED` 가 reset 결과를 덮어쓰지 않아야 함.

---

## K. 엔드투엔드 골든 패스 (현행 빌드 기준)

**시나리오**: 신규 사용자 → 직장인 메모 → CTA 수락 → 다음 추천 → 새로고침

1. 영속 초기화 → 깨끗한 상태 진입
2. `새로 만들기` → 기본값 그대로 `생성 완료`
3. 분석 중 카피 ~800ms 노출 후 manual picker 진입
4. picker: `성공` → `직장인` 선택
5. `RecommendationCard` 에 신뢰도 0.87, 추천 `동료와 함께하면 더 편해요` 표시
6. `팀원 초대하기` 클릭
7. `완료 작업` 에 `팀 초대 완료` 항목 추가, `StatsPanel` 수치 변화, `usedFeatures.team_invite=1` (DevTools)
8. 두 번째 콘텐츠 작성 → picker 에서 `성공` → `직장인` 다시 선택
9. 추천이 `team_invite` 가 아닌 `notification_rule` 계열 (학생/팀/프리랜서 카탈로그) 로 이동했는지 확인
10. 새로고침 → 위 7~9 의 모든 상태 복원, `sessionDismissedGuides` 만 빈 배열

→ 위 10단계가 모두 통과하면 현행 빌드의 핵심 흐름이 정상 동작하는 것으로 본다.

---

## 변경 이력

| 일자 | 변경 사항 |
|---|---|
| 2026-04-28 | 초안 작성. `dashboard-flow` 브랜치 현행 코드 기준 |
