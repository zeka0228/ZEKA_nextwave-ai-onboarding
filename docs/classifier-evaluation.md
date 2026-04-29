# LLM 분류기 평가 — 셋업 / 메트릭 / 측정 이력

본 문서는 LLM 분류기(`services/classifiers/llmClassifierAdapter.ts`)의 정량 평가 도구·메트릭·측정 결과를 정리한다.

연관 문서:
- `implementation-plan.md` §4 — 분류 로직 명세 (입출력 schema, 임계값, fallback)
- `implementation-extensions.md` §10 — plan 대비 적용된 변경 4건의 이유
- `prompt-engineering.md` — 프롬프트 설계 의사결정 배경
- `qa-scenarios.md` §C-3 — MVP 합격 기준의 12 케이스
- `scaling-and-cost-analysis.md` — 운영 환경 동시성 / 비용

---

## 1. 평가 도구

### 1.1 파일

| 경로 | 역할 |
|---|---|
| `src/services/classifiers/__eval__/testset.ts` | 라벨링된 평가 케이스 (현행 152건 + QA §C-3 12건) |
| `src/services/classifiers/__eval__/metrics.ts` | 정확도 / per-class precision·recall·F1 / 혼동행렬 / latency 통계 (순수 함수) |
| `scripts/evalClassifier.ts` | Node 러너. LLM 엔드포인트 호출 → 리포트 출력 + JSON 저장 |
| `scripts/concurrencyTest.ts` | 단일 endpoint 동시성 측정 도구 |
| `scripts/concurrencyTest2x.ts` | 다중 endpoint 라운드로빈 동시성 측정 |

브라우저 어댑터(`llmClassifierAdapter.ts`)는 `import.meta.env` 의존성으로 Node 에서 직접 실행 불가. 동일한 호출/파싱 규약을 러너 내부에서 재구현하고 프롬프트 빌더(`buildClassificationPrompt`)만 공유.

### 1.2 npm 명령

```bash
# 전체 152건
npm run eval:classifier

# QA §C-3 12건만 + 합격 판정 출력
npm run eval:classifier -- --qa

# JSON 결과 저장
npm run eval:classifier -- --qa --out eval-result.json

# 라벨 필터 / 케이스 제한
npm run eval:classifier -- --filter 직장인 --limit 5
```

`eval-result*.json` 은 `.gitignore` 처리됨.

### 1.3 환경변수

| 키 | default | 비고 |
|---|---|---|
| `LLM_BASE_URL` | `http://localhost:11434` | Ollama host root (native `/api/chat`) |
| `LLM_MODEL` | `qwen2.5:3b` | `ollama list` 에 받아둔 태그여야 함 |
| `LLM_API_KEY` | `ollama` | OpenAI 사용 시 sk-... |
| `LLM_TIMEOUT_MS` | `30000` | cold start 큰 모델은 60000 권장 |

브라우저 어댑터의 `VITE_*` 와 분리된 키. 러너가 Node 에서 직접 fetch 하므로 `process.env` 만 읽음.

---

## 2. 평가셋

### 2.1 전체 셋 (`evalCases`, 현행 152건)

| 클래스 | 건수 | difficulty 분포 |
|---|---|---|
| 대학생 | 28 | easy 12 / edge 16 |
| 직장인 | 28 | easy 12 / edge 16 |
| 프리랜서 | 24 | easy 9 / edge 15 |
| 팀 사용자 | 24 | easy 9 / edge 15 |
| **unknown** | **48** | easy 22 / edge 26 |
| **합계** | **152** | easy 64 / edge 88 |

`difficulty: 'easy' | 'edge'` 로 명확/모호 구분. easy 는 키워드 매칭으로도 잡히는 명확한 케이스, edge 는 학회·워크샵·신규 클라이언트 미팅처럼 두 클래스 사이 헷갈리는 케이스 또는 약점 카테고리 (오타·코드스위칭 등).

### 2.2 약점 카테고리별 분포 (152건 중 117건이 카테고리 보강분)

