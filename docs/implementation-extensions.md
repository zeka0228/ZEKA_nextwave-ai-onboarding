# 구현 변경/추가 사항 (implementation-plan.md 대비)

`implementation-plan.md` 를 기준으로, 실제 구현 시 plan에 명시되지 않았거나 변경한 항목을 모은 문서. 추후 plan과의 정합성을 다시 검토할 때 참조.

각 항목은 **위치 / plan 원안 / 실제 구현 / 이유** 순으로 기록한다.

---

## 1. Domain types

### 1.1 `ClassificationInput`, `LlmClassificationResult` 타입 추가
- 위치: `src/domain/types.ts`
- plan 원안: §3.1 타입 목록에 누락. §4 의 `ClassifierAdapter`, `resolveUserType` 가 이 타입들을 참조함.
- 실제 구현: §4.1 / §4.2 의 입출력 JSON 스키마를 그대로 인터페이스화하여 `types.ts` 에 추가.
- 이유: plan 보완. classifier adapter 인터페이스가 컴파일 가능하려면 이 타입이 선언돼 있어야 함.

---

## 2. Classification

### 2.1 mockClassifier 키워드 확장
- 위치: `src/services/classifiers/mockClassifier.ts`
- plan 원안: §4.4 "감지 키워드 예시" — user_type 별 6개 내외 제시 (대학생: 시험/과제/강의/교수님/학점/캡스톤 등).
- 실제 구현: plan 키워드 + 와이어프레임 시나리오(`회의 준비` + `팀원들과 공유할 내용 정리`) 매칭을 위해 다음 키워드 추가:
  - 직장인: `팀원`, `공유`, `미팅`
  - 대학생: `수업`, `발표`
  - 프리랜서: `계약`
  - 팀 사용자: `부서`
- 이유: plan 이 명시적으로 "예시"라고 표기했고, 와이어프레임 0.87 신뢰도 시나리오를 재현하기 위함.

### 2.2 `classifyContent` 반환 타입 변경
- 위치: `src/services/classifiers/classifyContent.ts`
- plan 원안 (§4 코드): `Promise<LlmClassificationResult>`
- 실제 구현: `Promise<LlmClassificationResult | null>` (어댑터 실패/예외 시 dispatcher 가 null 로 흡수)
- 이유: plan §4.7 "5초 초과 시 llmResult = null 로 간주하고 fallback 을 실행" 와 일관성. `resolveUserType` 가 `LlmClassificationResult | null` 을 직접 받도록 시그니처 정렬.

---

## 3. Recommendation

### 3.1 `selectRecommendation` fallback 가이드 검증 강화
- 위치: `src/domain/recommendation/selectRecommendation.ts`
- plan 원안 (§5.2 코드):
  ```ts
  const nextFeature = globalFeaturePriority.find(
    (featureKey) => params.usedFeatures[featureKey] === 0
  );
  if (!nextFeature) return null;
  return findGuideByFeature(params.userType, nextFeature);
  ```
- 실제 구현: `globalFeaturePriority` 를 순회하며, 미사용 feature 의 후보 가이드에 대해 다시 `canShowGuide` 검증 통과한 첫 번째 항목을 반환. 통과 못 하면 다음 feature 로 진행.
- 이유: plan 코드는 fallback 가이드의 dismiss 여부 검증 누락. dismissed 또는 already-used 인 가이드가 노출될 가능성 차단.
- 정상 시나리오에서는 결과 동일. 엣지 케이스 (fallback 도 dismissed 인 경우) 만 더 안전하게 처리.

---

## 4. Storage

### 4.1 영속 범위
- 위치: `src/services/storage.ts`
- plan 원안 §3: "사용자 상태, 콘텐츠, 추천 이력, 대시보드 이벤트는 localStorage 에 저장"
- 실제 구현: `PersistedAppState = { user, contents, guideImpressions, dashboard }` — `dashboard` 를 통째로 영속 (events 만 분리하지 않음).
- 이유: `dashboard.events` 만 저장하면 `metrics` 와 어긋남. CTA 로 변경된 metrics 가 새로고침 시 리셋되어 events 와 mismatch 가 생김. 데모 일관성 우선.

