# NextWave 현행 빌드 QA 시나리오 (필수 MVP)

## 0. 문서 개요

본 문서는 **현재 레포 (`dashboard-flow` 브랜치) 에 실제 구현된 코드** 만을 대상으로 하는 수동 QA 시나리오이다.
스펙 (`기능명세서_v0.4_revised.md`) 전체 범위 검증은 `qa-scenarios.md` 를 참조한다.

### 0.1 현행 빌드 상태 요약

| 항목 | 상태 | 비고 |
|---|---|---|
| Dashboard 단일 화면 | ✅ 구현 | `DashboardScreen` |
| 콘텐츠 작성 모달 | ✅ 구현 | 메모/일정 탭 (날짜 필드 없음) |
| 분류 흐름 | ✅ **자동 LLM 분류** | `llmClassifierAdapter` (Ollama `gemma4:e4b`, native `/api/chat` + `think:false`). manual picker 제거됨. `VITE_USE_MOCK_CLASSIFIER=true` 로 mock fallback 가능 |
| AI 분석 상태 표시 | ✅ 구현 | LLM latency 자체로 가시화 (`DEMO_ANALYSIS_DELAY_MS` 제거됨) |
| 분류 결과 표시 | ✅ 구현 | `ClassificationBadge`, `AnalysisReasonPanel` |
| 추천 카드 | ✅ 구현 | `RecommendationCard` |
| 사용 이력 결합 우선순위 | ✅ 구현 | `selectRecommendation` |
| CTA → mock API → 대시보드 반영 | ✅ 구현 | 3종 feature 모두 |
| 나중에 / 다시 보지 않기 | ✅ 구현 | session vs 영속 분리 |
| localStorage 영속 | ✅ 구현 | 키: `nextwave-ai-onboarding:v1` |
| 영속 초기화 (resetState) | ⚠️ 코드만 보존 | `actions.resetState()` 함수는 보존되지만 manual picker 제거와 함께 UI 트리거가 사라짐. DevTools 콘솔 또는 향후 디버그 도구에서 호출 |

### 0.2 현행 미구현 (검증 대상 제외)

- **일정 탭 날짜 입력**: `ContentForm` 에 date 필드 없음. 일정 탭과 메모 탭의 입력 필드가 동일.
- **30초 미반응 반투명 처리**.
- **누적 재분류** (3개 누적 시점 전체 재분석).
- **로그인 / 튜토리얼 화면**.
- **입력 길이 검증** (제목 100자 / 내용 2000자 한계).
- **제목만으로 작성 가능** (스펙은 내용 선택, 현행은 **제목·내용 모두 필수**).

LLM 분류 자동화 (`qa-scenarios.md` §C-3, §H 의 timeout/JSON 실패/unknown fallback 등) 는 현행 구현됨 — 자동 측정은 `npm run eval:classifier` 로 가능 (Vitest 가 아닌 standalone 러너). 정확도 100% / latency p95 510ms 측정값 (gemma4:e4b 기준).

### 0.3 환경 준비

- 개발 서버: `npm run dev` → `http://localhost:5173/`
- 시작 전 DevTools → Application → Local Storage → `nextwave-ai-onboarding:v1` 키 삭제 후 새로고침 (manual picker 의 영속 초기화 버튼은 picker 제거와 함께 사라짐)
- DevTools 콘솔에서 `useAppState().actions.resetState()` 도 호출 가능 (디버그용)
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
  - LLM (`gemma4:e4b`) 응답 후 (~500ms, cold start 시 ~1s) 분류 결과 + 추천 카드로 전환

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

- **When**: A-2 직후, LLM 응답 대기 중 (~500ms, cold start 시 ~1s)
- **Then**: `RecommendationCard` 가 "방금 작성하신 내용을 분석하고 있어요. 잠시만 기다려주세요." 로 표시되고 `AnalysisStatus state="analyzing"` 노출

### B-2. 분석 완료 표시

