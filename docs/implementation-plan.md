# NextWave AI 온보딩 시스템 구현 계획

## 1. 구현 목표

본 구현의 핵심 흐름은 다음과 같다.

```text
메모/일정 작성
  -> AI 분석
  -> user_type 분류
  -> 추천 카드 노출
  -> CTA 실행
  -> 대시보드 지표 및 활동 내역 반영
```

구현 범위는 기능명세서 v0.4-revised의 A 범위를 우선한다.

- 실구현: Dashboard 단일 화면, 작성 모달, mock classifier 기반 user_type 분류, 추천 카드, CTA mock 처리, 대시보드 반영
- mock 구현: 팀 초대/알림/공유 API 호출, 데모용 대시보드 지표
- 문서 범위: 장기 피드백 분석, A/B 테스트, 복잡한 재추천 엔진

MVP는 별도 작성 화면이나 별도 추천 화면을 두지 않는다. 와이어프레임의 3단계 흐름을 `DashboardScreen` 안에서 처리한다.

```text
DashboardScreen
  -> ContentCreateModal 열기
  -> 메모/일정 작성
  -> mock classifier 분석
  -> Dashboard 상단 RecommendationCard 갱신
  -> CTA 실행
  -> StatsPanel / ContentList / ProjectDriveMock 갱신
```

대시보드 수치는 데모용 mock 지표로 명시한다. 실제 개선 수치 또는 운영 성과처럼 보이지 않게 UI에도 `데모 지표` 또는 `Mock data` 라벨을 표시한다.

## 2. 컴포넌트 구조

권장 스택은 React + TypeScript 기준이다. 아직 앱 소스가 없으므로 신규 프로젝트를 생성하는 전제로 작성한다.

```text
src/
  app/
    App.tsx
    providers/
      AppStateProvider.tsx
  screens/
    DashboardScreen.tsx
  components/
    layout/
      AppShell.tsx
      TopBar.tsx
    content/
      ContentCreateModal.tsx
      ContentTypeTabs.tsx
      ContentForm.tsx
      ContentList.tsx
      ContentCard.tsx
    ai/
      AnalysisStatus.tsx
      ClassificationBadge.tsx
      AnalysisReasonPanel.tsx
    guide/
      RecommendationCard.tsx
      GuideActions.tsx
    dashboard/
      StatsPanel.tsx
      StatCard.tsx
      ProjectDriveMock.tsx
  domain/
    types.ts
    classification/
      classifyContent.ts
      classificationPrompt.ts
      resolveUserType.ts
    recommendation/
      guideCatalog.ts
      selectRecommendation.ts
    dashboard/
      applyCtaToDashboard.ts
      mockDashboardMetrics.ts
  services/
    classifiers/
      classifyContent.ts
      mockClassifier.ts
      llmClassifierAdapter.ts
    mockFeatureApi.ts
    storage.ts
  tests/
    classification.test.ts
    recommendation.test.ts
```

### 2.1 화면 컴포넌트 책임

| 컴포넌트 | 책임 |
|---|---|
| `DashboardScreen` | MVP의 단일 화면. 추천 카드, 작성 모달, 지표, 콘텐츠 목록, Project Drive mock을 포함 |
| `ContentCreateModal` | Dashboard 위에서 열리는 메모/일정 작성 모달. 저장 시 분류 트리거 |
| `RecommendationCard` | Dashboard 상단에 표시되는 추천 카드. 분석 결과와 CTA를 함께 표시 |
| `StatsPanel` | 데모용 mock 지표 표시 |
| `ContentList` | 작성된 메모/일정 목록 표시 |
| `ProjectDriveMock` | CTA 결과로 생성/공유된 문서 mock 표시 |

### 2.2 핵심 UI 컴포넌트

| 컴포넌트 | 책임 |
|---|---|
| `ContentCreateModal` | 메모/일정 작성, 제출, 분석 중 상태 표시 |
| `ContentTypeTabs` | `memo` / `schedule` 전환 |
| `ContentForm` | 제목, 내용, 일정 날짜 입력 및 validation |
| `AnalysisStatus` | 모달 또는 추천 카드 내부의 "AI 분석 중..." 상태 표시 |
| `ClassificationBadge` | `사용자 유형: 직장인 (신뢰도 0.87)` 표시 |
| `AnalysisReasonPanel` | AI 분석 근거, 감지 키워드, 분석 포인트 표시 |
| `RecommendationCard` | user_type과 사용 이력 기반 추천 카드 표시 |
| `GuideActions` | CTA, 나중에, 다시 보지 않기 액션 처리 |
| `StatsPanel` | 총 투입 시간, 완료율, 알림 인가율, 전송률 등 데모 지표 표시 |
| `ContentList` | 생성 콘텐츠와 CTA 이후 완료 내역 표시 |
| `ProjectDriveMock` | 공유된 문서/폴더 mock 내역 표시 |