### 4.2 임시 상태 영속 제외
- 영속 제외: `ui`, `activeClassification`, `activeRecommendation`
- 이유: `ui` 는 모달 열림 같은 일회성 상태. `active*` 는 `classifications` + `selectRecommendation` 로 재계산 가능 → 저장 비용 무의미.

### 4.3 버전 키 prefix
- 키: `nextwave-ai-onboarding:v1`
- plan 원안: 명시 없음
- 이유: 스키마 변경 시 키만 `:v2` 로 올리면 자동 fresh start. 마이그레이션 코드 불필요.

---

## 5. UI / 상태

### 5.1 모달 토글 상태 위치
- 위치: `src/app/AppStateProvider.tsx` (`state.ui.isCreateModalOpen`)
- plan 원안 §3.2: `AppState.ui.isCreateModalOpen` 으로 전역 상태 정의
- 실제 구현: plan 따라 `AppStateProvider` 의 reducer 가 관리. ✅ **해소됨** (이전엔 임시로 `DashboardScreen` 내부 `useState` 로 보유했었음 → AppStateProvider 도입과 함께 정리)

---

## 6. Dashboard

### 6.1 mock 지표 초기값 (`initialDashboardMetrics`)
- 위치: `src/domain/dashboard/mockDashboardMetrics.ts`
- plan 원안: §6.3 "이번 주 데이터 헤더 04.20 - 04.26" 정도만 명시. 구체 수치는 명시 없음.
- 실제 구현: 와이어프레임 step 3 기반으로 결정.
  - `totalFocusMinutes`: 2325 (38h 45m)
  - `completionRate`: 75
  - `notificationAdoptionRate`: 10
  - `deliveryRate`: 92
  - `teamFeatureUsageRate`: 60 (와이어프레임 Key 범례 "협업 사용률 60% +15%" 항목)
- 이유: plan 미상세 부분을 와이어프레임에 맞춰 보완.

### 6.2 CTA 반영 delta 값 (`ctaDeltas`)
- 위치: `mockDashboardMetrics.ts`
- plan 원안: §6.2 "mock delta 표시" 라고만 명시. 구체 수치 없음.
- 실제 구현:
  - `team_invite`: `teamFeatureUsageRate` +15, `deliveryRate` +3
  - `notification_rule`: `notificationAdoptionRate` +20, `completionRate` +5
  - `note_share`: `deliveryRate` +5
- 이유: 데모에서 가시적 변화를 만들기 위해 한 자릿수 후반 ~ 중반 수치로 설정.

### 6.3 metric clamp [0, 100]
- 위치: `applyCtaToDashboard.ts` 의 `applyDeltas`
- plan 원안: 명시 없음
- 실제 구현: percentage 필드 (`completionRate`, `notificationAdoptionRate`, `deliveryRate`, `teamFeatureUsageRate`) 는 [0, 100] 으로 clamp. `totalFocusMinutes` 는 0 이상 유지.
- 이유: 반복 CTA 수락 시 100% 초과 방지. 데모 안정성.

### 6.4 seed `completedWorks` / `projectDriveItems`
- 위치: `mockDashboardMetrics.ts`
- plan 원안: 명시 없음
- 실제 구현: 와이어프레임 step 3 항목 중 **CTA 결과로 추가되는 항목 제외** 한 baseline 만 seed 로 포함.
  - `completedWorks`: 회의 (설계 검토) 04.25, 미팅 (디자인 회의) 04.26
  - `projectDriveItems`: 프로젝트개_계획_v0.3.pdf 04.24, 김개_프로젝트_레퍼런스 04.25
  - 와이어프레임의 "04.24 [팀 초대 완료]" 는 `team_invite` CTA 결과 → seed 제외.
- 이유: plan §6.2 "ContentList 에 [팀 초대 완료] 추가" 와의 중복 방지. CTA 반영 함수의 추가 동작 검증을 pre-CTA 상태에서 시작하도록.

### 6.5 정적 UI 와 도메인 seed 정합화
- 위치: `ContentList.tsx`, `ProjectDriveMock.tsx`, `StatsPanel.tsx`
- 실제 구현: ✅ **해소됨**. 위 컴포넌트들이 `useAppState()` 로 `state.dashboard` 를 직접 읽도록 전환됨. 정적 mock 배열 제거.
- 결과: 초기 화면은 seed (회의, 미팅 + 파일, 폴더 2개씩). CTA 수락 시 `[팀 초대 완료]` 등이 list 에 append 되며 wireframe step 3 모습으로 도달.

