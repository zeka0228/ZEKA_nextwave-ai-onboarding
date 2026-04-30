import { useAppState } from '../../app/AppStateProvider';
import { AnalysisReasonPanel } from '../ai/AnalysisReasonPanel';
import { AnalysisStatus } from '../ai/AnalysisStatus';
import { ClassificationBadge } from '../ai/ClassificationBadge';
import { GuideActions } from './GuideActions';

export function RecommendationCard() {
  const { state } = useAppState();

  if (state.ui.isAnalyzing) {
    return (
      <section
        className="card card-highlight recommendation-card"
        aria-labelledby="recommendation-title"
      >
        <div className="card-header">
          <div>
            <p className="eyebrow">AI 가이드</p>
            <h2 id="recommendation-title">
              {state.user.displayName}님, 환영합니다!
            </h2>
          </div>
          <AnalysisStatus state="analyzing" />
        </div>
        <p className="recommendation-description">
          방금 작성하신 내용을 분석하고 있어요. 잠시만 기다려주세요.
        </p>
      </section>
    );
  }

  const classification = state.activeClassification;
  const recommendation = state.activeRecommendation;

  if (!classification || !recommendation) {
    return (
      <section
        className="card card-highlight recommendation-card"
        aria-labelledby="recommendation-title"
      >
        <div className="card-header">
          <div>
            <p className="eyebrow">AI 가이드</p>
            <h2 id="recommendation-title">
              {state.user.displayName}님, 환영합니다!
            </h2>
          </div>
        </div>
        <p className="recommendation-description">
          {state.ui.analysisError
            ? `분석 중 문제가 발생했어요: ${state.ui.analysisError}`
            : '메모나 일정을 작성하면 맞춤 추천을 보여드릴게요.'}
        </p>
      </section>
    );
  }

  const lastContent = state.contents[state.contents.length - 1];
  const points = [
    lastContent ? `이번 메모의 주제: '${lastContent.title}'` : null,
    classification.reasoning ??
      `${classification.userType} 맥락이 감지되었습니다.`,
    `추천 가이드: ${recommendation.title}`,
  ].filter((point): point is string => Boolean(point));

  return (
    <section
      className="card card-highlight recommendation-card"
      aria-labelledby="recommendation-title"
    >
      <div className="card-header">
        <div>
          <p className="eyebrow">AI 가이드</p>
          <h2 id="recommendation-title">
            {state.user.displayName}님, 환영합니다!
          </h2>
        </div>
        <AnalysisStatus state="done" />
      </div>

      <ClassificationBadge
        userType={classification.userType}
        confidence={classification.confidence}
      />

      {classification.source === 'history_fallback' && (
        <div className="fallback-trace fallback-trace-success" role="alert">
          <span className="trace-step trace-step-fail">
            <span className="trace-step-tag">실패</span>
            <span className="trace-step-text">
              LLM 분류 실패
              {classification.fallbackReason
                ? ` (${classification.fallbackReason})`
                : ''}
            </span>
          </span>
          <span className="trace-arrow" aria-hidden>
            →
          </span>
          <span className="trace-step trace-step-success">
            <span className="trace-step-tag">성공</span>
            <span className="trace-step-text">사용기록 조회로 대체</span>
          </span>
        </div>
      )}

      {classification.source === 'default_fallback' && (
        <div className="fallback-trace fallback-trace-fail" role="alert">
          <span className="trace-step trace-step-fail">
            <span className="trace-step-tag">실패</span>
            <span className="trace-step-text">
              LLM 분류 실패
              {classification.fallbackReason
                ? ` (${classification.fallbackReason.replace(
                    / \+ 사용기록 부족$/,
                    '',
                  )})`
                : ''}
            </span>
          </span>
          <span className="trace-arrow" aria-hidden>
            →
          </span>
          <span className="trace-step trace-step-fail">
            <span className="trace-step-tag">실패</span>
            <span className="trace-step-text">
              사용기록 부족 → 디폴트 '개인 사용자'
            </span>
          </span>
        </div>
      )}

      <AnalysisReasonPanel
        keywords={classification.keywords}
        points={points}
      />

      <div className="recommendation-summary">
        <p className="recommendation-headline">{recommendation.title}</p>
        <p className="recommendation-description">{recommendation.description}</p>
      </div>

      <GuideActions cta={recommendation.cta} />
    </section>
  );
}
