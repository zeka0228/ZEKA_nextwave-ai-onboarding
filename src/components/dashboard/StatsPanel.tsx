export function StatsPanel() {
  return (
    <section className="card" aria-labelledby="stats-title">
      <div className="card-header">
        <div>
          <p className="eyebrow">Mock data</p>
          <h2 id="stats-title">StatsPanel</h2>
        </div>
      </div>
      <div className="stat-list">
        <div>
          <span>총 투입 시간</span>
          <strong>--</strong>
        </div>
        <div>
          <span>완료율</span>
          <strong>--</strong>
        </div>
        <div>
          <span>전송률</span>
          <strong>--</strong>
        </div>
      </div>
    </section>
  );
}