## 3. 상태 모델

상태는 프로토타입 단계에서 React state + localStorage를 함께 사용한다. 새로고침 후에도 흐름 확인이 가능해야 하므로 사용자 상태, 콘텐츠, 추천 이력, 대시보드 이벤트는 localStorage에 저장한다.

### 3.1 타입 정의

```typescript
export type ContentType = 'memo' | 'schedule';

export type UserType =
  | '대학생'
  | '직장인'
  | '프리랜서'
  | '팀 사용자'
  | '개인 사용자';

export type LlmUserType = Exclude<UserType, '개인 사용자'> | 'unknown';

export type FeatureKey =
  | 'team_invite'
  | 'notification_rule'
  | 'note_share';

export interface UserState {
  userId: string;
  displayName: string;
  userType: UserType | null;
  classifications: Classification[];
  dismissedGuides: string[];
  sessionDismissedGuides: string[];
  usedFeatures: FeatureFlags;
}

export interface FeatureFlags {
  team_invite: number;
  notification_rule: number;
  note_share: number;
}

export interface Content {
  id: string;
  type: ContentType;
  title: string;
  body: string;
  date?: string;
  createdAt: number;
}

export interface Classification {
  contentId: string;
  userType: UserType;
  rawUserType: LlmUserType;
  confidence: number;
  reasoning?: string;
  keywords: string[];
  source: 'mock_classifier' | 'llm_adapter' | 'history_fallback' | 'default_fallback';
  createdAt: number;
}

export interface Recommendation {
  guideId: string;
  userType: UserType;
  featureKey: FeatureKey;
  title: string;
  description: string;
  cta: string;
  reason: string;
}

export interface GuideImpression {
  guideId: string;
  contentId?: string;
  shownAt: number;
  outcome: 'accepted' | 'dismissed' | 'hidden' | 'pending';
}

export interface DashboardState {
  weekRangeLabel: string;
  metrics: DashboardMetrics;
  completedWorks: CompletedWork[];
  projectDriveItems: ProjectDriveItem[];
  memberUsage: MemberUsage[];
  events: DashboardEvent[];
}

export interface DashboardMetrics {
  sourceLabel: 'demo_mock';
  totalFocusMinutes: number;
  completionRate: number;
  notificationAdoptionRate: number;
  deliveryRate: number;
  teamFeatureUsageRate: number;
}

export interface CompletedWork {
  id: string;
  label: string;
  kind: 'task' | 'meeting' | 'notification' | 'team_invite';
  createdAt: number;
}

export interface ProjectDriveItem {
  id: string;
  name: string;
  kind: 'file' | 'folder' | 'shared_link';
  createdAt: number;
}

export interface MemberUsage {
  memberId: string;
  name: string;
  focusMinutes: number;
}

export interface DashboardEvent {
  id: string;
  type: 'content_created' | 'classification_done' | 'guide_accepted' | 'feature_used';
  featureKey?: FeatureKey;
  contentId?: string;
  title: string;
  createdAt: number;
}
```

### 3.2 전역 상태 구조

```typescript
export interface AppState {
  user: UserState;
  contents: Content[];
  activeClassification: Classification | null;
  activeRecommendation: Recommendation | null;
  guideImpressions: GuideImpression[];
  dashboard: DashboardState;
  ui: {
    isCreateModalOpen: boolean;
    isAnalyzing: boolean;
    analysisError?: string;
  };
}
```

### 3.3 상태 전이

