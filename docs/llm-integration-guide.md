# LLM 연동 가이드

실제 LLM 분류기가 준비되었을 때, 임시 수동 picker 를 제거하고 자동 분류 flow 로 전환하는 절차.

> **✅ 본 가이드의 Step 1~5 는 모두 적용 완료 (2026-04-29).**
> 현재 default 분류기는 Ollama `gemma4:e4b` (LLM_BASE_URL `/api/llm`, native `/api/chat`, `think:false`).
> 측정값: QA §C-3 12건 100% / 전체 33건 100%, Macro-F1 1.000, latency p95 510ms.
> 본 문서는 (a) 완료된 작업의 회고 (b) 모델/프로바이더 교체 시 참조 가이드 (c) 운영 점검 체크리스트로 사용한다.
> 적용 결과 변경 사항 상세는 `implementation-extensions.md` §10, 측정 진단 과정은 `notes/classifier-eval.md` (.gitignore) 참조.

## 사전 점검 — 적용 결과

| 항목 | 결정 |
|---|---|
| LLM 종류 | Ollama 로컬 (`gemma4:e4b`) — dev 환경. 외부 API 교체 시 어댑터 endpoint/응답 schema 분기 필요 |
| 호출 방식 | 직접 fetch + Vite dev proxy (`/api/llm` → `host:11434`) |
| 인증 | `.env` 의 `VITE_LLM_API_KEY` (Ollama 는 무시. OpenAI 사용 시 sk-...) |
| CORS | 브라우저 → vite proxy → Ollama. CORS 회피 |

응답 형식: 출력 schema 를 latency 목적으로 축소 — **현재는 `{user_type, confidence}` 만**. `reasoning` / `keywords` 는 adapter 가 빈 값으로 채워 호출자에게 같은 인터페이스 제공 (`implementation-extensions.md` §10.1).

---

## Step 1. Manual picker 해제 ✅ 완료

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

### 1-4. (선택) `RESET_STATE` action / `actions.resetState()` 처리

picker 가 사용하던 영속 초기화 기능 (`appReducer.ts` 의 `RESET_STATE` action + `AppStateProvider` 의 `resetState`) 은 picker 제거 후 호출 지점이 사라짐.

선택지:
- **A. 보존 (권장)**: 일반 목적 primitive 로 가치 있음 — 향후 로그아웃 / 온보딩 재시작 / E2E 테스트 fixture / 새 디버그 도구에 재사용 가능. 사용 안 해도 dead weight 거의 없음.
- **B. 삭제**: 완전한 정리 우선 시
  - `src/app/appReducer.ts` 에서 `RESET_STATE` 케이스 + 해당 action 타입 라인 제거
  - `src/app/AppStateProvider.tsx` 에서 `resetState` `useCallback` + actions 객체에서 제거
  - `AppActions` 인터페이스에서 `resetState: () => void;` 제거
  - `clearPersistedState` import 가 더 이상 안 쓰이면 제거

이 시점에서 동작은 **`mockClassifier` 기반 자동 분류** 로 돌아감. LLM 은 아직 미연결.

---

## Step 2. LLM adapter 실제 구현 ✅ 완료

파일: `src/services/classifiers/llmClassifierAdapter.ts`

> 본 문서 초안 (OpenAI compat `/v1/chat/completions`) 은 latency 측정 후 **Ollama native `/api/chat` + `think:false`** 로 교체됨. 배경: `gemma4:e4b` 가 thinking 모델이라 OpenAI compat 엔드포인트로 호출하면 reasoning trace 가 응답에 포함되어 latency 가 4~7s 로 튐 (`implementation-extensions.md` §10.3).
> 아래 코드 골격은 **현재 적용된 형태**.

### 현재 어댑터 (요약)

```ts
import { buildClassificationPrompt } from '../../domain/classification/classificationPrompt';
import type {
  ClassificationInput,
  LlmClassificationResult,
  LlmUserType,
} from '../../domain/types';
import type { ClassifierAdapter } from './classifyContent';

const env = import.meta.env as Record<string, string | undefined>;
const BASE_URL = env.VITE_LLM_BASE_URL ?? '/api/llm';   // Ollama host root (vite proxy 경유)
const MODEL = env.VITE_LLM_MODEL ?? 'qwen2.5:3b';
const API_KEY = env.VITE_LLM_API_KEY ?? 'ollama';

const parsedTimeout = Number(env.VITE_LLM_TIMEOUT_MS);
export const LLM_TIMEOUT_MS =
  Number.isFinite(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : 5000;

const ALLOWED_USER_TYPES: LlmUserType[] = [
  '대학생', '직장인', '프리랜서', '팀 사용자', 'unknown',
];

interface OllamaChatResponse { message?: { content?: string } }

export const llmClassifierAdapter: ClassifierAdapter = {
  async classify(input: ClassificationInput): Promise<LlmClassificationResult> {
    const prompt = buildClassificationPrompt(input);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

    try {
      const response = await fetch(`${BASE_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          stream: false,
          think: false,                   // thinking 모델의 reasoning trace 차단
          format: 'json',                 // JSON 강제
          options: { temperature: 0 },
          messages: [
            { role: 'system', content: 'You are a strict JSON classifier. Respond with a single JSON object only — no prose, no markdown fences.' },
            { role: 'user', content: prompt },
          ],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`LLM API ${response.status}: ${body.slice(0, 200)}`);
      }

      const completion = (await response.json()) as OllamaChatResponse;
      const content = completion.message?.content;
      if (typeof content !== 'string' || content.length === 0) {
        throw new Error('LLM response missing content');
      }

      const parsed = JSON.parse(content) as unknown;
      return parseLlmResponse(parsed);
    } finally {
      clearTimeout(timer);
    }
  },
};

