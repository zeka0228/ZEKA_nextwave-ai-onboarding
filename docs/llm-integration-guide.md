# LLM 연동 가이드

실제 LLM 분류기가 준비되었을 때, 임시 수동 picker 를 제거하고 자동 분류 flow 로 전환하는 절차.

## 사전 점검

연결 직전 결정되어 있어야 할 것:
- [ ] LLM 종류 (OpenAI / Anthropic / Gemma 로컬 / Ollama 등)
- [ ] 호출 방식 (직접 fetch / SDK / 자체 백엔드 proxy)
- [ ] 인증 (API key 보관 위치 — `.env` / 백엔드 proxy)
- [ ] CORS 정책 — 브라우저에서 직접 호출 가능한가, proxy 가 필요한가

응답 형식은 이미 정해져 있음 — `implementation-plan.md` §4.2 / §4.5 의 JSON 스키마 (`user_type`, `confidence`, `reasoning`, `keywords`).

---

## Step 1. Manual picker 해제

총 3 곳 변경. 5 분 이내.

### 1-1. AppStateProvider import 교체
파일: `src/app/AppStateProvider.tsx`

```ts
// 제거
import { runClassificationFlow } from '../_debug/manualClassificationFlow';

// 추가
import { runClassificationFlow } from '../services/classifiers/classificationFlow';
```

### 1-2. App.tsx 에서 ManualPickerHost 제거
파일: `src/App.tsx`

```ts
// 제거
import { ManualPickerHost } from './_debug/ManualPickerHost';

// JSX 에서도 <ManualPickerHost /> 라인 제거
```

결과:
```tsx
export default function App() {
  return (
    <AppStateProvider>
      <DashboardScreen />
    </AppStateProvider>
  );
}
```

### 1-3. _debug 폴더 삭제
```bash
rm -rf src/_debug
```

이 시점에서 동작은 **`mockClassifier` 기반 자동 분류** 로 돌아감. LLM 은 아직 미연결.

---

## Step 2. LLM adapter 실제 구현

파일: `src/services/classifiers/llmClassifierAdapter.ts`

현재는 throw 만 하는 scaffold. 다음 패턴으로 채운다.

### 기본 골격

```ts
import { buildClassificationPrompt } from '../../domain/classification/classificationPrompt';
import type {
  ClassificationInput,
  LlmClassificationResult,
  LlmUserType,
} from '../../domain/types';
import type { ClassifierAdapter } from './classifyContent';

export const LLM_TIMEOUT_MS = 5000;

const ALLOWED_USER_TYPES: LlmUserType[] = [
  '대학생',
  '직장인',
  '프리랜서',
  '팀 사용자',
  'unknown',
];

export const llmClassifierAdapter: ClassifierAdapter = {
  async classify(input: ClassificationInput): Promise<LlmClassificationResult> {
    const prompt = buildClassificationPrompt(input);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

    try {
      const response = await fetch('/api/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`LLM API ${response.status}`);
      }

      const raw = (await response.json()) as unknown;
      return parseLlmResponse(raw);
    } finally {
      clearTimeout(timer);
    }
  },
};

function parseLlmResponse(raw: unknown): LlmClassificationResult {
  if (!raw || typeof raw !== 'object') {
    throw new Error('LLM response is not an object');
  }
  const obj = raw as Record<string, unknown>;

  const userType = obj.user_type;
  const confidence = obj.confidence;
  const keywords = obj.keywords;
  const reasoning = obj.reasoning;

  if (typeof userType !== 'string' || !ALLOWED_USER_TYPES.includes(userType as LlmUserType)) {
    throw new Error(`invalid user_type: ${String(userType)}`);
  }
  if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
    throw new Error(`invalid confidence: ${String(confidence)}`);
  }
  if (!Array.isArray(keywords) || !keywords.every((k) => typeof k === 'string')) {
    throw new Error('invalid keywords');
  }

  return {
    user_type: userType as LlmUserType,
    confidence,
    keywords,
    reasoning: typeof reasoning === 'string' ? reasoning : undefined,
  };
}
```

### 핵심 포인트

