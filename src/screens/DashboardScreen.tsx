import { useState } from 'react';
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
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  return (
    <>
      <main className="dashboard-shell">
        <header className="dashboard-header">
          <div>
            <p className="eyebrow">NextWave AI Onboarding</p>
            <h1>이번 주 데이터</h1>
            <p className="dashboard-period">04.20 - 04.26</p>
          </div>
          <button
            className="primary-button"
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
          >
            새로 만들기
          </button>
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

      {isCreateModalOpen && (
        <ContentCreateModal onClose={() => setIsCreateModalOpen(false)} />
      )}
    </>
  );
}