```text
DASHBOARD_INIT
  -> mock user 생성 또는 localStorage 복원
  -> demo dashboard metrics 로드

OPEN_CREATE_MODAL
  -> isCreateModalOpen=true

CREATE_CONTENT_SUBMIT
  -> content 저장
  -> isAnalyzing=true
  -> classifyContent 호출

CLASSIFICATION_RESOLVED
  -> classifications에 추가
  -> user.userType 갱신
  -> activeRecommendation 생성
  -> guideImpressions pending 추가
  -> isCreateModalOpen=false
  -> Dashboard 상단 RecommendationCard 갱신

GUIDE_ACCEPTED
  -> usedFeatures 증가
  -> guideImpressions outcome=accepted
  -> dashboard 이벤트/지표/목록 반영
  -> Dashboard 현재 화면 유지

GUIDE_DISMISSED
  -> sessionDismissedGuides 추가
  -> activeRecommendation 제거

GUIDE_NEVER_SHOW
  -> dismissedGuides 추가
  -> activeRecommendation 제거
```

## 4. 분류 로직

분류 로직은 `classifyContent -> classifier adapter -> resolveUserType -> saveClassification` 순서로 동작한다.

초기 MVP에서는 실제 LLM을 호출하지 않고 `mockClassifier`로 전체 사용자 흐름을 먼저 완성한다. 이후 실제 API 또는 Gemma 연동은 동일한 `ClassifierAdapter` 인터페이스 뒤에 붙인다.

```typescript
export interface ClassifierAdapter {
  classify(input: ClassificationInput): Promise<LlmClassificationResult>;
}

export async function classifyContent(
  input: ClassificationInput,
  adapter: ClassifierAdapter = mockClassifier
) {
  return adapter.classify(input);
}
```

초기 adapter 구성은 다음과 같다.

| adapter | MVP 사용 여부 | 책임 |
|---|---:|---|
| `mockClassifier` | 사용 | 키워드 기반 mock 응답으로 전체 흐름 완성 |
| `llmClassifierAdapter` | 인터페이스만 준비 | 이후 `/api/classify`, Gemma, Ollama 등 실제 분류 API 연결 |

### 4.1 입력

```json
{
  "title": "회의 준비",
  "content": "팀원들과 공유할 내용 정리",
  "type": "memo"
}
```

### 4.2 출력

```json
{
  "user_type": "직장인",
  "confidence": 0.87,
  "reasoning": "회의와 팀원 공유 맥락이 업무 상황에 가깝습니다.",
  "keywords": ["회의", "팀원", "공유"]
}
```

> **현행 구현 주석 (2026-04-29)**
> LLM 응답 schema 는 latency 를 잡기 위해 `{user_type, confidence}` 두 필드만 받도록 축소됨. `reasoning` / `keywords` 는 adapter 가 빈 값으로 채워 호출자에게 같은 인터페이스를 제공한다. 변경 배경/측정값은 `implementation-extensions.md` §10.1 참조.

### 4.3 임계값

초기값은 `θ = 0.75`로 둔다. 명세서의 테스트셋 12개를 기준으로 정확도 80% 이상을 만족하도록 조정한다.

- `confidence >= θ`이고 `user_type !== 'unknown'`이면 LLM 결과 채택
- `confidence < θ`이면 사용 이력 fallback
- JSON 파싱 실패, 타임아웃, API 오류, 허용되지 않은 user_type도 fallback 처리

> **현행 구현 주석**: 임계값 0.75 그대로 유지. `gemma4:e4b` + 적용된 프롬프트 조합에서 QA §C-3 12건·전체 33건 모두 100% 통과 (`implementation-extensions.md` §10.5).

### 4.4 mock classifier 규칙

MVP의 `mockClassifier`는 데모 안정성을 위해 간단한 키워드 매칭으로 동작한다.

| user_type | 감지 키워드 예시 |
|---|---|
| 대학생 | 시험, 과제, 강의, 교수님, 학점, 캡스톤 |
| 직장인 | 회의, 보고, 팀장, 업무, 결재, 본사 |
| 프리랜서 | 클라이언트, 외주, 납품, 견적, 시안 |
| 팀 사용자 | 우리 팀, 공동, 협업, 스프린트, 개발팀 |
| unknown | 사적 메모 또는 매칭 불가 |

mock 응답도 실제 LLM 응답과 같은 형태를 반환한다. 이렇게 해야 이후 실제 LLM adapter로 교체할 때 UI와 추천 로직을 수정하지 않는다.

### 4.5 실제 LLM용 프롬프트 초안

프롬프트는 기능명세서 §4.2를 기준으로 하되, 구현에서는 JSON 안정성을 위해 `keywords` 필드를 추가한다.