| 카테고리 | 건수 | 의도 |
|---|---|---|
| 오타·인터넷체 (`typo`) | 25 | "햇어요/ㄱㄱ/ㅋㅋㅋ" 같은 실제 사용자 입력 패턴 |
| 영-한 코드스위칭 (`code-switch`) | 18 | "client meeting 준비" 같은 한국 직장 실태 |
| 매우 짧은 입력 (`short`) | 17 | 1~5자 fragments. unknown 트리거 검증 |
| 매우 긴 입력 (`long`) | 12 | 200~500자. TTFT 영향 + 정보량 많은 판단 |
| 이모지·특수문자 (`emoji`) | 12 | "📚 시험" 같이 이모지 노이즈 무시 가능 여부 |
| 도메인 외 (`domain-out`) | 12 | 숫자·코드·gibberish — 모두 unknown 기대 |
| 신조어·줄임말 (`slang`) | 12 | "재택 ㄱㄱ", "갓생", "팀빌딩 가즈아" |
| 모호한 한 단어 (`one-word`) | 8 | "그거", "이거", "약간" — 모두 unknown 기대 |
| 추가 보강 | 1 | 클래스별 균형 |

각 케이스의 `note` 필드에 카테고리 표기.

### 2.3 QA 시나리오 셋 (`qaScenarioCases`, 12건)

`docs/qa-scenarios.md` §C-3 표를 그대로 fixture 화. **합격 기준: 정확도 ≥ 80% (10/12)**.

unknown → fallback 으로 명시된 4건(qa-05/06/11/12) 은 `expected: 'unknown'` 으로 라벨. LLM 이 raw `unknown` 을 반환하거나 confidence 가 낮아 `resolveUserType` 이 fallback 경로로 빠지는 게 정답.

---

## 3. 메트릭 정의

| 지표 | 정의 |
|---|---|
| `accuracy` (succeeded) | 정답 / adapter 호출 성공 건. fail(timeout/parse) 은 분모 제외 |
| `accuracyOverall` | 정답 / 전체. fail 은 자동 오답 처리 (운영 정확도) |
| `macroF1` | 클래스별 F1 의 단순 평균. unknown 포함 |
| `confusionMatrix` | 5×5 (행: expected, 열: predicted) |
| `confidenceMean.correct/incorrect` | 캘리브레이션 진단용 — 격차가 작으면 모델이 자기 점수 못 믿음 |
| `latency.p50/p95/max` | 호출당 ms. p95 가 5초 timeout (`plan §4.7`) 안에 들어와야 함 |
| `difficulty.easy/edge.accuracy` | edge 케이스 회복력 진단 |

실패 케이스는 confusion matrix 에 들어가지 않고 `support`/`fn` 으로만 카운트 — 모델이 응답한 라벨만 행렬을 오염시키지 않게 분리.

---

## 4. 측정 환경

- 모델: `gemma4:e4b` (8.0B Q4_K_M, thinking 모델)
- 추론 엔진: Ollama 0.21.2, native `/api/chat` + `think:false`
- HW: NVIDIA RTX 4070 Ti SUPER 16GB VRAM
- 출력 schema: `{user_type: ..., confidence: ...}` (latency 목적 축소 — `implementation-extensions.md` §10.1)

---

## 5. 측정 이력 — 적용된 변경 4 단계

분류기 baseline 부터 운영 합격까지의 단계별 측정. 각 단계는 점진적 개선과 그 근거를 기록.

### 5.1 Baseline (2026-04-28)

원본 프롬프트 (`implementation-plan.md` §4.5 초안) + OpenAI compat endpoint + 기본 schema.

| 지표 | 값 |
|---|---|
| QA §C-3 정확도 | **75.0% (9/12) FAIL** |
| Macro-F1 | 0.773 |
| Latency mean / p50 / p95 | 5,399 / 5,009 / 9,015ms |
| Easy / Edge | 9/10 (90%) / **0/2 (0%)** |
| unknown recall | **0.250 (1/4)** |

**오답 패턴**: 모든 오답이 unknown 케이스 (qa-05/06/12). 모델이 단일 단어 함정 ('회의', '경제학') 에 first-match 점프 + confidence ≥ 0.80 으로 자기과신 → `resolveUserType` 의 history fallback 도 활성화 못 함.

→ 진단: **모델 능력이 아닌 프롬프트 문제**. 어떤 모델로 swap 해도 같은 패턴 재현 가능성 높음.

### 5.2 변경 A — 출력 schema 축소 (Reasoning/Keywords 제거)

**의도**: latency 1초 목표. 출력 토큰 60~70% 감소.

| 변경 | 위치 |
|---|---|
| 출력 JSON 정의: `{user_type, confidence, reasoning, keywords}` → `{user_type, confidence}` | `classificationPrompt.ts` |
| `parseLlmResponse` 에서 reasoning/keywords 검증 제거. `keywords: []` 빈 배열로 채워 반환 | `llmClassifierAdapter.ts` |