### 6.6 CTA 시 `DashboardEvent` 적재
- 위치: `applyCtaToDashboard.ts`
- plan 원안: §3.3 transition 의 `GUIDE_ACCEPTED` → "dashboard 이벤트/지표/목록 반영" 정도. 이벤트 형식 미명시.
- 실제 구현: 각 분기에서 `type: 'feature_used'` 이벤트를 `events` 에 append. 이벤트 title 형식 `[팀 초대] ${content.title}` 등.
- 이유: plan transition 명세를 구체화. 향후 활동 로그/감사 표시에 활용 가능.

---

## 7. Feature API (CTA mock)

### 7.1 응답 스키마 (`FeatureApiResult`)
- 위치: `src/services/mockFeatureApi.ts`
- plan 원안: §5.4 에 "초대 성공 mock 응답", "알림 규칙 생성 mock 응답", "공유 링크 생성 mock 응답" 정도만. 응답 형태 미명시.
- 실제 구현: 모든 feature 가 동일한 `FeatureApiResult { ok: true; featureKey; resourceId; createdAt }` 반환.
- 이유: CTA 후 `applyCtaToDashboard` 가 어차피 feature 별 분기를 가지고 있어, API 측에서는 "성공 + 시점" 정도만 알려주면 충분. 간결한 단일 형태.

### 7.2 항상 성공 (failure 시뮬레이션 없음)
- plan 원안: 실패 케이스 명시 없음
- 실제 구현: 모든 호출이 성공 응답 반환. 네트워크 오류, rate limit, validation 실패 등 시뮬레이션 안 함.
- 이유: 데모 흐름 안정성 우선. 추후 데모 시나리오 확장 시 실패 케이스 추가 가능.

### 7.3 인위적 지연 (250ms)
- plan 원안: 명시 없음
- 실제 구현: 모든 호출에 `ARTIFICIAL_DELAY_MS = 250` 만큼 지연.
- 이유: UI 가 로딩 상태 (버튼 disabled / 스피너) 를 잠깐이라도 표시하도록. 즉시 반환하면 사용자가 클릭→갱신 순간이 너무 매끄러워 변화를 인지하기 어려움. 실제 API 호출 느낌 유지.

### 7.4 명명된 메서드 + 디스패처 병행
- 위치: `mockFeatureApi.ts`
- 실제 구현: `mockFeatureApi.inviteTeamMember() / createNotificationRule() / createShareLink()` 명명된 API 와, `invokeMockFeature(featureKey)` 디스패처를 함께 export.
- 이유: plan §7.1 시나리오에서 `mockFeatureApi.inviteTeamMember` 형태로 참조됨 → 명명된 메서드 유지. 한편 action handler 는 `featureKey` 로 분기하는 게 자연스러우므로 디스패처도 제공.

---

## 8. AppStateProvider

### 8.1 데모 분석 지연 (`DEMO_ANALYSIS_DELAY_MS`)
- 위치: `src/app/AppStateProvider.tsx` (`submitContent` 내부)
- plan 원안 §4.7: "mock classifier 는 지연 없이 응답"
- 실제 구현: `Promise.all([classifyContent(...), delay(800)])` — 분석 자체는 즉시 끝나도 800ms 동안 "AI 분석 중" 상태 유지.
- 이유: mock classifier 가 즉시 반환하면 UI 상태 변화가 너무 빨라 "분석 중 → 결과" 전환을 사용자가 인지하지 못함. 와이어프레임 step 1 의 "AI 분석 중..." 상태를 데모에서 가시화하기 위한 표시용 지연. 실제 LLM adapter 로 교체 시 이 지연은 제거 예정.

### 8.2 `ANALYSIS_FAILED` action 추가
- 위치: `appReducer.ts`
- plan 원안 §3.3: `CREATE_CONTENT_SUBMIT → CLASSIFICATION_RESOLVED` 만 명시. 실패 transition 명시 없음 (fallback 으로 흡수되도록 설계).
- 실제 구현: dispatcher 가 throw 한 경우를 위해 별도 `ANALYSIS_FAILED` action 추가. `state.ui.analysisError` 에 메시지 저장.
- 이유: `classifyContent` 자체는 null 로 흡수하지만, 그 외 예외 (현재는 발생할 곳 없음) 가 새어 나올 가능성 대비. 안전망.