```text
당신은 사용자의 생산성 도구 사용 맥락을 분석하는 분류기입니다.

사용자가 작성한 메모 또는 일정의 제목과 내용을 보고 다음 user_type 중 하나를 선택하세요.

[user_type]
- 대학생: 강의, 시험, 과제, 팀플, 동아리, 학점, 수업 등 학업 맥락
- 직장인: 회의, 보고, 미팅, 업무, 결재, 출장 등 조직 내 업무 맥락
- 프리랜서: 클라이언트, 프로젝트 납품, 견적, 외주, 개인 사업 맥락
- 팀 사용자: 우리 팀, 부서, 공동, 협업, 스프린트 등 복수 인원 협업 맥락
- unknown: 사적 메모이거나 맥락이 모호한 경우

[입력]
제목: {title}
내용: {content}
타입: {type}

[출력]
JSON으로만 답변하세요.
{
  "user_type": "대학생|직장인|프리랜서|팀 사용자|unknown",
  "confidence": 0.0,
  "reasoning": "판단 근거 한 문장",
  "keywords": ["감지 키워드"]
}
```

> **현행 구현 주석**: 위 초안에 두 블록이 추가되어 있음 — (1) unknown 트리거 4개 명시 (사적 영역 / 빈 내용 / 단서 충돌 / 단정 불가), (2) 클래스별 함정 키워드 negative criteria. 출력 schema 도 `{user_type, confidence}` 두 필드로 축소. 실제 사용 중인 프롬프트는 `src/domain/classification/classificationPrompt.ts`, 변경 배경은 `implementation-extensions.md` §10.1·§10.2 참조.

### 4.6 fallback 알고리즘

```typescript
const THETA = 0.75;

function resolveUserType(params: {
  llmResult: LlmClassificationResult | null;
  classifications: Classification[];
  classifierSource: 'mock_classifier' | 'llm_adapter';
}): Pick<Classification, 'userType' | 'source'> {
  const { llmResult, classifications, classifierSource } = params;

  if (
    llmResult &&
    llmResult.user_type !== 'unknown' &&
    llmResult.confidence >= THETA &&
    isAllowedLlmUserType(llmResult.user_type)
  ) {
    return {
      userType: llmResult.user_type,
      source: classifierSource,
    };
  }

  const confirmed = classifications.filter((item) => item.confidence >= THETA);

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
```

### 4.7 타임아웃 처리

- mock classifier는 지연 없이 응답하되, 실제 LLM adapter는 최대 5초만 기다린다.
- 5초 초과 시 `llmResult = null`로 간주하고 fallback을 실행한다.
- UI에는 "AI 분석이 지연되어 기본 추천을 준비했습니다." 정도의 짧은 안내만 표시한다.

> **현행 구현 주석**: timeout 정책 그대로. `gemma4:e4b` 측정에서 전체 33건 latency p95 510ms / max 744ms — 5초 budget 의 ~10% 사용. cold start 흡수를 위해 `.env` 의 `VITE_LLM_TIMEOUT_MS` 는 dev 환경 기본 30s 로 override. native API + `think:false` 의 효과는 `implementation-extensions.md` §10.3 참조.

### 4.8 테스트 기준

명세서 §4.5의 12개 테스트셋을 `classification.test.ts`로 작성한다.

- 쉬움 케이스는 기대 user_type과 일치해야 한다.
- 모호/사적 케이스는 `unknown` 또는 `개인 사용자 fallback`으로 처리되어야 한다.
- 전체 정확도 목표는 80% 이상이다.

> **현행 구현 주석**: Vitest 대신 standalone tsx 러너로 측정. `npm run eval:classifier -- --qa` 로 12 케이스, 인자 없이 33 케이스. 측정 결과·메트릭 정의는 `notes/classifier-eval.md` 참조 (notes/ 는 .gitignore). 최신 결과: QA §C-3 100% (12/12), 전체 33건 100% (33/33), Macro-F1 1.000.

## 5. 추천 로직

추천 로직은 `selectRecommendation(userType, usedFeatures, dismissedGuides)`에서 결정한다.

### 5.1 추천 카탈로그