| 지표 | Baseline | A 적용 |
|---|---|---|
| 정확도 | 75% | 75% (변경 없음) |
| Latency mean | 5,399ms | **1,306ms (-76%)** |
| Latency p50 | 5,009ms | **378ms (-92%)** |
| Latency p95 | 9,015ms | 6,615ms |

11/12 케이스가 1초 이내. p95 가 튀는 두 케이스: cold start (첫 호출), 모호 입력 anomaly. 정확도는 변경 없음 (프롬프트 미변경).

### 5.3 변경 B — 프롬프트 후보 1+5 적용

**의도**: unknown 케이스 정확도 회복. 진단(§5.1)이 명시한 "프롬프트 문제" 해결.

`prompt-engineering.md` 의 두 후보 적용:
- **후보 1**: unknown 트리거 4개 enumerate (사적 영역 / 빈 내용 / 단서 충돌 / 단정 불가)
- **후보 5**: 클래스별 함정 키워드 negative criteria

| 지표 | Baseline | A | **A+B** |
|---|---|---|---|
| QA §C-3 정확도 | 75% | 75% | **91.7%** |
| Macro-F1 | 0.773 | 0.760 | 0.893 |
| Easy / Edge | 9/10 / 0/2 | 9/10 / 0/2 | 9/10 / **2/2** |
| unknown recall | 0.250 | 0.250 | **1.000** |

**unknown 4건 모두 회복** (qa-05/06/11/12). 진단 적중.

신규 오답 1건: `qa-10` ("개발팀 주간 회의" / "스프린트 리뷰") → 직장인 (함정 키워드의 "개발팀" → "부서" 매핑 약함).

### 5.4 변경 C — Native API + `think:false`

**발견 동기**: 브라우저 dev 서버에서 체감 latency 가 측정값보다 큼. Ollama 응답을 raw 로 떠보니 `gemma4:e4b` 가 thinking 모델임이 드러남.

OpenAI compat 응답 본문에서:
```json
{
  "message": {
    "content": "{\"user_type\": \"unknown\", \"confidence\": 0.0}",
    "reasoning": "Thinking Process:\n1. Analyze the Request: ... (~300 토큰)"
  },
  "usage": { "completion_tokens": 17 }
}
```

`completion_tokens` 가 17 로만 잡혀도 **모델은 ~300+ thinking 토큰을 먼저 디코드**한 뒤 JSON 17 토큰을 출력. schema 축소(A) 가 출력 토큰만 줄여서 케이스 편차의 본질적 원인을 못 잡았음.

OpenAI compat 엔드포인트는 `think:false` 를 무시. **Ollama native `/api/chat`** 으로 가야 옵션이 적용됨.

| 측면 | OpenAI compat | Ollama native |
|---|---|---|
| URL | `${BASE_URL}/chat/completions` | `${BASE_URL}/api/chat` |
| BASE_URL | `http://localhost:11434/v1` | `http://localhost:11434` (host root) |
| body 추가 | — | `think: false`, `stream: false` |
| body 변경 | `response_format: {type:'json_object'}` | `format: 'json'` |
| body 변경 | `temperature: 0` | `options: { temperature: 0 }` |
| 응답 파싱 | `choices[0].message.content` | `message.content` |

| 지표 | A+B | **A+B+C** | 변화 |
|---|---|---|---|
| QA §C-3 정확도 | 91.7% | **100%** | +8.3%p |
| 전체 33건 정확도 | 97.0% | **100%** | +3.0%p |
| Latency mean | 4,343ms | **496ms** | -89% |
| Latency p50 | 4,854ms | **491ms** | -90% |
| Latency p95 | 6,128ms | **510ms** | -92% |

**부산물 — 정확도가 함께 상승**. 가설:
- thinking 모드의 모델이 trace 단계에서 자기 추론으로 점프 ("회의 → 직장인", "개발팀 → 일반 부서명") 하면서 후보 1+5 의 함정 키워드 가이드를 무시
- think:false 면 모델이 prompt 만 보고 답해서 명시된 가이드를 충실히 따름
- e4b 사이즈 (effective 4B) 의 thinking 능력이 약해 over-reasoning 으로 오히려 답을 망쳤을 가능성

→ **작은 thinking 모델은 prompt 가 잘 짜였을 때 think:false 가 더 안전**할 수 있다는 시사.

### 5.5 변경 D — 평가셋 33→152건 확장

33건의 통계적 한계 (100% 측정 시 95% Wilson CI [89.4%, 100%]) 를 좁히기 위한 확장. §2.2 에 카테고리별 117건 분포.

