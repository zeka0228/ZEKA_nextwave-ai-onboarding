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

### 5.1 모달 토글 상태 위치 (임시)
- 위치: `src/screens/DashboardScreen.tsx`
- plan 원안 §3.2: `AppState.ui.isCreateModalOpen` 으로 전역 상태 정의
- 실제 구현: 현재는 `DashboardScreen` 내부 `useState` 로 임시 보유.
- 이유: `AppStateProvider` 도입 전 단계. 전역 상태 컨텍스트 만들 시점에 `AppState.ui` 로 이전 예정.

---

## 6. 향후 추가 예정 (미구현)

### 6.1 임시 수동 분류 picker
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