```typescript
export const guideCatalog: Record<UserType, Recommendation[]> = {
  대학생: [
    {
      guideId: 'student_notification_rule',
      userType: '대학생',
      featureKey: 'notification_rule',
      title: '중요한 일정을 놓치지 않게 알림을 설정하세요',
      description: '시험, 과제 마감을 자동으로 리마인드 받을 수 있어요.',
      cta: '알림 설정하기',
      reason: '학업 일정과 마감 관리 맥락이 감지되었습니다.',
    },
  ],
  직장인: [
    {
      guideId: 'workmate_team_invite',
      userType: '직장인',
      featureKey: 'team_invite',
      title: '동료와 함께하면 더 편해요',
      description: '방금 만든 내용을 팀원에게 바로 공유할 수 있어요.',
      cta: '팀원 초대하기',
      reason: '회의, 업무, 공유 맥락이 감지되었습니다.',
    },
  ],
  프리랜서: [
    {
      guideId: 'freelancer_notification_rule',
      userType: '프리랜서',
      featureKey: 'notification_rule',
      title: '마감을 놓치지 않는 알림을 설정해보세요',
      description: '클라이언트 납품 일정을 자동으로 관리할 수 있어요.',
      cta: '알림 설정하기',
      reason: '클라이언트 또는 납품 일정 맥락이 감지되었습니다.',
    },
  ],
  '팀 사용자': [
    {
      guideId: 'team_notification_rule',
      userType: '팀 사용자',
      featureKey: 'notification_rule',
      title: '반복되는 알림을 자동화해 효율을 높이세요',
      description: '주간 회의, 정기 보고 알림을 자동 규칙으로 만들 수 있어요.',
      cta: '규칙 만들기',
      reason: '팀 협업과 반복 업무 맥락이 감지되었습니다.',
    },
  ],
  '개인 사용자': [
    {
      guideId: 'personal_note_share',
      userType: '개인 사용자',
      featureKey: 'note_share',
      title: '이 메모를 다른 사람과 공유할 수 있어요',
      description: '링크 하나로 팀원·지인에게 전달할 수 있어요.',
      cta: '메모 공유하기',
      reason: '명확한 업무 유형이 없어 기본 공유 기능을 추천합니다.',
    },
  ],
};
```

### 5.2 사용 이력 결합

1순위 추천 기능을 이미 사용한 경우 다음 미사용 핵심 기능으로 이동한다.

```typescript
const globalFeaturePriority: FeatureKey[] = [
  'team_invite',
  'notification_rule',
  'note_share',
];

function selectRecommendation(params: {
  userType: UserType;
  usedFeatures: FeatureFlags;
  dismissedGuides: string[];
  sessionDismissedGuides: string[];
}): Recommendation | null {
  const primary = guideCatalog[params.userType][0];

  if (canShowGuide(primary, params)) {
    return primary;
  }

  const nextFeature = globalFeaturePriority.find(
    (featureKey) => params.usedFeatures[featureKey] === 0
  );

  if (!nextFeature) {
    return null;
  }

  return findGuideByFeature(params.userType, nextFeature);
}
```

### 5.3 노출 제어

- 한 화면에는 추천 카드 1개만 표시한다.
- `나중에`를 누르면 해당 세션에서 다시 보이지 않는다.
- `다시 보지 않기`를 누르면 localStorage의 `dismissedGuides`에 저장한다.
- CTA를 수락하면 `usedFeatures[featureKey] += 1`을 적용하고 대시보드에 즉시 반영한다.
- 이미 사용한 기능의 추천은 다음 미사용 기능 추천으로 대체한다.

### 5.4 CTA 처리

| featureKey | CTA | mock 동작 | 대시보드 반영 |
|---|---|---|---|
| `team_invite` | 팀원 초대하기 | 초대 성공 mock 응답 | 팀 기능 사용률 증가, 완료 작업에 `[팀 초대 완료]` 추가 |
| `notification_rule` | 알림 설정하기 / 규칙 만들기 | 알림 규칙 생성 mock 응답 | 알림 인가율 증가, 완료 작업에 `[알림 규칙 생성]` 추가 |
| `note_share` | 메모 공유하기 | 공유 링크 생성 mock 응답 | 전송률 증가, Project Drive에 공유 문서 추가 |

## 6. 대시보드 반영 로직

대시보드는 CTA의 결과를 사용자에게 보여주는 증거 화면이다. 추천 카드에서 행동을 수락하면 단순 이동이 아니라 지표와 활동 내역이 갱신되어야 한다.

### 6.1 반영 함수

