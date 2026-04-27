import { useAppState } from '../../app/AppStateProvider';

interface GuideActionsProps {
  cta: string;
}

export function GuideActions({ cta }: GuideActionsProps) {
  const { actions } = useAppState();

  return (
    <div className="guide-actions">
      <button
        className="primary-button"
        type="button"
        onClick={() => {
          void actions.acceptCta();
        }}
      >
        {cta}
      </button>
      <button
        className="ghost-button"
        type="button"
        onClick={actions.dismissGuide}
      >
        나중에 하기
      </button>
      <button
        className="ghost-button"
        type="button"
        onClick={actions.neverShowGuide}
      >
        다시 보지 않기
      </button>
    </div>
  );
}