### 8.3 stateRef 패턴 (async stale closure 회피)
- 위치: `AppStateProvider.tsx`
- 실제 구현: `const stateRef = useRef(state)` + `useEffect` 로 매 렌더 동기화. async action 내부에서는 `stateRef.current` 로 최신 state 읽음.
- 이유: `useCallback` 클로저가 캡처한 `state` 는 호출 시점이 아닌 정의 시점의 값. 분류 await 후 `selectRecommendation` 에 넘길 `usedFeatures` 등이 stale 일 수 있음. ref 패턴으로 회피.
- 대안 검토: reducer 안에서 모든 derive 처리하는 방식도 있지만, async + 외부 호출이 reducer 에 들어가면 순수성 깨짐 → 현재 구조 유지.

### 8.4 CTA 와 content 연결 — last submitted
- 위치: `acceptCta` 내부
- plan 원안: 어떤 content 와 연결할지 명시 없음
- 실제 구현: `state.contents[length - 1]` (가장 최근 제출 content) 와 `applyCtaToDashboard` 호출.
- 이유: 분류 → 추천 → CTA 흐름은 동일 content 기반 (1 content → 1 분류 → 1 추천 → 1 CTA). 다른 content 가 끼어들면 새 분류가 활성 추천을 덮어쓰는 reducer 동작으로 자연 정리됨.
- 한계: 매우 빠른 연속 입력 (분류 도중 또 제출) 케이스는 현재 보호 장치 없음. 일반 데모 흐름에서는 문제 없음.

### 8.5 새로고침 시 추천/분류 리셋
- 위치: `loadInitialState`
- 실제 구현: persist 에서 user/contents/guideImpressions/dashboard 만 복원. `activeClassification`, `activeRecommendation`, `ui` 는 항상 초기 상태로 시작.
- 이유: plan §4.2 (storage 영속 제외 결정) 와 일관. 새로고침 후에는 사용자가 새 메모를 작성해야 추천이 다시 표시됨. 데모 시작점이 매번 깨끗.

### 8.6 데모 사용자 (`displayName`)
- 위치: `appReducer.ts` (`createInitialAppState`)
- plan 원안: 명시 없음
- 실제 구현: `userId: 'demo_user'`, `displayName: '김개발01'` 하드코딩.
- 이유: 와이어프레임 step 2 "🎉 김개발01님, 환영합니다!" 와 일치시키기 위함. 로그인 / 사용자 식별 로직은 MVP 외 영역.

---

## 9. 향후 추가 예정 (미구현)

### 9.1 임시 수동 분류 picker
- 위치 (예정): `src/_debug/manualClassificationFlow.tsx`
- 목적: 실제 LLM 분류 어댑터가 연결되기 전, 데모 시점에 `runClassification` 결과를 수동으로 결정하기 위한 임시 도구.
- 동작:
  - 메모 제출 후 모달로 **성공 / 실패1 / 실패2** 선택.
  - **성공** → UserType 4개 중 1개 직접 선택 → `source: 'mock_classifier'`
  - **실패1** → "사용이력 성공 / 실패2" 다시 선택
    - 사용이력 성공 → UserType 직접 선택 → `source: 'history_fallback'`
    - 실패2 → `'개인 사용자'` + `source: 'default_fallback'`
  - **실패2** → 즉시 `'개인 사용자'` + `source: 'default_fallback'`
- 제거 비용: 폴더 삭제 + import 1줄 변경 (자동 분류 flow 로 복귀).
- 진행 시점: 실제 분류 + 추천 + CTA + 대시보드 반영 + AppStateProvider 까지 완료 후.

---

## 메모

- 이 문서는 plan 과 코드 사이의 차이를 추적하는 용도. plan 자체를 갱신할 때는 이 문서의 항목을 plan 본문에 반영하고 여기서는 제거.
- 변경 사유가 plan 의 모호함/누락 보완인지, 의도적 강화인지, 임시 우회인지 구분해서 적는다.
