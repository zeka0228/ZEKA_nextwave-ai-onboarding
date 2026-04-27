# NextWave AI Onboarding

An AI onboarding prototype that analyzes a user's first memo or schedule and recommends the next high-value product action.

[한국어 README](README.md)

## Problem Definition

NextWave is a productivity SaaS concept with memo, schedule, team collaboration, sharing, and notification automation features.

The problem is not that users cannot use the product at all. They can create their first memo or schedule, but they often do not know which action should follow to reach the product's core value.

As a result, key features such as team invite, sharing, and notification automation remain undiscovered after onboarding.

## Solution

NextWave AI Onboarding analyzes user input at the moment intent becomes visible and recommends the most relevant next action.

Impact: it turns a passive dashboard into a product activation surface that guides users toward valuable feature usage.

## Core Flow

```text
memo creation
  -> AI classification
  -> recommendation card
  -> CTA
  -> dashboard update
```

## Key Features

- `user_type` classification from memo or schedule text
- Context-aware recommendations based on user type and feature history
- Fallback logic for uncertain or failed classification
- Demo dashboard that reflects accepted CTA actions
- Mock flows for team invite, notification rules, and note sharing

## Tech Stack

- React + TypeScript
- Local state + `localStorage`
- Mock classifier for MVP speed
- Classifier adapter structure for future LLM/Gemma integration

The MVP starts with a mock classifier to validate the full product flow quickly. A real LLM or Gemma classifier can later be connected behind the same `classifyContent` interface.

## Demo Flow

1. The user opens the dashboard.
2. The user creates a memo or schedule in `ContentCreateModal`.
3. The mock classifier analyzes the input.
4. The system resolves `user_type`, confidence, and reasoning.
5. `RecommendationCard` appears on the dashboard.
6. The user accepts the CTA.
7. Mock feature usage is recorded.
8. `StatsPanel`, `ContentList`, and `ProjectDriveMock` update.

Dashboard numbers are demo-only mock indicators, not real business improvement metrics.

## Why AI / LLM

Rule-based onboarding is not enough because user intent is expressed in free-form text.

For example, "project" can mean a school assignment, client delivery, internal company task, or team sprint depending on context.

An LLM-style classifier can interpret context without forcing users through long setup forms. This project starts with a mock classifier for MVP speed while keeping the architecture ready for real LLM integration.

## Documentation

- [Feature Specification v0.4 revised](docs/기능명세서_v0.4_revised.md)
- [Implementation Plan](docs/implementation-plan.md)
- [Wireframe](docs/와이어프레임.png)
