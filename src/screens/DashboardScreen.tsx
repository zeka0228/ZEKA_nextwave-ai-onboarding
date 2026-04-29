import { useAppState } from '../app/AppStateProvider';
import { ContentCreateModal } from '../components/content/ContentCreateModal';
import { ContentList } from '../components/content/ContentList';
import { ProjectDriveMock } from '../components/dashboard/ProjectDriveMock';
import { StatsPanel } from '../components/dashboard/StatsPanel';
import { RecommendationCard } from '../components/guide/RecommendationCard';

const legendItems = [
  { id: 'time', label: '총 투입 시간' },
  { id: 'completion', label: '완료율' },
  { id: 'notification', label: '알림 인가율' },
  { id: 'delivery', label: '전송률' },
  { id: 'confidence', label: 'AI 신뢰도' },
  { id: 'analysis', label: 'AI 분석 포인트' },
];

export function DashboardScreen() {
  const { state, actions } = useAppState();

  return (
    <>
      <main className="dashboard-shell">
        <header className="dashboard-header">
          <div>
            <p className="eyebrow">NextWave AI Onboarding</p>
            <h1>이번 주 데이터</h1>
            <p className="dashboard-period">{state.dashboard.weekRangeLabel}</p>
          </div>
          <div className="dashboard-header-actions">
            <button
              className="ghost-button"
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    '모든 데이터를 초기화합니다.\n' +
                      '\n' +
                      '· 작성된 메모 / 일정\n' +
                      '· 분류 이력 / 추천 카드\n' +
                      '· 완료된 활동 / 대시보드 지표\n' +
                      '· "나중에 하기" / "다시 보지 않기" 기록\n' +
                      '\n' +
                      '계속할까요?',
                  )
                ) {
                  actions.resetState();
                }
              }}
            >
              초기화
            </button>
            <button
              className="primary-button"
              type="button"
              onClick={actions.openCreateModal}
            >
              새로 만들기
            </button>
          </div>
        </header>

        <RecommendationCard />

        <StatsPanel />

        <section className="dashboard-grid" aria-label="활동 및 자료">
          <ContentList />
          <ProjectDriveMock />
        </section>

        <aside className="dashboard-key" aria-label="범례">
          <h2>Key</h2>
          <ul>
            {legendItems.map((item) => (
              <li key={item.id}>
                <span className={`key-swatch key-${item.id}`} aria-hidden />
                {item.label}
              </li>
            ))}
          </ul>
        </aside>
      </main>

      {state.ui.isCreateModalOpen && <ContentCreateModal />}
    </>
  );
}
