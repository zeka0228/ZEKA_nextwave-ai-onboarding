import { useState } from 'react';
import { useAppState } from '../../app/AppStateProvider';
import type { ContentType } from '../../domain/types';
import { ContentForm } from './ContentForm';
import { ContentTypeTabs } from './ContentTypeTabs';

export function ContentCreateModal() {
  const { actions } = useAppState();
  const [type, setType] = useState<ContentType>('memo');
  const [title, setTitle] = useState('회의 준비');
  const [body, setBody] = useState('팀원들과 공유할 내용 정리');

  const isValid = title.trim().length > 0 && body.trim().length > 0;

  const handleSubmit = () => {
    if (!isValid) return;
    void actions.submitContent({
      type,
      title: title.trim(),
      body: body.trim(),
    });
  };

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="content-create-title"
      onClick={actions.closeCreateModal}
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
            onClick={actions.closeCreateModal}
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        <ContentTypeTabs activeType={type} onChange={setType} />
        <ContentForm
          title={title}
          body={body}
          onTitleChange={setTitle}
          onBodyChange={setBody}
        />

        <div className="modal-footer">
          <button
            className="ghost-button"
            type="button"
            onClick={actions.closeCreateModal}
          >
            취소
          </button>
          <button
            className="primary-button"
            type="button"
            onClick={handleSubmit}
            disabled={!isValid}
          >
            생성 완료
          </button>
        </div>
      </div>
    </div>
  );
}