function parseLlmResponse(raw: unknown): LlmClassificationResult {
  if (!raw || typeof raw !== 'object') throw new Error('LLM response is not an object');
  const obj = raw as Record<string, unknown>;

  const userType = obj.user_type;
  const confidence = obj.confidence;

  if (typeof userType !== 'string' || !ALLOWED_USER_TYPES.includes(userType as LlmUserType)) {
    throw new Error(`invalid user_type: ${String(userType)}`);
  }
  if (typeof confidence !== 'number' || Number.isNaN(confidence) || confidence < 0 || confidence > 1) {
    throw new Error(`invalid confidence: ${String(confidence)}`);
  }

  return {
    user_type: userType as LlmUserType,
    confidence,
    keywords: [],     // LLM 응답에서 받지 않음. UI 측 호환 위해 빈 배열
  };
}
```

### 핵심 포인트

| 항목 | 처리 |
|---|---|
| **timeout** | 5초 (env override 가능). plan §4.7 명세 — 측정 결과 p95 510ms 로 충분한 마진 |
| **`think: false`** | thinking 모델 (gemma3 시리즈, qwen3, deepseek-r1 등) 의 reasoning trace 차단. 비-thinking 모델에는 무시됨 |
| **`format: 'json'`** | OpenAI compat 의 `response_format: {type: 'json_object'}` 대응. 모델이 valid JSON 만 출력하도록 강제 |
| **schema validation** | LLM 이 잘못된 JSON / 누락 필드 / 허용 외 user_type 을 줄 수 있음. 모두 throw 로 흡수 |
| **error 처리** | adapter 가 throw 하면 `classifyContent` dispatcher 가 catch → null 반환 → `resolveUserType` 가 history/default fallback 실행. UI 측엔 별도 처리 불필요 |
| **prompt** | `buildClassificationPrompt` 가 빌드. 현행 프롬프트는 plan §4.5 초안 + unknown 트리거 + 함정 키워드 (extensions §10.2) |
| **출력 schema** | `{user_type, confidence}` 만. latency 목적 (extensions §10.1) |

### 백엔드 proxy

현재 dev 환경: Vite proxy 가 `/api/llm` → `host:11434` 로 forward. 운영 환경에서는 별도 백엔드 proxy 권장:
- API key 가 클라이언트에 노출되지 않음 (보안)
- CORS 회피
- rate limit / cost 통제

`vite.config.ts` 의 현재 설정:
```ts
server: {
  proxy: {
    '/api/llm': {
      target: process.env.OLLAMA_URL ?? 'http://localhost:11434',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api\/llm/, ''),
    },
  },
},
```

---

## Step 3. dispatcher default adapter 교체 ✅ 완료

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

## Step 4. `DEMO_ANALYSIS_DELAY_MS` 제거 ✅ 완료

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

## Step 5. mockClassifier 보존/삭제 결정 ✅ 완료 (옵션 A 채택)

| 옵션 | 장점 | 단점 |
|---|---|---|
| **A. 보존** | dev 환경 / 오프라인 / 비용 절감 시 swap 가능 | 코드 유지 부담 |
| **B. 삭제** | 코드 정리, 진실 단일화 | LLM 미연결 환경에서 작업 불가 |

**채택: A**. 환경변수 기반 swap (현행):

```ts
// src/services/classifiers/classifyContent.ts
const useMock = env.VITE_USE_MOCK_CLASSIFIER === 'true';
const defaultAdapter: ClassifierAdapter = useMock ? mockClassifier : llmClassifierAdapter;
```

→ Ollama 미가동 / 오프라인 dev 시 `.env` 에 `VITE_USE_MOCK_CLASSIFIER=true` 만 추가하고 dev 재시작.

---

## Step 6. 분류 테스트 ✅ 완료 (Vitest 대신 standalone 러너)

LLM 이 붙은 시점에야 의미 있는 정확도 측정 가능.

### 6-1. 채택 — `scripts/evalClassifier.ts` 러너

Vitest 대신 standalone tsx 러너로 측정. 이유:
- LLM 호출은 외부 의존 (Ollama / API) — Vitest 의 jsdom 환경 불필요
- CI 가 아닌 dev 환경에서 수동 측정 + 결과 JSON 저장이 주 사용 패턴
- 메트릭이 풍부 (per-class P/R/F1, 혼동행렬, p50/p95 latency, 캘리브레이션 진단)

`package.json`:
```json
"scripts": {
  "eval:classifier": "tsx scripts/evalClassifier.ts"
}
```

### 6-2. 평가셋

`src/services/classifiers/__eval__/testset.ts`:
- `evalCases` (33건) — 5 클래스 × 6~8 케이스 (easy/edge 구분)
- `qaScenarioCases` (12건) — `qa-scenarios.md` §C-3 fixture

### 6-3. 실행

```bash
# QA §C-3 12건 (합격 기준 ≥ 80%)
npm run eval:classifier -- --qa

