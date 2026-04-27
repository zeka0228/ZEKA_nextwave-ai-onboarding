interface GuideActionsProps {
  cta: string;
}

export function GuideActions({ cta }: GuideActionsProps) {
  return (
    <div className="guide-actions">
      <button className="primary-button" type="button">
        {cta}
      </button>
      <button className="ghost-button" type="button">
        나중에 하기
      </button>
      <button className="ghost-button" type="button">
        다시 보지 않기
      </button>
    </div>
  );
}
