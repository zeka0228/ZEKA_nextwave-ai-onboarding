export function ContentForm() {
  return (
    <div className="form-grid">
      <label className="form-field">
        <span>제목</span>
        <input type="text" placeholder="회의 준비" defaultValue="회의 준비" />
      </label>
      <label className="form-field">
        <span>내용</span>
        <textarea
          rows={5}
          placeholder="팀원들과 공유할 내용을 정리해보세요"
          defaultValue="팀원들과 공유할 내용 정리"
        />
      </label>
    </div>
  );
}