| 지표 | 33건 | **152건** |
|---|---|---|
| Accuracy | 100% (33/33) | **98.7% (150/152)** |
| Macro-F1 | 1.000 | **0.986** |
| Easy / Edge | 26/26 (100%) / 7/7 (100%) | 63/64 (98.4%) / **87/88 (98.9%)** |
| Latency mean / p50 / p95 | 496 / 491 / 510 ms | 541 / 497 / **524 ms** |
| **95% Wilson CI** | [89.4%, 100%] | **[95.4%, 99.6%]** |

QA §C-3 12건 회귀: 100% (12/12) 유지.

**오답 2건** (직장인 클래스):

| id | 입력 | 기대 | 실제 | 카테고리 | 분석 |
|---|---|---|---|---|---|
| `worker-code-01` | "client meeting 준비" / "자료 review 부탁드림" | 직장인 | 프리랜서 | code-switch | 영어 "client" → 프롬프트의 "클라이언트" 매칭. 라벨 모호성 있음 |
| `worker-slang-01` | "재택 ㄱㄱ" / "오늘 자료 정리만 하면 됨" | 직장인 | unknown | slang | "재택" 키워드 미명시. 모델이 보수적 unknown fallback |

**둘 다 합리적 오답** — over-confident 가 아닌 보수적 분류:
- code-01: 인접 클래스로 빠짐 (입력 자체 모호)
- slang-01: unknown 으로 후퇴 → `resolveUserType` 의 history fallback 으로 회복 가능

---

## 6. 클래스별 메트릭 (152건 최종)

| 클래스 | support | TP | FP | FN | precision | recall | F1 |
|---|---|---|---|---|---|---|---|
| 대학생 | 28 | 28 | 0 | 0 | 1.000 | 1.000 | **1.000** |
| 직장인 | 28 | 26 | 0 | 2 | 1.000 | 0.929 | 0.963 |
| 프리랜서 | 24 | 24 | 1 | 0 | 0.960 | 1.000 | 0.980 |
| 팀 사용자 | 24 | 24 | 0 | 0 | 1.000 | 1.000 | **1.000** |
| unknown | 48 | 48 | 1 | 0 | 0.980 | 1.000 | **0.990** |

---

## 7. 합격 여부

| 기준 | 값 | 결과 |
|---|---|---|
| QA §C-3 ≥ 80% 정확도 | 100% | **PASS** |
| QA §C-3 macro-F1 ≥ 0.85 | 1.000 | **PASS** |
| 152건 전체 ≥ 80% 정확도 | 98.7% | **PASS** |
| 152건 macro-F1 ≥ 0.85 | 0.986 | **PASS** |
| Latency p95 ≤ 1,000ms | 524ms (cold start 제외) | **PASS** |
| 95% CI 하한 ≥ 90% | 95.4% | **PASS** |
| Edge accuracy ≥ 95% | 98.9% | **PASS** |

→ **MVP 운영 진입 합격**.

---

## 8. 평가셋 신뢰구간 가이드

작은 표본의 정확도 측정은 신뢰구간이 매우 넓음. 100% 정확도 측정의 의미:

| 표본 크기 | 100% 측정 시 95% Wilson CI 하한 |
|---|---|
| 12 | 73.5% |
| 33 | 89.4% |
| 100 | 96.4% |
| 200 | 98.2% |
| 500 | 99.3% |
| 1,000 | 99.6% |

→ **현재 152건의 의미**: 운영 정확도가 95~99% 사이일 가능성이 높음. baseline 측정 기준으로는 충분하지만, 베타 사용자 데이터로 300~500건 확장 시 신뢰구간이 더 좁혀짐.

---

## 9. 운영 진입 후 다음 단계 (선택)

1. **`worker-code-01` / `worker-slang-01` 보강**:
   - "재택근무·원격" 어휘를 직장인 정의에 추가 (단, 프리랜서 negative criteria 도 동시 보강 필요)
   - 영어 "client" 가 직장인 맥락에서 흔하다는 점 반영 (라벨 자체 모호성 인지)
2. **300~500 케이스로 확장**: 베타 사용자 실제 메모 수집 후 라벨링
3. **회귀 보호 자동화**: nightly eval, 오답 case 자동 수집 + 라벨링 파이프라인
4. **운영 fallback 검증**: `resolveUserType` 의 history fallback 효과 측정. raw 정확도 98.7% 가 fallback 적용 시 99%+ 로 올라가는지 확인

운영 / 동시성 / 클라우드 비용 분석은 `scaling-and-cost-analysis.md` 참조.
