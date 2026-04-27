export function RecommendationCard() {
  return (
    <section className="card card-highlight" aria-labelledby="recommendation-title">
      <div className="card-header">
        <div>
          <p className="eyebrow">Placeholder</p>
          <h2 id="recommendation-title">RecommendationCard</h2>
        </div>
        <span className="status-pill">AI guide</span>
      </div>
      <p>
        user_type 분석 결과와 추천 CTA가 표시될 영역입니다. 추천 로직과 CTA
        동작은 이후 단계에서 연결합니다.
      </p>
      <button className="secondary-button" type="button">
        CTA placeholder
      </button>
    </section>
  );
}
