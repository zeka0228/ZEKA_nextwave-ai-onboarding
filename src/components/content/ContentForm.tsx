interface ContentFormProps {
  title: string;
  body: string;
  onTitleChange: (value: string) => void;
  onBodyChange: (value: string) => void;
}

export function ContentForm({
  title,
  body,
  onTitleChange,
  onBodyChange,
}: ContentFormProps) {
  return (
    <div className="form-grid">
      <label className="form-field">
        <span>제목</span>
        <input
          type="text"
          placeholder="회의 준비"
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
        />
      </label>
      <label className="form-field">
        <span>내용</span>
        <textarea
          rows={5}
          placeholder="팀원들과 공유할 내용을 정리해보세요"
          value={body}
          onChange={(event) => onBodyChange(event.target.value)}
        />
      </label>
    </div>
  );
}
