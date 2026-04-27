interface DriveItem {
  id: string;
  name: string;
  date: string;
  kind: 'file' | 'folder' | 'shared_link';
}

const driveItems: DriveItem[] = [
  { id: '1', name: '프로젝트개_계획_v0.3.pdf', date: '04.24', kind: 'file' },
  { id: '2', name: '김개_프로젝트_레퍼런스', date: '04.25', kind: 'folder' },
];

const kindLabel: Record<DriveItem['kind'], string> = {
  file: '파일',
  folder: '폴더',
  shared_link: '공유 링크',
};

export function ProjectDriveMock() {
  return (
    <section className="card" aria-labelledby="project-drive-title">
      <div className="card-header">
        <div>
          <p className="eyebrow">Mock data</p>
          <h2 id="project-drive-title">Project Drive</h2>
        </div>
      </div>
      <ul className="drive-list">
        {driveItems.map((item) => (
          <li key={item.id}>
            <span className={`drive-icon drive-icon-${item.kind}`} aria-hidden />
            <span className="drive-name">{item.name}</span>
            <span className="drive-meta">
              <span className="drive-kind">{kindLabel[item.kind]}</span>
              <span className="drive-date">{item.date}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
