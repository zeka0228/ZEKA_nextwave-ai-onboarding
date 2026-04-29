# 운영 / 동시성 / 클라우드 비용 분석

본 문서는 LLM 분류기를 실 운영으로 가져갈 때의 동시성 한계, 모델 swap 시도 결과, 클라우드 인프라 옵션 비교를 정리한다.

연관 문서:
- `classifier-evaluation.md` — 정확도 측정 (트랙 분리)
- `prompt-engineering.md` — 프롬프트 설계 (모델 swap 시 의존성 정보)
- `llm-features-roadmap.md` — prefetch 등 호출 수 multiplier 가 큰 기능

---

## 0. 전략 결정 요약 (Executive Summary)

**채택 결론**: dev / test 환경은 **기존 설치된 `gemma4:e4b` 단일 모델 그대로 유지**, 운영 진입 시 **Groq serverless 로 전환**.

이 결정에 도달한 과정:

| 단계 | 시도 | 결과 |
|---|---|---|
| 1. 더 작은 로컬 모델로 throughput 끌어올리기 | `qwen2.5:3b` (1.9GB) | **정확도 41.7% FAIL** — 함정 키워드 over-trigger (§3.1) |
| 2. 한국어 강한 7B 시도 | `qwen2.5:7b` (4.7GB) | 정확도 75% FAIL (§3.2) |
| 3. 같은 gemma 계열 9B 로 swap | `gemma2:9b` (5.4GB) | 정확도 91.7% PASS, throughput 1.45 req/s (절반으로 떨어짐) (§3.3) |
| 4. 같은 GPU 에 2 인스턴스 띄우기 | `gemma2:9b × 2` | **throughput -22% (anti-pattern)** — compute 경합 (§4) |
| 5. 클라우드 dedicated GPU 검토 | RunPod L40S / 4090 | DAU 11,000 이하면 Groq 보다 비쌈 (§6.3 손익분기) |
| 6. **Serverless 비용 분석** | **Groq gemma2-9b** | **DAU 5,000 까지 월 $260, DAU 100,000 까지 월 $5,238** — 거의 모든 시나리오에서 압도 (§6.2) |

**핵심 발견**:
- 로컬 모델 swap 으로 의미 있는 throughput 향상 불가능 (per-request overhead 가 dominant)
- 같은 GPU 2 인스턴스는 anti-pattern (compute 경합)
- 본 프롬프트는 gemma 계열에 종속 — qwen 시리즈 swap 시 정확도 무너짐
- **`gemma4:e4b` 가 우연히 정확도(100%)·throughput(3.6 req/s) 양쪽 모두 최적** — 추가 투자 의미 없음
- API serverless (Groq) 단가가 dedicated GPU 대비 압도 — 운영 진입 시 self-host 불필요

**결정 근거**:
1. **dev / test 환경**: 4070 Ti Super 가 이미 sunk cost. `gemma4:e4b` 가 가장 정확하고 빠름. 추가 모델 다운로드 / 인프라 변경 불필요. 월 전기료 ~$22
2. **운영 진입 (DAU 500~)**: Groq gemma2-9b ($19.40/M req) 로 전환. 정확도 91.7% 측정됨, dedicated 대비 손익분기 11,000 DAU 이상이라 거의 항상 유리
3. **자체 GPU 호스팅**: DAU 11,000+ + 24/7 평탄 트래픽 + 데이터 주권 요건 같은 특수 조건일 때만 검토

**무엇을 안 하기로 했는가**:
- ❌ 더 작은 로컬 모델로 swap (정확도 무너짐)
- ❌ 같은 GPU 에 2 인스턴스 (anti-pattern)
- ❌ vLLM / SGLang 도입 (운영 부담 vs Groq 단순함의 trade-off 에서 Groq 압도)
- ❌ AWS / GCP dedicated GPU (RunPod 대비 2~3배 비싸고, 둘 다 Groq 보다 비쌈)
- ❌ 추가 GPU 구매 / 클라우드 GPU 렌탈 (DAU 500 이하면 idle 비용 손해)

