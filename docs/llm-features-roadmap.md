# LLM 활용 기능 로드맵

본 프로젝트에 LLM 을 효과적으로 적용할 수 있는 기능 아이디어 등록부.
각 항목은 위치 / 기능 / 예시 / 의도 / 영향 범위 / 운영 비용 함의 순으로 정리.

연관 문서:
- `classifier-evaluation.md` — 본 분류기 자체 (#3) 의 측정 결과
- `scaling-and-cost-analysis.md` — 호출 수 multiplier 가 큰 기능 (특히 #6) 의 비용 분석
- `implementation-extensions.md` §10 — 적용된 변경의 실 코드 위치

---

## 1. 추천 reasoning 동적 생성 (메모 인용)

- **위치**: `RecommendationCard` 의 description
- **기능**: 사용자 메모를 직접 인용해 추천 카드 문구를 LLM 으로 생성
- **예시**: "Q3 매출 보고서를 팀장님께 공유한다고 하셨네요 → 팀원이 같이 보면 검토가 빨라져요"
- **의도**: 데모 임팩트 가장 큼. 추천 로직 (`selectRecommendation`) 은 그대로, description 만 LLM 으로 갈아끼우면 1 swap point 추가로 끝남
- **건드릴 곳**: `domain/recommendation/selectRecommendation.ts` 출력 시점 또는 `RecommendationCard` 렌더 시점
- **호출 수 영향**: 메모당 +1 호출 (분류 호출 후속). 분류와 동일 단가
- **상태**: 미적용

## 2. CTA 컨텍스트 인자 자동 추출

- **위치**: `mockFeatureApi` 호출부 + `ContentList` 활동 항목
- **기능**: 메모에서 인물/날짜/대상을 뽑아 CTA 결과를 메모와 일관되게 채움
- **예시**: "팀원 초대 완료" → "팀장님, 김대리, 이과장 초대 메일 발송"
- **의도**: F-1~F-3 흐름이 살아있는 데모처럼 보임. mock layer 만 손대면 됨
- **건드릴 곳**: `services/mockFeatureApi.ts`, `applyCtaToDashboard.ts`
- **호출 수 영향**: CTA 수락당 +1 호출. 분류 호출보다 빈도 낮음
- **상태**: 미적용

## 3. 분류기 본업 — Ollama JSON mode + native API ✅ 적용 완료

- **위치**: `services/classifiers/llmClassifierAdapter.ts`
- **기능**: `mockClassifier` 키워드 매칭 → 진짜 LLM 분류
- **현재 모델**: `gemma4:e4b` (Ollama, native `/api/chat` + `think:false`)
- **측정 결과**: QA §C-3 100%, 152건 98.7%, latency p95 524ms (`classifier-evaluation.md` §5)
- **상태**: ✅ 1차 적용 완료 (2026-04-29)

후속 검토:
- self-consistency (3회 majority vote) 로 정확도 추가 보강 — 비용 3배 증가하므로 운영 진입 후 회귀 발견 시 검토
- 외부 API (Groq, OpenAI) 어댑터 분기 — `scaling-and-cost-analysis.md` §6 시나리오 진입 시

## 4. 누적 재분석 (`기능명세서` §4.4 / J-1)

- **위치**: `services/classifiers/classificationFlow.ts`
- **기능**: 3 번째 메모 시점에 메모 묶음 전체를 한 컨텍스트로 넘겨 복합 reasoning
- **예시**: "대학생인데 사이드로 프리랜서 패턴" 같은 복합 user_type 감지
- **의도**: §4.4 는 "선택" 으로 미뤄놨는데 LLM 이 붙으면 그제야 의미 생김. classification 누적 데이터 (`user.classifications`) 가 이미 있어서 prompt 빌더만 추가
- **건드릴 곳**: `domain/classification/classificationPrompt.ts` (확장), `runClassificationFlow`
- **호출 수 영향**: 3번째 메모마다 +1 호출. 입력 토큰 크게 증가 (메모 3개 합치므로 ~3x)
- **상태**: 미적용

## 5. 메모 enrichment (type/date/keywords 자동 채움)

- **위치**: `ContentCreateModal` 또는 분류 시점
- **기능**: 한 호출로 `{type, date, keywords, user_type, confidence}` 동시 추출
- **예시**: 사용자가 메모 탭에 "내일 9시 회의" 적으면 type=schedule + date 자동 추론, "이거 일정인가요?" 확인 한 줄
- **의도**: 분류 호출 1 회로 enrichment + classification 동시. ContentList 검색/필터 토대
- **건드릴 곳**: `components/content/ContentCreateModal.tsx`, `domain/types.ts` (LlmClassificationResult 확장)
- **호출 수 영향**: 0 (분류 호출 1회 안에 함께 처리). 출력 토큰 증가로 latency 약간 ↑
- **상태**: 미적용

## 6. 입력 중 prefetch 분류 ⚠️ 비용 검토 끝

- **위치**: `ContentCreateModal` 의 onChange 훅
- **기능**: 사용자 타이핑 중 debounce 700ms + 최소 10자 + 입력 해시 캐시 → 백그라운드 분류 호출. 생성 누르면 캐시된 결과 즉시 반환 → 체감 latency 0
- **의도**: 데모 임팩트 (와우 효과). 현재 ~500ms 분석 중 UX 자체를 없앨 수 있음
- **호출 수 영향**: 메모당 평균 3~5 호출 — 분류 호출 N배 증가
- **운영 비용**: 로컬 Ollama 1대 한계 ~580 DAU. 운영은 Groq serverless 전제. 상세 `scaling-and-cost-analysis.md` §7
- **건드릴 곳**: `ContentCreateModal.tsx`, `classifyContent.ts` (캐시 레이어), AbortController race 처리
- **상태**: 미적용. 운영 비용 multiplier 큼 — Groq 통합 후 재검토 권장

---

## 권장 진행 순서

### MVP+1 (분류기 활용 강화)
**3 (본업) ✅ → 1 (reasoning) → 5 (enrichment)**

3 은 적용 완료. 1과 5는 사용자 가치 vs 추가 호출 비용이 합리적 (분류 1회 안에 처리 가능 또는 +1 호출).

### MVP+2 (시간 여유 시)
**2 (CTA enrichment) → 4 (누적 재분석)**

2는 mock 만 건드리면 되고 사용자 가치 명확. 4는 분류 누적 데이터가 충분히 쌓인 후에 의미 있음.

### MVP+3 (스케일 검증 후)
**6 (prefetch — Groq 통합 후)**

6은 호출 수 multiplier 가 가장 커서 로컬 운영 부담 가장 큼. Groq serverless 통합 후 또는 dev 데모용으로 시도 가능.

---

## 호출 수 누적 영향 (DAU 1,000 기준 가정)

| 기능 | 호출 수 multiplier | DAU 1,000 일 호출 | 월 호출 (Groq gemma2-9b 비용) |
|---|---|---|---|
| 3 (분류만) | 1× (메모당 1회) | 30k | 900k ($17/월) |
| + 1 (추천 reasoning) | +1× | 60k | 1.8M ($35) |
| + 5 (enrichment) | 0× (3 와 통합) | 60k | 1.8M ($35) |
| + 2 (CTA 컨텍스트) | +0.3× | 69k | 2.07M ($40) |
| + 4 (누적 재분석) | +0.33× (3개 메모마다 1회) | 79k | 2.37M ($46) |
| + 6 (prefetch) | +3× | 169k | 5.07M ($98) |

→ **prefetch 가 가장 비싼 추가 기능**. 기능 1·2·4·5 모두 켜도 prefetch 단독보다 영향 작음.

---

## 모델 의존성 주의

기능 추가 시 프롬프트도 함께 수정하는 경우 (특히 1, 5) **모델별 정확도 재측정 필수**. `prompt-engineering.md` §7 의 모델 호환성 데이터 참고:
- gemma 계열만 본 프롬프트와 호환
- qwen 시리즈 swap 시 정확도 41.7~75% 로 회귀

→ 새 기능 추가는 **프롬프트 변경 → 152건 재측정 → 95% CI 확인** 사이클을 거칠 것.
