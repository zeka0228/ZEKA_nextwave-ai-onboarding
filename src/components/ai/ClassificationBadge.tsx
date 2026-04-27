interface ClassificationBadgeProps {
  userType: string;
  confidence: number;
}

export function ClassificationBadge({ userType, confidence }: ClassificationBadgeProps) {
  return (
    <div className="classification-badge" aria-label={`사용자 유형 ${userType}`}>
      <span className="classification-label">사용자 유형</span>
      <strong className="classification-type">{userType}</strong>
      <span className="classification-divider" aria-hidden>·</span>
      <span className="classification-confidence">신뢰도 {confidence.toFixed(2)}</span>
    </div>
  );
}