# 전체 33건
npm run eval:classifier

# 결과 JSON 저장
npm run eval:classifier -- --qa --out eval-result.json

# 라벨 필터 / 케이스 제한
npm run eval:classifier -- --filter 직장인 --limit 5
```

### 6-4. 환경변수

| 키 | default | 비고 |
|---|---|---|
| `LLM_BASE_URL` | `http://localhost:11434` | Ollama host root |
| `LLM_MODEL` | `qwen2.5:3b` | `ollama list` 에 받아둔 태그 |
| `LLM_API_KEY` | `ollama` | OpenAI 사용 시 sk-... |
| `LLM_TIMEOUT_MS` | `30000` | cold start 흡수용 |

### 6-5. 측정 결과 (gemma4:e4b, A+B+C 적용)

| 셋 | Accuracy | Macro-F1 | Latency mean / p95 |
|---|---|---|---|
| QA §C-3 (12건) | 100.0% | 1.000 | 512ms / 793ms |
| 전체 회귀 (33건) | 100.0% | 1.000 | 496ms / 510ms |

상세 진단 과정·메트릭 정의·보강 후보는 `notes/classifier-eval.md` (.gitignore) 참조.

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
| **§8.7** `RESET_STATE` / `resetState` | Step 1-4 결정에 따름 (보존 시 유지, 삭제 시 항목 제거) |
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

### 8-6. Thinking 모델 주의사항 ⚠️ 적용 후 발견

`gemma4:e4b` 같은 **thinking 모델**은 모델 내부적으로 reasoning trace 를 먼저 생성한 뒤 최종 답을 출력. trace 가 응답에 포함되어 latency 가 4~7초로 튐.

진단 방법:
```bash
# Ollama 응답 raw 확인
curl -s -X POST http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"<모델>","messages":[{"role":"user","content":"test"}],"response_format":{"type":"json_object"},"temperature":0}' \
  | head -c 2000
```
→ 응답 본문에 `"reasoning": "Thinking Process: ..."` 같은 별도 필드가 있으면 thinking 모델.

대응:
- **OpenAI compat 엔드포인트는 `think:false` 를 무시** — Ollama native `/api/chat` 로 가야 함
- body 에 `think: false` + `format: 'json'` + `options: {temperature: 0}` 명시
- 응답 schema 가 OpenAI compat 과 다름 — `choices[0].message.content` → `message.content`

본 프로젝트 어댑터는 이미 native API 형태. 모델 교체 시 thinking 여부에 따라 별도 분기 불필요 (`think:false` 는 비-thinking 모델에 무시됨).

OpenAI / Anthropic 같은 외부 API 의 thinking 옵션은 provider-specific 키:
- OpenAI o1/o3: `reasoning_effort: 'low' | 'medium' | 'high'`
- Anthropic Claude: `thinking: { type: 'enabled' | 'disabled', budget_tokens: N }`
- 외부 API 어댑터는 별도 구현 필요

---

## 완료 체크리스트

- [x] **Step 1**: manual picker 제거 (3 곳 변경) — `_debug` 폴더 삭제 완료. `RESET_STATE` / `resetState` 는 보존 (옵션 A)
- [x] **Step 2**: `llmClassifierAdapter` 실구현 — Ollama native `/api/chat` + `think:false` (초안의 OpenAI compat 에서 변경)
- [x] **Step 3**: `classifyContent` default adapter (`llmClassifierAdapter`) + `classifierSource: 'llm_adapter'`
- [x] **Step 4**: `DEMO_ANALYSIS_DELAY_MS` 제거
- [x] **Step 5**: `mockClassifier` 보존 (`VITE_USE_MOCK_CLASSIFIER` env swap)
- [x] **Step 6**: standalone tsx 러너 (`scripts/evalClassifier.ts`) — Vitest 대신 채택
- [x] **Step 7**: `implementation-extensions.md` §10 (LLM 통합 결과) 추가
- [x] **운영 점검 (8-6)**: thinking 모델 진단 / `think:false` 적용 완료
- [ ] **운영 점검 (잔여)**: schema validation 라이브러리 (Zod) / retry / streaming / 비용 / PII 정책 결정 — 운영 진입 전 검토

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
