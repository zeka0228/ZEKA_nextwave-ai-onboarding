import { ContentForm } from './ContentForm';
import { ContentTypeTabs } from './ContentTypeTabs';

interface ContentCreateModalProps {
  onClose: () => void;
}

export function ContentCreateModal({ onClose }: ContentCreateModalProps) {
  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="content-create-title"
      onClick={onClose}
    >
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">메모 작성</p>
            <h2 id="content-create-title">새 메모 만들기</h2>
          </div>
          <button
            className="ghost-button modal-close"
            type="button"
            onClick={onClose}
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        <ContentTypeTabs activeType="memo" />
        <ContentForm />

        <div className="modal-footer">
          <button className="ghost-button" type="button" onClick={onClose}>
            취소
          </button>
          <button className="primary-button" type="button">
            생성 완료
          </button>
        </div>
      </div>
    </div>
  );
}
