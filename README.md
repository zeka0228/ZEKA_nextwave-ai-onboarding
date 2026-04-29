# NextWave AI Onboarding

사용자의 첫 메모/일정을 분석해 다음으로 써야 할 핵심 기능을 추천하는 AI 온보딩 프로토타입입니다.

[English README](README.en.md)

## 문제 정의

NextWave는 메모, 일정, 팀 협업, 공유, 알림 자동화 기능을 제공하는 생산성 SaaS 콘셉트입니다.

문제는 사용자가 기능을 전혀 못 쓰는 것이 아닙니다. 첫 메모나 일정은 만들 수 있지만, 그다음 어떤 행동을 해야 제품의 핵심 가치를 경험할 수 있는지 알지 못합니다.

이로 인해 팀 초대, 공유, 알림 자동화 같은 핵심 기능이 발견되지 못하고 온보딩 이후 활성화로 이어지지 않습니다.

## 해결 방향

NextWave AI Onboarding은 사용자의 입력이 발생한 순간에 맥락을 분석하고, 지금 가장 자연스러운 다음 행동을 추천합니다.

Impact: 수동적인 대시보드를 사용자의 다음 행동을 유도하는 제품 활성화 화면으로 전환합니다.

## 핵심 흐름

```text
메모 작성
  -> AI 분류
  -> 추천 카드
  -> CTA 실행
  -> 대시보드 반영
```

## 주요 기능

- 메모/일정 텍스트 기반 `user_type` 분류
- 사용자 맥락과 기능 사용 이력을 반영한 추천 시스템
- 분류 실패 또는 낮은 신뢰도에 대비한 fallback 로직
- CTA 실행 결과를 반영하는 데모 대시보드
- 팀 초대, 알림 규칙, 메모 공유 mock 플로우

## 기술 스택

- React + TypeScript
- Local state + `localStorage`
- LLM 분류기 (Ollama `gemma4:e4b`, native `/api/chat` + `think:false`)
- 오프라인 dev 용 mock classifier — `VITE_USE_MOCK_CLASSIFIER=true` 로 swap

LLM 분류기 측정값 (gemma4:e4b 기준): QA §C-3 12 케이스 100% 정답, 전체 152 케이스 98.7% 정답, latency p95 524ms. `npm run eval:classifier` 로 자동 측정 (상세는 `docs/classifier-evaluation.md`).

**모델 선택 근거**: 여러 로컬 모델 (`qwen2.5:3b/7b`, `gemma2:9b`) 을 검토했지만 정확도 또는 throughput 측면에서 만족스럽지 못했고, 운영 진입 시에는 자체 GPU 호스팅보다 API serverless (Groq) 가 비용 효율적임이 확인됨. 따라서 dev/test 환경에서는 추가 투자 없이 기존에 설치된 `gemma4:e4b` 를 그대로 사용. 상세 결정 과정은 `docs/scaling-and-cost-analysis.md` §0 참조.

## 데모 흐름

1. 사용자가 대시보드에 진입합니다.
2. `ContentCreateModal`에서 메모나 일정을 작성합니다.
3. LLM 분류기가 입력 내용을 분석합니다 (~500ms).
4. 시스템이 `user_type`, 신뢰도를 결정합니다.
5. 대시보드에 `RecommendationCard`가 표시됩니다.
6. 사용자가 CTA를 수락합니다.
7. mock 기능 사용 이력이 기록됩니다.
8. `StatsPanel`, `ContentList`, `ProjectDriveMock`이 갱신됩니다.

대시보드 수치는 데모용 mock 지표이며, 실제 비즈니스 개선 수치로 표현하지 않습니다.

## 왜 AI / LLM인가

규칙 기반 온보딩만으로는 충분하지 않습니다. 사용자의 의도는 정해진 선택지가 아니라 자유로운 자연어 입력에 담깁니다.

예를 들어 "프로젝트"라는 단어는 학교 과제, 클라이언트 납품, 회사 업무, 팀 스프린트 모두를 의미할 수 있습니다.

LLM 방식의 분류기는 긴 설정 폼 없이도 문맥을 해석할 수 있습니다. 본 프로젝트는 동일한 `ClassifierAdapter` 인터페이스 뒤에 LLM 어댑터와 mock 어댑터를 모두 두어, 프로바이더 교체 / 오프라인 dev / 자동 회귀 측정을 모두 지원합니다.

## 문서

### 사양 / 구현
- [기능 명세서 v0.4 revised](docs/기능명세서_v0.4_revised.md)
- [구현 계획서](docs/implementation-plan.md)
- [구현 변경/추가 사항](docs/implementation-extensions.md)
- [LLM 연동 가이드](docs/llm-integration-guide.md)

### LLM 분류기 — 측정 / 의사결정
- [분류기 평가](docs/classifier-evaluation.md) — 평가셋·메트릭·측정 이력
- [프롬프트 엔지니어링](docs/prompt-engineering.md) — 프롬프트 설계 의사결정
- [운영 / 비용 분석](docs/scaling-and-cost-analysis.md) — 동시성·DAU 한계·클라우드 비교
- [LLM 기능 로드맵](docs/llm-features-roadmap.md) — 향후 LLM 활용 아이디어

### QA / 디자인
- [QA 시나리오](docs/qa-scenarios.md) / [현행 빌드 QA](docs/qa-scenarios-current.md)
- [와이어프레임](docs/와이어프레임.png)