- **When**: LLM 응답 도착 후 `CLASSIFICATION_RESOLVED` 액션 처리 완료
- **Then**: 카드가 `AnalysisStatus state="done"` + 분류 결과 + 추천 가이드 영역으로 전환

---

## C. 자동 LLM 분류 (`llmClassifierAdapter`)

> 현행 빌드는 LLM 자동 분류로 동작 (`VITE_USE_MOCK_CLASSIFIER=true` 시 mock 분기). 정확도 자동 측정은 `qa-scenarios.md` §C-3 의 12 케이스를 fixture 화한 `npm run eval:classifier -- --qa` 로 가능. 수동 QA 는 다음 분기를 dev 환경에서 확인.

### C-1. 명확한 입력 → user_type 직접 분류

- **When**: 메모 제목 `Q3 매출 보고서 회의`, 내용 `팀장님께 공유` 입력 → `생성 완료`
- **Then**:
  - LLM 응답 ~500ms 안에 도착
  - `ClassificationBadge` 가 `사용자 유형: 직장인 (신뢰도 0.85~0.95)` 표시
  - `AnalysisReasonPanel` reasoning 영역은 fallback 텍스트 (LLM 출력 schema 가 reasoning 을 받지 않음 — `implementation-extensions.md` §10.1)
  - `AnalysisReasonPanel` 키워드 칩은 빈 영역 (mock 분기에서만 키워드 채움)
  - `RecommendationCard` 에 §D-1 매핑대로 `workmate_team_invite` 노출

### C-2. 모호한 입력 → unknown → history fallback

- **Given**: 이전 작성에서 confidence ≥ 0.75 인 분류 이력이 1개 이상 존재
- **When**: 새 콘텐츠 `회의 준비` (내용 비움) 입력 → `생성 완료`
- **Then**:
  - LLM 이 `user_type: 'unknown'` 또는 confidence < 0.75 응답
  - `resolveUserType` 가 history fallback 실행 → `Classification.source: 'history_fallback'`
  - 추천 카드는 history user_type 의 §D-1 매핑대로 노출

### C-3. 모호한 입력 → 이력 없음 → default fallback

- **Given**: localStorage 비움 (이력 0건)
- **When**: 첫 콘텐츠로 `책 독서 메모` / `행동 경제학 3장` 입력
- **Then**:
  - LLM 이 `unknown` 응답 (현행 프롬프트의 함정 키워드 차단으로 '~학' 단독은 unknown 유도)
  - history 0건 → `Classification.source: 'default_fallback'`, `userType: '개인 사용자'`
  - 추천: `personal_note_share`

### C-4. LLM 호출 실패 (Ollama 미가동) → fallback

- **Given**: Ollama 종료 (또는 dev 환경의 vite proxy 차단)
- **When**: 새 콘텐츠 작성
- **Then**:
  - 어댑터의 fetch 가 실패 → `classifyContent` dispatcher 가 catch → `null` 반환
  - history 있으면 history fallback, 없으면 default fallback
  - UI 측 에러 강조 없음 (plan §7.2)

### C-5. 정확도 자동 측정

- **When**: `npm run eval:classifier -- --qa --out eval-result.json`
- **Then**: QA §C-3 12 케이스에서 정확도 100% (12/12) — gemma4:e4b 측정값. p95 latency 793ms

---

## D. 추천 카드 표시 (`RecommendationCard` + `selectRecommendation`)

### D-1. user_type별 1순위 가이드

C-1 또는 C-2 의 user_type 분류 결과별로 다음 가이드가 노출되는지 확인 (`guideCatalog.ts`).

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

- **Given**: resetState → 직장인 메모 분류 → CTA 수락 (`팀원 초대하기`) → `usedFeatures.team_invite = 1`
- **When**: 새 직장인 메모 작성 → 분류 결과 다시 직장인
- **Then**: `team_invite` 추천이 노출되지 않고 `student_notification_rule` (또는 `notification_rule` featureKey 를 가진 다른 카탈로그 가이드 중 catalog 순서상 먼저 매칭되는 것) 로 fallback