이 결정은 §1~§10 의 측정·분석으로 뒷받침된다. 결과가 바뀌는 트리거: (a) 가격 구조 변경 (Groq 단가 상승), (b) 데이터 주권 요건, (c) DAU 11,000+ 도달. 위 중 하나라도 발생 시 §8 결정 트리 재검토.

---

## 1. 측정 환경 / 동기

- **하드웨어**: NVIDIA RTX 4070 Ti SUPER 16GB VRAM
- **OS / 추론 엔진**: Windows 11, Ollama 0.21.2
- **출발 질문**: 사용자가 메모 입력 중 prefetch 분류 호출 → 동시 사용자 늘어날 때 로컬 GPU 가 어디까지 견디는지, 클라우드/serverless 와 비교 시 어디부터 갈아탈 가치가 있는지
- **측정 도구**:
  - `scripts/concurrencyTest.ts` — 단일 endpoint 에 N개 동시 요청 → wall clock / per-req latency / throughput
  - `scripts/concurrencyTest2x.ts` — 다중 endpoint 라운드로빈 부하 분산

---

## 2. 동시성 baseline (gemma4:e4b)

현 default 모델 (`gemma4:e4b`, 9.6GB Q4_K_M) 의 동시성 천장.

### 2.1 측정 결과

| N | wall (ms) | throughput (req/s) | p50 | p95 | max | latency 증가율 |
|---|---|---|---|---|---|---|
| 1 | 433 | 2.31 | 433 | 433 | 433 | 1.0x |
| 2 | 669 | 2.99 | 416 | 669 | 669 | 1.55x |
| 4 | 1,214 | 3.29 | 689 | 1,214 | 1,214 | 2.80x |
| 8 | 2,216 | **3.61** | 1,209 | 2,215 | 2,215 | 5.12x |
| 16 | 4,463 | 3.59 | 2,412 | 4,461 | 4,461 | 10.31x |

### 2.2 핵심 관찰

- **throughput 천장 ~3.6 req/s** (N=8 부터 saturated)
- **effective parallelism ≈ 1.5x** — Ollama 가 진짜 병렬 추론이 아닌 batched sequential 처리. compute / 메모리 bandwidth 오버랩 정도만 발생
- **min latency 는 N 무관 ~430ms** — 첫 번째로 끝나는 요청은 큐 깊이와 무관 (모델 forward pass 자체 시간)
- **p95 가 N 에 정확히 비례 증가** (N=1→16 에서 10.3x) — 큐 누적이 latency 의 본질
- **VRAM 사용**: 모델 적재 후 ~10.5GB

### 2.3 시사점

- 4 슬롯 (effective) × 430ms latency = 약 9.3 req/s 가 이론적 최대지만 실제는 3.6 req/s — Ollama 의 슬롯 활용 효율이 1/2.5 수준
- **UX OK throughput** (p95 ≤ 1s) ≈ N=2 sweet spot = **~3 req/s**
- **UX 관대 (p95 ≤ 2s)**: N=4 ≈ 3.3 req/s

---

## 3. 모델 swap 탐색 — "더 작은 모델 = 더 빠름" 가설 검증

가설: "작은 모델로 swap → 2 인스턴스 → throughput 2배". 결과는 **가설 부정**.

### 3.1 qwen2.5:3b (1.9GB Q4) — 정확도 FAIL

| 지표 | 값 |
|---|---|
| QA §C-3 정확도 | **41.7% (5/12) FAIL** |
| Macro-F1 | 0.240 |
| 패턴 | 모든 명확 케이스를 unknown 으로 over-trigger |

**원인**: 함정 키워드 negative criteria 가 3B 모델에 너무 강한 신호. 모델이 종합 판단 못 하고 "함정 키워드 = unknown" 으로 점프. 더 큰 모델은 함정 키워드 + 다른 단서 종합하지만 3B 는 단순 매칭.

