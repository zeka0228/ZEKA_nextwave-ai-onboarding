interface CompletedItem {
  id: string;
  date: string;
  label: string;
  kind: '팀 초대' | '회의' | '미팅' | '알림';
}

const completedItems: CompletedItem[] = [
  { id: '1', date: '04.24', label: '팀 초대 완료', kind: '팀 초대' },
  { id: '2', date: '04.25', label: '회의 (설계 검토)', kind: '회의' },
  { id: '3', date: '04.26', label: '미팅 (디자인 회의)', kind: '미팅' },
];

export function ContentList() {
  return (
    <section className="card" aria-labelledby="content-list-title">
      <div className="card-header">
        <div>
          <p className="eyebrow">Mock data</p>
          <h2 id="content-list-title">완료된 Task & Meeting</h2>
        </div>
      </div>
      <ul className="activity-list">
        {completedItems.map((item) => (
          <li key={item.id}>
            <span className="activity-date">{item.date}</span>
            <span className="activity-label">{item.label}</span>
            <span className="activity-kind">{item.kind}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