| 항목 | 처리 |
|---|---|
| **timeout** | 5초 — `AbortController` 로 fetch abort. plan §4.7 명세. |
| **schema validation** | LLM 이 잘못된 JSON / 누락 필드 / 허용 외 user_type 을 줄 수 있음. 모두 throw 로 흡수. |
| **error 처리** | adapter 가 throw 하면 `classifyContent` dispatcher 가 catch → null 반환 → `resolveUserType` 가 history/default fallback 실행. UI 측엔 별도 처리 불필요. |
| **prompt** | `buildClassificationPrompt` 가 plan §4.5 템플릿으로 빌드. 변경 시 그 파일에서. |

### 백엔드 proxy 권장
브라우저에서 LLM API 를 직접 호출하지 말 것. 다음 이유:
- API key 가 클라이언트에 노출됨 (보안)
- CORS 이슈
- rate limit / cost 통제 어려움

권장 구조:
```
브라우저 → /api/classify (Vite dev server proxy 또는 Next.js / Express 백엔드)
       → LLM provider (OpenAI / Anthropic / 자체 모델)
```

Vite 의 `vite.config.ts` 에 proxy 설정 추가 예시:
```ts
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
});
```

---

## Step 3. dispatcher default adapter 교체

파일: `src/services/classifiers/classifyContent.ts`

```ts
// 변경 전
import { mockClassifier } from './mockClassifier';

export async function classifyContent(
  input: ClassificationInput,
  adapter: ClassifierAdapter = mockClassifier,
): Promise<LlmClassificationResult | null> {

// 변경 후
import { llmClassifierAdapter } from './llmClassifierAdapter';

export async function classifyContent(
  input: ClassificationInput,
  adapter: ClassifierAdapter = llmClassifierAdapter,
): Promise<LlmClassificationResult | null> {
```

### `classifierSource` 라벨 변경
파일: `src/services/classifiers/classificationFlow.ts`

```ts
// 변경 전
classifierSource: 'mock_classifier'

// 변경 후
classifierSource: 'llm_adapter'
```

이 라벨은 `Classification.source` 에 저장되어 디버깅 / 추후 분석에 사용됨.

---

## Step 4. `DEMO_ANALYSIS_DELAY_MS` 제거

파일: `src/app/AppStateProvider.tsx`

```ts
// 제거
const DEMO_ANALYSIS_DELAY_MS = 800;

// submitContent 의 Promise.all 도 단순 await 로 변경
const outcome = await runClassificationFlow(
  { title: content.title, content: content.body, type: content.type },
  stateRef.current.user.classifications,
);
```

이유: LLM 자연 지연 (보통 1-3초) 이 충분한 "분석 중" UX 를 만들어줌. mock 용 표시 지연 불필요.

`delay()` 헬퍼도 다른 곳에서 안 쓰면 함께 제거.

---

## Step 5. mockClassifier 보존/삭제 결정

| 옵션 | 장점 | 단점 |
|---|---|---|
| **A. 보존** | dev 환경 / 오프라인 / 비용 절감 시 swap 가능 | 코드 유지 부담 |
| **B. 삭제** | 코드 정리, 진실 단일화 | LLM 미연결 환경에서 작업 불가 |

**권장: A**. 다음 패턴으로 환경 기반 swap:

```ts
// classifyContent.ts
const adapter = import.meta.env.DEV && !import.meta.env.VITE_USE_LLM
  ? mockClassifier
  : llmClassifierAdapter;
```

---

## Step 6. 분류 테스트 (plan §4.8)

LLM 이 붙은 시점에야 의미 있는 정확도 측정 가능.

### 6-1. Vitest 설치
```bash
npm install -D vitest @vitest/ui jsdom
```

### 6-2. `vite.config.ts` 에 test 섹션
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
```

### 6-3. `tests/classification.test.ts` 작성
- 기능명세서 §4.5 의 12 케이스 그대로 옮김
- mockClassifier (offline 회귀) + llmClassifierAdapter (실제 호출, 통합 테스트로 분리)
- 정확도 80% 목표 (plan §4.3, §4.8)
- LLM 호출은 fetch mock 또는 실제 환경 분리 (CI 비용)

---

## Step 7. extensions 문서 정리

LLM 연결 후 의미 변경/제거되는 항목:

| 섹션 | 처리 |
|---|---|
| **§1.1** ClassificationInput / LlmClassificationResult 타입 | plan 본문에 반영 후 항목 제거 |
| **§2.1** mockClassifier 키워드 확장 | Step 5 옵션 A (보존) 면 유지, 옵션 B 면 제거 |
| **§2.2** classifyContent null 반환 | LLM 시대에도 유효, 유지 |
| **§5.1** 모달 위치 (이미 해소됨) | 유지 (이력 기록용) |
| **§8.1** `DEMO_ANALYSIS_DELAY_MS` | Step 4 에서 제거됐으므로 항목 삭제 |
| **§8.2** ANALYSIS_FAILED action | 유지 (LLM 실패 시 더 의미 있어짐) |
| **§9** 디버그 도구 (manual picker) | Step 1 에서 제거됐으므로 섹션 전체 삭제 |

---

## 운영 단계 추가 고려사항

### 8-1. Schema validation 라이브러리
`parseLlmResponse` 의 수동 검증 대신 Zod 같은 라이브러리 사용하면 안전성 + 가독성 ↑.

```ts
import { z } from 'zod';