**Throughput 도 미달**: ceiling 2.5 req/s — gemma4:e4b (3.6) 보다 **낮음**. 이유: per-request overhead (~300ms) 가 model size 와 무관하게 깔리고, output 17 토큰밖에 안 돼서 모델 size 가 latency 에 거의 반영 안 됨. Ollama auto-config 가 작은 모델에 NUM_PARALLEL=1 만 할당한 것도 한 몫.

### 3.2 qwen2.5:7b (4.7GB Q4) — 정확도 FAIL

| 지표 | 값 |
|---|---|
| QA §C-3 정확도 | **75% (9/12) FAIL** |
| 명확 4 클래스 | 8/8 (100%) |
| unknown 4건 | **1/4 (25%)** |
| Confidence | 모든 응답 1.00 — 오답에도 자기과신 |

**원인**: 함정 키워드 negative criteria 를 *반대로* 무시. 3b 와 정확히 반대 패턴 — 3b 는 over-trigger, 7b 는 under-trigger.

### 3.3 gemma2:9b (5.4GB Q4) — 정확도 PASS, Throughput FAIL

| 지표 | 값 |
|---|---|
| QA §C-3 정확도 | **91.7% (11/12) PASS** |
| Throughput ceiling | 1.45 req/s (gemma4:e4b 의 절반) |

같은 gemma 계열이라 프롬프트 호환성 좋음. 그러나 9B 진짜 파라미터로 추론 부하 무거움. Ollama 가 NUM_PARALLEL=1 로 할당.

### 3.4 결론 — 모델 swap 핵심 인사이트

1. **본 프롬프트는 gemma 계열에 최적화됨** — qwen 시리즈에서 정확도 무너짐 (3b 41.7%, 7b 75%). gemma2:9b 만 91.7% PASS (`prompt-engineering.md` §7)
2. **gemma4:e4b 가 우연히 최적** — 정확도 100% + throughput 3.6 req/s 양쪽 다 1등
3. **모델 size 가 throughput 에 영향 적음** — output 17 토큰이라 per-request overhead (~300ms) 가 dominant. 3B 모델도 7B 모델도 latency 비슷 (~400ms vs ~700ms)
4. **swap 으로 throughput 향상은 불가능** — 더 작은 모델 가도 Ollama auto-config 가 NUM_PARALLEL 적게 할당해서 plateau 가 더 낮아지기까지 함

---

## 4. 2 인스턴스 실험 — Anti-pattern 확인

"별도 ollama 프로세스 2개 = throughput 2배" 가설 검증.

### 4.1 셋업

- 1번째 ollama: 기본 service (port 11434)
- 2번째 ollama: `OLLAMA_HOST=127.0.0.1:11435 ollama serve` 로 별도 프로세스 띄움
- 같은 GPU, 같은 모델 (`gemma2:9b`) 양쪽에서 적재
- 라운드로빈 분산: `scripts/concurrencyTest2x.ts`

### 4.2 VRAM

- 단일 인스턴스 적재 후: 6.9GB / 16GB
- 2번째 인스턴스 적재 후: 13.8GB / 16GB
- OOM 없이 두 인스턴스 모두 적재 성공

### 4.3 결과 — 단일 대비 throughput **하락**

| N | 단일 인스턴스 | **2 인스턴스** | 변화 |
|---|---|---|---|
| 1 | 1.36 req/s | 1.31 | 비슷 |
| 4 | 1.40 | 1.08 | -23% |
| 8 | 1.43 | 1.10 | -23% |
| 16 | **1.45** | **1.13** | **-22%** |

**Endpoint 별 latency 차이** (N=16 기준):
- 11434: mean 6,383ms (8 req)
- 11435: mean 8,166ms (8 req)
- → GPU scheduler 가 한쪽을 우선시. 두 프로세스가 SM(Streaming Multiprocessor) 자원을 두고 시분할

### 4.4 결론 — **같은 GPU 2 인스턴스는 anti-pattern**

- VRAM 은 fit 했어도 **GPU compute 자원 경합** 으로 throughput 떨어짐
- context switch overhead + 한쪽 인스턴스 starvation 발생
- "2 인스턴스 = throughput 2배" 가설은 **별도 물리적 GPU** 에서만 성립
- 같은 GPU 에서 throughput 늘리려면 → vLLM 같은 batching 엔진 또는 OLLAMA_NUM_PARALLEL 증가 (검증 안 함)