```typescript
function applyCtaToDashboard(params: {
  dashboard: DashboardState;
  recommendation: Recommendation;
  content: Content;
  now: number;
}): DashboardState {
  switch (params.recommendation.featureKey) {
    case 'team_invite':
      return applyTeamInvite(params);
    case 'notification_rule':
      return applyNotificationRule(params);
    case 'note_share':
      return applyNoteShare(params);
  }
}
```

### 6.2 feature별 반영 규칙

| 기능 | 데모 지표 표시 변경 | 리스트 업데이트 |
|---|---|---|
| 팀 초대 | `teamFeatureUsageRate`, `deliveryRate`에 mock delta 표시 | ContentList에 `[팀 초대 완료]` 추가 |
| 알림 자동화 | `notificationAdoptionRate`, `completionRate`에 mock delta 표시 | ContentList에 `[알림 규칙 생성]` 추가 |
| 메모 공유 | `deliveryRate`에 mock delta 표시 | ProjectDriveMock에 공유 링크 또는 문서 추가 |

수치는 프로토타입 데모용 mock 값이다. 실제 개선 수치나 운영 성과가 아니며, UI에서도 `데모 지표` 또는 `Mock data` 라벨을 함께 표시한다. 실서비스에서는 실제 이벤트 집계 기반으로 별도 계산한다.

### 6.3 대시보드 구성

와이어프레임을 기준으로 다음 영역을 구현한다.

- 이번 주 데이터 헤더: `04.20 - 04.26` 형태
- `StatsPanel`: 총 투입 시간, 완료율, 알림 인가율, 전송률 등 데모용 mock 지표
- `ContentList`: 생성 콘텐츠와 CTA 수락 결과 표시
- `ProjectDriveMock`: 공유된 문서, 생성된 폴더, 관련 파일 mock 표시
- Key: 신뢰도, AI 분석 포인트, 주요 지표 범례

## 7. 엔드투엔드 흐름

### 7.1 메모 작성 성공 시나리오

1. 사용자가 `DashboardScreen`에서 `ContentCreateModal`을 열고 메모를 작성한다.
2. `CREATE_CONTENT_SUBMIT` 액션으로 콘텐츠를 저장한다.
3. `classifyContent`가 초기 MVP에서는 `mockClassifier`를 호출한다.
4. `resolveUserType`이 `직장인`, confidence `0.87`을 채택한다.
5. `selectRecommendation`이 `team_invite` 추천을 선택한다.
6. `DashboardScreen` 상단의 `RecommendationCard`가 갱신된다.
7. 사용자가 `팀원 초대하기` CTA를 누른다.
8. `mockFeatureApi.inviteTeamMember`가 성공 응답을 반환한다.
9. `usedFeatures.team_invite`가 1 증가한다.
10. `applyCtaToDashboard`가 데모 지표와 활동 목록을 갱신한다.
11. 같은 `DashboardScreen`에서 `StatsPanel`, `ContentList`, `ProjectDriveMock` 반영 결과를 보여준다.

### 7.2 AI 실패 시나리오

1. 실제 LLM adapter 사용 시 분류 API가 5초 안에 응답하지 않는다.
2. 기존 classification 이력이 있으면 최빈 user_type을 사용한다.
3. 이력도 없으면 `개인 사용자`로 fallback한다.
4. 추천은 `team_invite -> notification_rule -> note_share` 우선순위에서 미사용 기능을 선택한다.
5. UI는 실패를 크게 강조하지 않고 기본 추천으로 진행한다.

## 8. 구현 단계

### 1단계: 프로젝트 기반 구성

- React + TypeScript 앱 생성
- 라우팅 최소화: `App -> DashboardScreen` 단일 진입 구성
- `domain/types.ts` 작성
- localStorage 기반 `storage.ts` 작성
- mock 초기 대시보드 데이터 작성

완료 기준:
- 앱 진입 시 Dashboard가 바로 표시됨
- Dashboard에서 작성 모달을 열고 닫을 수 있음
- 새로고침 후 사용자 상태 복원 가능

### 2단계: Dashboard + 작성 모달

- `DashboardScreen`, `ContentCreateModal`, `ContentTypeTabs`, `ContentForm` 구현
- `StatsPanel`, `ContentList`, `ProjectDriveMock` 기본 mock 표시
- 제목/내용/날짜 validation 구현
- 콘텐츠 저장 액션 구현
- `AnalysisStatus` 로딩 UI 구현

