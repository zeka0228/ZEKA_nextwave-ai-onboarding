export function ContentCreateModal() {
  return (
    <section className="card card-wide" aria-labelledby="content-create-title">
      <div className="card-header">
        <div>
          <p className="eyebrow">Placeholder</p>
          <h2 id="content-create-title">ContentCreateModal</h2>
        </div>
        <span className="status-pill">Modal shell</span>
      </div>
      <p>
        메모/일정 작성 모달이 들어갈 영역입니다. Step 1에서는 입력, 분류,
        저장 로직을 구현하지 않습니다.
      </p>
    </section>
  );
}