---

## 5. DAU 한계 환산

prefetch 시나리오: 메모당 평균 3 prefetch 호출 × 30 메모/일 = **90 req/user/day** = 0.001 req/s 평균/user

운영 안정성 가정:
- Peak/Average ratio: **5x** (활동 시간대 집중)
- UX 마지노선: p95 ≤ 2s

### 5.1 모델별 DAU 천장

| 셋업 | UX OK throughput | 평균 가용 | DAU 한계 |
|---|---|---|---|
| **gemma4:e4b 단일** (현재 default) | ~3 req/s | 0.6 | **~580** |
| gemma2:9b 단일 | ~1.4 req/s | 0.28 | ~270 |
| gemma2:9b 2 인스턴스 | ~1.1 req/s | 0.22 | ~210 |

→ **로컬 4070 Ti Super 1대의 진짜 천장은 ~500-600 DAU** (gemma4:e4b 사용 시).
→ gemma2:9b 로 swap 시 정확도는 91.7% 로 떨어지고 throughput 도 절반 → 모든 면에서 손해.
→ **현재 셋업이 사실 우연히 최적**.

---

## 6. 클라우드 옵션 분석

DAU 600 이상으로 가야 할 때의 옵션. 가격은 2026-04 기준 추정값. 시점에 따라 변동.

### 6.1 GPU 렌탈 (dedicated)

| 티어 | 하드웨어 | $/hr | $/월 (24/7) | 우리 task 추정 throughput | $/1M req |
|---|---|---|---|---|---|
| 같은 급 | RTX 4090 (Vast.ai) | $0.30~0.50 | $220~365 | 3~4 req/s | $25~$40 |
| 한 단계 위 | L40S 48GB (RunPod) | $0.79 | $577 | 6~8 req/s | $32~$42 |
| 2 GPU 서버 | 2× 4090 (RunPod) | $0.80~1.20 | $584~876 | 7~10 req/s | $24~$35 |
| 최강 단일 | A100 80GB (RunPod) | $1.69 | $1,234 | 12~16 req/s | $30 |
| AWS L4 | g6.xlarge | $0.80 | $584 | ~3 req/s | $74 |
| AWS A10G | g5.xlarge | $1.00 | $730 | ~3.5 req/s | $80 |

→ **AWS / GCP 는 RunPod / Vast.ai 보다 2~3배 비쌈**. dev/실험에선 RunPod 부터.

### 6.2 Serverless inference

| 제공자 | 모델 | 단가 (in/out per M) | 우리 task 단가/req | $/1M req |
|---|---|---|---|---|
| **Groq** | gemma2-9b-it | $0.20 / $0.20 | $0.0000194 | **$19.40** |
| **Groq** | Llama 3.1 8B Instant | $0.05 / $0.08 | $0.00000536 | **$5.36** |
| Together AI | Llama 3.1 8B | $0.20 / $0.20 | $0.0000194 | $19.40 |
| DeepInfra | Llama 8B | ~$0.07 | $0.0000068 | $7 |
| OpenAI | gpt-4o-mini | $0.15 / $0.60 | $0.0000222 | $22 |

**Groq 가 cost-per-req 압도적**. Llama 8B 는 Groq 에서 가장 싸지만 우리 task 정확도 미검증 (qwen 7B 가 75% 였으니 Llama 8B 도 회귀 가능성). **gemma2-9b on Groq** 이 검증된 정확도와 일치하는 직접 swap 경로.

### 6.3 손익분기 (RunPod 24/7 vs Groq)

| Dedicated 옵션 | Groq 단가 | 손익분기 월 req | 손익분기 DAU |
|---|---|---|---|
| **L40S 24/7** ($577) vs gemma2-9b on Groq ($19.40/M) | $19.40/M | 29.7M | **~11,000 DAU** |
| L40S vs Llama 8B on Groq ($5.36/M) | $5.36/M | 107.6M | ~39,800 DAU |
| 2×4090 ($730) vs gemma2-9b on Groq | $19.40/M | 37.6M | ~13,900 DAU |
| A100 ($1,234) vs Llama 8B on Groq | $5.36/M | 230M | ~85,000 DAU |

