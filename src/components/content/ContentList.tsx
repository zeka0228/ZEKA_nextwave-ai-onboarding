import { useAppState } from '../../app/AppStateProvider';
import type { CompletedWork, Content } from '../../domain/types';

const kindLabel: Record<CompletedWork['kind'], string> = {
  task: '업무',
  meeting: '미팅',
  notification: '알림',
  team_invite: '팀 초대',
};

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}.${day}`;
}

function formatScheduleDate(value: string): string {
  // YYYY-MM-DD → MM.DD
  const parts = value.split('-');
  if (parts.length === 3) return `${parts[1]}.${parts[2]}`;
  return value;
}

function MemoSection({ memos }: { memos: Content[] }) {
  return (
    <div className="content-subsection">
      <h3>작성된 메모</h3>
      {memos.length === 0 ? (
        <p className="content-empty">아직 작성된 메모가 없어요.</p>
      ) : (
        <ul className="activity-list">
          {memos.map((memo) => (
            <li key={memo.id}>
              <span className="activity-date">{formatTimestamp(memo.createdAt)}</span>
              <span className="activity-label">{memo.title}</span>
              <span className="activity-kind">메모</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ScheduleSection({ schedules }: { schedules: Content[] }) {
  return (
    <div className="content-subsection">
      <h3>작성된 일정</h3>
      {schedules.length === 0 ? (
        <p className="content-empty">아직 작성된 일정이 없어요.</p>
      ) : (
        <ul className="activity-list">
          {schedules.map((schedule) => (
            <li key={schedule.id}>
              <span className="activity-date">
                {schedule.date
                  ? formatScheduleDate(schedule.date)
                  : formatTimestamp(schedule.createdAt)}
              </span>
              <span className="activity-label">{schedule.title}</span>
              <span className="activity-kind">일정</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CompletedSection({ works }: { works: CompletedWork[] }) {
  return (
    <div className="content-subsection">
      <h3>완료된 Task &amp; Meeting</h3>
      {works.length === 0 ? (
        <p className="content-empty">CTA 를 수락하면 여기에 활동이 쌓여요.</p>
      ) : (
        <ul className="activity-list">
          {works.map((item) => (
            <li key={item.id}>
              <span className="activity-date">{formatTimestamp(item.createdAt)}</span>
              <span className="activity-label">{item.label}</span>
              <span className="activity-kind">{kindLabel[item.kind]}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ContentList() {
  const { state } = useAppState();
  const memos = [...state.contents]
    .filter((c) => c.type === 'memo')
    .sort((a, b) => b.createdAt - a.createdAt);
  const schedules = [...state.contents]
    .filter((c) => c.type === 'schedule')
    .sort((a, b) => b.createdAt - a.createdAt);
  const completed = [...state.dashboard.completedWorks].sort(
    (a, b) => b.createdAt - a.createdAt,
  );

  return (
    <section className="card" aria-labelledby="content-list-title">
      <div className="card-header">
        <div>
          <p className="eyebrow">활동 내역</p>
          <h2 id="content-list-title">메모 / 일정 / 완료된 활동</h2>
        </div>
      </div>
      <MemoSection memos={memos} />
      <ScheduleSection schedules={schedules} />
      <CompletedSection works={completed} />
    </section>
  );
}