### E-2. 개인 사용자 fallback 의 cross-userType 동작

- **Given**: resetState → 첫 작성에서 모호한 메모로 default fallback (개인 사용자)
- **Then**: 추천이 `personal_note_share` (note_share) 가 1순위지만 `team_invite` 가 globalFeaturePriority 에서 우선
  - `globalFeaturePriority` = `team_invite → notification_rule → note_share`
  - 결과: `workmate_team_invite` (직장인 카탈로그) cross-userType fallback 으로 노출
- **검증 포인트**: 카드 title 이 `동료와 함께하면 더 편해요`, CTA 가 `팀원 초대하기` 인지 확인

### E-3. 모든 feature 사용 완료 시 추천 종료

- **Given**: 3종 feature 모두 CTA 수락 완료 (`team_invite`, `notification_rule`, `note_share` 가 1 이상)
- **When**: 새 콘텐츠 작성 + 분류 완료
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

### G-4. 무한 루프 회귀 방지 (`implementation-extensions.md` §3.1)

- **Given**: resetState → 직장인 메모 분류 → 추천 노출
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

### H-3. resetState (코드 레벨만)

- **Given**: 임의 진행 상태
- **When**: DevTools 콘솔에서 `useAppState` 훅을 통해 `actions.resetState()` 호출 (manual picker 의 UI 트리거는 picker 제거와 함께 사라짐)
  - 또는 DevTools → Application → Local Storage 에서 `nextwave-ai-onboarding:v1` 키 삭제 후 새로고침
- **Then**:
  - localStorage 에서 키 삭제
  - 새로고침 없이 즉시 초기 상태로 복귀 (코드 호출 시) / 새로고침 후 초기 상태 (수동 삭제 시)
  - 새 작성 흐름이 정상 동작

---

## K. 엔드투엔드 골든 패스 (현행 빌드 기준)

**시나리오**: 신규 사용자 → 직장인 메모 → 자동 LLM 분류 → CTA 수락 → 다음 추천 → 새로고침

1. localStorage `nextwave-ai-onboarding:v1` 키 삭제 → 새로고침 → 깨끗한 상태 진입
2. `새로 만들기` → 기본값 그대로 `생성 완료`
3. 분석 중 카피 ~500ms 노출 후 (cold start 시 ~1s) LLM 분류 결과 도착
4. `RecommendationCard` 에 분류 결과 (`직장인`, 신뢰도 0.85~0.95) + 추천 `동료와 함께하면 더 편해요` 표시
5. `팀원 초대하기` 클릭
6. `완료 작업` 에 `팀 초대 완료` 항목 추가, `StatsPanel` 수치 변화, `usedFeatures.team_invite=1` (DevTools)
7. 두 번째 직장인 메모 작성 → 자동 분류
8. 추천이 `team_invite` 가 아닌 `notification_rule` 계열 (학생/팀/프리랜서 카탈로그) 로 이동했는지 확인
9. 새로고침 → 위 6~8 의 모든 상태 복원, `sessionDismissedGuides` 만 빈 배열

> **사전 조건**: Ollama 가 실행 중이고 `gemma4:e4b` 모델이 받아져 있어야 함. 미가동 시 `.env` 에 `VITE_USE_MOCK_CLASSIFIER=true` 추가 후 dev 재시작하면 mock 분류로 진행 가능 (단, 분류 결과는 mockClassifier 의 키워드 매칭 기준).

→ 위 9단계가 모두 통과하면 현행 빌드의 핵심 흐름이 정상 동작하는 것으로 본다.

---

## 변경 이력

| 일자 | 변경 사항 |
|---|---|
| 2026-04-28 | 초안 작성. `dashboard-flow` 브랜치 현행 코드 기준 |
| 2026-04-29 | LLM 자동 분류 적용 반영 — manual picker 시나리오 (§B/§C/§H/§K) 를 자동 분류 기반으로 교체. resetState 는 코드만 보존 (UI 트리거 제거) |
