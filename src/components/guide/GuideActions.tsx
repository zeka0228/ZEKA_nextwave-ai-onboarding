import { useAppState } from '../../app/AppStateProvider';
import { showToast } from '../ui/toastBus';

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
          showToast(`${cta} 시도! 실 구현 시 해당 내용으로 이동합니다.`);
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
