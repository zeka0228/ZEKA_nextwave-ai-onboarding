import { useAppState } from '../../app/AppStateProvider';
import type { ProjectDriveItem } from '../../domain/types';

const kindLabel: Record<ProjectDriveItem['kind'], string> = {
  file: '파일',
  folder: '폴더',
  shared_link: '공유 링크',
};

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}.${day}`;
}

export function ProjectDriveMock() {
  const { state } = useAppState();
  const items = [...state.dashboard.projectDriveItems].sort(
    (a, b) => b.createdAt - a.createdAt,
  );

  return (
    <section className="card" aria-labelledby="project-drive-title">
      <div className="card-header">
        <div>
          <p className="eyebrow">Mock data</p>
          <h2 id="project-drive-title">Project Drive</h2>
        </div>
      </div>
      {items.length === 0 ? (
        <p>공유된 자료가 없어요.</p>
      ) : (
        <ul className="drive-list">
          {items.map((item) => (
            <li key={item.id}>
              <span className={`drive-icon drive-icon-${item.kind}`} aria-hidden />
              <span className="drive-name">{item.name}</span>
              <span className="drive-meta">
                <span className="drive-kind">{kindLabel[item.kind]}</span>
                <span className="drive-date">{formatDate(item.createdAt)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