### 6.4 시나리오별 월 비용 (prefetch 포함, 90 req/user/day)

| DAU | 월 req | gemma4 로컬 (전기) | gemma2 on Groq | Llama 8B on Groq | RunPod L40S 24/7 |
|---|---|---|---|---|---|
| 500 | 1.35M | $22 | $26 | $7 | $577 |
| 1,000 | 2.7M | 한계 도달 | $52 | $14 | $577 |
| 5,000 | 13.5M | 불가 | $262 | $72 | $577 (한계) |
| 10,000 | 27M | 불가 | $524 | $145 | (L40S 2대 $1,154) |
| 50,000 | 135M | 불가 | $2,619 | $724 | (L40S 5대 $2,885) |
| 100,000 | 270M | 불가 | $5,238 | $1,447 | (L40S 10대 $5,770) |

---

## 7. prefetch 아이디어 운영 함의

`llm-features-roadmap.md` §6 의 prefetch 아이디어 (사용자 타이핑 중 LLM 미리 호출) 의 운영 비용:

### 7.1 호출 수 폭증

prefetch 활성화 시 메모당 평균 호출 수:
- debounce 700ms + 최소 길이 10자 + 캐시 hit 일부 → **메모당 2~5 호출** (보수: 3)
- 30 메모/일 × 3 호출 = 90 req/user/day (위 계산의 기반)

### 7.2 dev 환경 OK, 운영은 serverless 필수

- 로컬 GPU 1대: ~580 DAU 가 천장 → 데모용으로만
- 운영 진입 시 **Groq 전환이 거의 강제**
  - DAU 1,000 prefetch 운영: Groq gemma2 $52/월, L40S $577/월 (11배)
  - DAU 10,000: Groq $524/월, L40S 2대 $1,154/월 (2.2배)

### 7.3 외부 API (OpenAI 등) 결합 시

- gpt-4o-mini 단가 $22/M req → 우리 task 에 ~$0.000022/req
- DAU 1,000 prefetch: $59/월
- DAU 10,000: $594/월
- → 여전히 self-host 보다는 쌈, 단 Groq 보다는 비쌈

---

## 8. DAU 별 최적 셋업 결정 트리

```
DAU 0 ─── 500 ─── 1,500 ─── 11,000 ─── 50,000+ →
        │         │           │
        ▼         ▼           ▼
  현재 GPU      Groq 단독    Dedicated 검토 시점
  (sunk)       (~$10~500/월)  Groq 그대로면 ~$2.6k+
```

| 단계 | 추천 | 비용 |
|---|---|---|
| **데모 / dev** | 현 4070 Ti Super + gemma4:e4b 단일 | $22/월 (전기) |
| **베타 (DAU 100~500)** | 동일 + peak 시 Groq fallback | $22 + $10 = $32/월 |
| **본격 (DAU 500~5,000)** | **Groq gemma2-9b 단독** | $26~$262/월 |
| **스케일 (DAU 5,000~50,000)** | Groq gemma2-9b 또는 Llama 8B (정확도 재검증 후) | $260~$2,620 / $70~$720 |
| **거대 (DAU 50,000+)** | dedicated GPU (RunPod L40S 클러스터) 검토 | $2,800+ |

→ **거의 모든 시나리오에서 Groq 가 답**. dedicated 자체 호스팅은 DAU 11,000 이상 + 24/7 평탄 트래픽이 보장될 때만 경제성.

→ **현재 4070 Ti Super 의 가치**: dev/데모 + Groq fallback 의 baseline. 운영 진입과 동시에 의미 사라짐. 이미 가진 자산이라 sunk cost 로 유지하는 정도.

---

## 9. 기타 고려사항

### 9.1 셋업 시간 / 운영 부담

