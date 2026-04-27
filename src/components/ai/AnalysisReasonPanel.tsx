interface AnalysisReasonPanelProps {
  keywords: string[];
  points: string[];
}

export function AnalysisReasonPanel({ keywords, points }: AnalysisReasonPanelProps) {
  return (
    <div className="analysis-reason">
      <p className="analysis-reason-title">AI 분석 결과</p>
      <ul className="analysis-points">
        {points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
      <div className="analysis-keywords">
        <span className="analysis-keywords-label">감지 키워드</span>
        <div className="keyword-chip-list">
          {keywords.map((keyword) => (
            <span key={keyword} className="keyword-chip">
              {keyword}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
