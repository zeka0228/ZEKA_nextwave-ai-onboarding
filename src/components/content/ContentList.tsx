import { useAppState } from '../../app/AppStateProvider';
import type { CompletedWork } from '../../domain/types';

const kindLabel: Record<CompletedWork['kind'], string> = {
  task: '업무',
  meeting: '미팅',
  notification: '알림',
  team_invite: '팀 초대',
};

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}.${day}`;
}

export function ContentList() {
  const { state } = useAppState();
  const items = [...state.dashboard.completedWorks].sort(
    (a, b) => b.createdAt - a.createdAt,
  );

  return (
    <section className="card" aria-labelledby="content-list-title">
      <div className="card-header">
        <div>
          <p className="eyebrow">Mock data</p>
          <h2 id="content-list-title">완료된 Task & Meeting</h2>
        </div>
      </div>
      {items.length === 0 ? (
        <p>아직 완료된 활동이 없어요.</p>
      ) : (
        <ul className="activity-list">
          {items.map((item) => (
            <li key={item.id}>
              <span className="activity-date">{formatDate(item.createdAt)}</span>
              <span className="activity-label">{item.label}</span>
              <span className="activity-kind">{kindLabel[item.kind]}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