const LlmResponseSchema = z.object({
  user_type: z.enum(['대학생', '직장인', '프리랜서', '팀 사용자', 'unknown']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().optional(),
  keywords: z.array(z.string()),
});

function parseLlmResponse(raw: unknown): LlmClassificationResult {
  return LlmResponseSchema.parse(raw);
}
```

### 8-2. Retry 정책
1차 호출 실패 시 즉시 fallback 보다 1회 retry 가 권장 (네트워크 일시 장애 흡수).
- `classifyContent` dispatcher 에 `retries: 1` 옵션 추가
- timeout 은 retry 한 번만 적용

### 8-3. Streaming 응답
LLM 이 stream 으로 응답하면 "분석 중..." UX 가 더 자연스러워짐.
- `fetch` 의 ReadableStream 처리
- 단, 최종 JSON 파싱은 stream 종료 후
- 진행 표시는 별도 ui 상태 (`state.ui.streamProgress` 등) 추가 검토

### 8-4. 비용 / rate limit
- 메모 작성마다 LLM 호출 → 비용 누적
- 같은 입력 연속 호출 차단 (debounce / dedup cache)
- 저비용 모델 선택 (분류는 대형 모델 불필요)

### 8-5. PII / 민감정보
사용자가 메모에 개인정보를 포함할 수 있음.
- LLM provider 의 데이터 보관 정책 확인
- 자체 호스팅 (Gemma / Ollama) 검토
- 또는 입력 필터링 / 마스킹 전처리

---

## 완료 체크리스트

- [ ] **Step 1**: manual picker 제거 (3 곳 변경)
- [ ] **Step 2**: `llmClassifierAdapter` 실구현 (fetch + schema validation + abort)
- [ ] **Step 3**: `classifyContent` default adapter + `classifierSource` 변경
- [ ] **Step 4**: `DEMO_ANALYSIS_DELAY_MS` 제거
- [ ] **Step 5**: `mockClassifier` 보존/삭제 결정
- [ ] **Step 6**: Vitest 셋업 + 12 케이스 테스트
- [ ] **Step 7**: `implementation-extensions.md` 항목 정리
- [ ] **운영 점검**: schema 검증 / retry / 비용 / PII 정책 결정

### 수동 QA 시나리오

- [ ] 와이어프레임 시나리오: "회의 준비" + "팀원들과 공유할 내용 정리" → 직장인 분류 → 팀원 초대 추천 노출 → CTA 클릭 → 대시보드 갱신
- [ ] LLM timeout: 네트워크 차단 → 5초 후 fallback 동작 (history 또는 default)
- [ ] 잘못된 LLM 응답: schema validation 실패 → fallback 동작
- [ ] 모호한 입력: "오늘 좀 우울하네" → unknown 또는 default fallback
- [ ] 추천 dismiss / never_show / accept 흐름 정상

---

## 변경되지 않는 부분

이 작업으로 다음 영역은 **수정 불필요**:
- `domain/types.ts` (모든 타입 그대로)
- `domain/classification/resolveUserType.ts` (fallback 알고리즘)
- `domain/classification/classificationPrompt.ts` (프롬프트 템플릿)
- `domain/recommendation/*` (추천 카탈로그/선택)
- `domain/dashboard/*` (CTA 반영)
- `services/storage.ts`
- `services/mockFeatureApi.ts`
- `app/appReducer.ts`
- 모든 `components/*` UI 컴포넌트

LLM 연결은 **classifier adapter 1 개 채우는 작업** 이고, 그 외 도메인 / 상태 / UI 는 손대지 않는다. swap point 가 그렇게 설계됨.