| 항목 | RunPod 2×4090 | Groq |
|---|---|---|
| 셋업 시간 | 30분 (Ollama 설치, 모델 다운, proxy 설정) | 5분 (API key 받고 base URL 변경) |
| 정확도 보장 | gemma4/gemma2 어떤 모델이든 그대로 사용 | gemma2-9b 만 1:1 호환. Llama 8B 는 재검증 필수 |
| 레이턴시 (한국) | 도쿄 region 80~150ms 추가 | 미국 region 150~250ms 추가 (LPU 추론은 30ms 내외, 네트워크 dominant) |
| 데이터 주권 | RunPod 운영자 신뢰 필요 | Groq Cloud 운영자 신뢰 필요 |
| 운영 부담 | OS/모델 업데이트 본인 관리 | 0 (managed) |

### 9.2 Burst 처리

- **Groq**: 무제한 burst. 마케팅 캠페인 / 바이럴 시 트래픽 10x 폭증해도 즉시 처리
- **Dedicated**: 미리 GPU 더 사놔야 함. 자동 scale 어려움 (오케스트레이션 필요)

### 9.3 Idle 비용

- **Groq**: 0 (사용량 기반)
- **Dedicated**: 24/7 가동이면 idle 시간도 비용 부담. 8h/day on-demand 자동화하면 50~70% 절감 가능하지만 운영 복잡도 증가

---

## 10. 깨진 가설 정리

이번 측정 사이클에서 negative result 로 끝난 가설들. 다음에 같은 사고 패턴 반복하지 않기 위해.

| 가설 | 결과 | 깨진 이유 |
|---|---|---|
| "작은 모델 = throughput 2~3배" | **거짓** | output 17 토큰이라 per-request overhead (~300ms) 가 dominant. model size 차이 미미 |
| "Ollama auto-config 가 NUM_PARALLEL 자동 최적" | **부분 거짓** | 작은 모델일수록 NUM_PARALLEL 적게 할당하는 듯. 큰 모델이 오히려 더 병렬 |
| "같은 GPU 2 인스턴스 = 2x throughput" | **거짓 (anti-pattern)** | -22% throughput. compute 경합으로 오히려 손해 |
| "프롬프트는 모델 무관" | **거짓** | gemma 계열 의존. qwen 시리즈에서 정확도 41.7~75% 로 무너짐 |
| "dedicated GPU 가 cost-effective" | **거짓 in most cases** | DAU 11,000 이하면 Groq 가 압도적으로 쌈 |

---

## 11. 측정 도구

### scripts/concurrencyTest.ts

단일 endpoint 동시성 측정.

```bash
LLM_MODEL=gemma4:e4b LLM_TIMEOUT_MS=60000 npx tsx scripts/concurrencyTest.ts
```

N=1, 2, 4, 8, 16 으로 순차 측정. wall-clock / per-req latency / throughput / effective parallelism 추정.

### scripts/concurrencyTest2x.ts

다중 endpoint 라운드로빈.

```bash
# 2번째 ollama 띄우기
OLLAMA_HOST=127.0.0.1:11435 ollama serve &

# 라운드로빈 측정
LLM_BASE_URLS=http://localhost:11434,http://localhost:11435 LLM_MODEL=gemma2:9b npx tsx scripts/concurrencyTest2x.ts
```

---

## 12. 다음 액션 (선택)

1. **OLLAMA_NUM_PARALLEL=8 강제 + gemma4:e4b 재측정** — 현재 effective 1.5x 가 진짜 천장인지 검증
2. **vLLM 또는 SGLang 도입 시도** — 진짜 continuous batching. 동일 GPU 에서 throughput 3~5x 가능성 (단 Ollama 생태계에서 빠짐)
3. **Groq 정식 통합** — `llmClassifierAdapter` 의 endpoint/응답 schema 분기 추가. base URL 만 바꾸면 swap 가능하도록
4. **부하 테스트 자동화** — 트래픽 패턴 (peak factor 5x) 시뮬레이션 + 실 사용자 typing pattern 모방

위 모두 후순위. 현재 DAU 600 이하면 그냥 현 셋업 유지가 합리.