완료 기준:
- 제목이 없으면 생성 불가
- 일정 탭에서는 날짜 없으면 생성 불가
- 생성 후 모달 안에서 AI 분석 상태로 진입

### 3단계: AI 분류 모듈

- `classificationPrompt.ts` 작성
- `ClassifierAdapter` 인터페이스 작성
- `mockClassifier.ts`를 먼저 구현하여 전체 흐름 완성
- `llmClassifierAdapter.ts`는 실제 API/Gemma 연동을 붙일 수 있는 구조만 준비
- 실제 LLM 연동 지점은 `classifyContent` 인터페이스 뒤에 숨김
- 5초 타임아웃, JSON validation, fallback 구현

완료 기준:
- 테스트셋 12개 기준 기대 분류 검증 가능
- 실패/저신뢰도/unknown에서 fallback 정상 동작

### 4단계: 추천 카드

- `guideCatalog.ts` 작성
- `selectRecommendation.ts` 구현
- `DashboardScreen` 상단에 `RecommendationCard`, `GuideActions` 구현
- 나중에/다시 보지 않기/CTA 수락 상태 처리

완료 기준:
- user_type별 추천 카드가 다르게 표시됨
- 이미 사용한 기능은 다시 추천하지 않음
- dismissed guide는 노출되지 않음

### 5단계: CTA mock API 및 대시보드 반영

- `mockFeatureApi.ts` 작성
- `applyCtaToDashboard.ts` 구현
- CTA 수락 시 `StatsPanel`, `ContentList`, `ProjectDriveMock` 업데이트
- 화면에 `데모 지표` 또는 `Mock data` 라벨 표시

완료 기준:
- 클릭한 CTA의 결과가 화면에 반영됨
- `usedFeatures`가 증가하여 다음 추천에 영향을 줌
- 표시 수치가 실제 성과가 아닌 데모 mock 값임을 화면에서 구분할 수 있음

### 6단계: 통합 테스트 및 데모 정리

- classification, recommendation 단위 테스트 작성
- dashboard 테스트는 기능 안정화 후 추가
- 주요 사용자 흐름 수동 QA
- 로딩/타임아웃/빈 상태/반복 CTA 케이스 확인
- 발표용 seed data 정리

완료 기준:
- `메모 작성 -> AI 분석 -> 추천 -> CTA -> 대시보드` 흐름이 끊기지 않음
- 네트워크 실패 또는 LLM 실패 상황에서도 데모가 진행됨
- `StatsPanel`과 활동 내역이 추천 행동의 결과를 설명함

## 9. 우선순위

| 우선순위 | 작업 | 이유 |
|---|---|---|
| P0 | Dashboard, 작성 모달, mock 분류, 추천, CTA 반영 | 목표 흐름의 핵심 |
| P1 | localStorage 복원 | 데모 안정성 |
| P2 | 실제 LLM/Gemma adapter 연결 | mock classifier 이후 확장 |
| P2 | 누적 재분류 | 정확도 개선용 선택 기능 |
| P2 | 로그인/튜토리얼 mock | MVP 이후 전체 서비스 흐름 보강 |
| P3 | 피드백 분석, A/B 테스트 | 운영 단계 기능 |

## 10. 리스크 및 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| LLM 응답 지연 | 추천 카드 표시 지연 | 5초 타임아웃 후 fallback |
| JSON 파싱 실패 | 분류 실패 | schema validation 후 history/default fallback |
| user_type 오분류 | 부적절한 추천 | confidence 임계값, 테스트셋 튜닝 |
| 추천 반복 노출 | 사용자 피로 | 세션 dismiss, 영구 dismiss 적용 |
| CTA 결과가 약함 | 대시보드 설득력 저하 | 지표와 완료 내역을 함께 갱신 |

## 11. MVP 완료 정의

다음 조건을 만족하면 MVP 구현 완료로 본다.

- 사용자가 메모 또는 일정을 작성할 수 있다.
- 작성 완료 직후 AI 분석 상태가 표시된다.
- 분석 결과로 `user_type`과 confidence가 표시된다.
- user_type과 사용 이력을 결합한 추천 카드가 표시된다.
- CTA 클릭 시 mock 기능이 실행된다.
- 대시보드에 CTA 결과가 지표와 활동 내역으로 반영된다.
- LLM 실패, unknown, 저신뢰도에서도 fallback 추천이 작동한다.
