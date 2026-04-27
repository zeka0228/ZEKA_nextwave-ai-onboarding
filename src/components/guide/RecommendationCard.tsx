import { AnalysisReasonPanel } from '../ai/AnalysisReasonPanel';
import { AnalysisStatus } from '../ai/AnalysisStatus';
import { ClassificationBadge } from '../ai/ClassificationBadge';
import { GuideActions } from './GuideActions';

const analysisPoints = [
  "이번 메모의 주제: '회의 준비'",
  '키워드 분석: 회의 / 팀원 / 공유 등 업무 협업 맥락',
  '팀원 협업 활용 가능성이 높은 사용자',
];

const keywords = ['회의', '팀원', '공유'];

export function RecommendationCard() {
  return (
    <section className="card card-highlight recommendation-card" aria-labelledby="recommendation-title">
      <div className="card-header">
        <div>
          <p className="eyebrow">AI 가이드</p>
          <h2 id="recommendation-title">김개발01님, 환영합니다!</h2>
        </div>
        <AnalysisStatus state="done" />
      </div>

      <ClassificationBadge userType="직장인" confidence={0.87} />

      <AnalysisReasonPanel keywords={keywords} points={analysisPoints} />

      <div className="recommendation-summary">
        <p className="recommendation-headline">동료와 함께하면 더 효율적이에요!</p>
        <p className="recommendation-description">
          방금 만든 내용을 팀원에게 바로 공유할 수 있어요.
        </p>
      </div>

      <GuideActions cta="팀원 초대하기" />
    </section>
  );
}
