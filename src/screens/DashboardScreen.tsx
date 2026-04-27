import { ContentCreateModal } from '../components/content/ContentCreateModal';
import { ContentList } from '../components/content/ContentList';
import { ProjectDriveMock } from '../components/dashboard/ProjectDriveMock';
import { StatsPanel } from '../components/dashboard/StatsPanel';
import { RecommendationCard } from '../components/guide/RecommendationCard';

export function DashboardScreen() {
  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">NextWave AI Onboarding</p>
          <h1>Dashboard</h1>
        </div>
        <button className="primary-button" type="button">
          새로 만들기
        </button>
      </header>

      <section className="dashboard-grid" aria-label="MVP dashboard sections">
        <ContentCreateModal />
        <RecommendationCard />
        <StatsPanel />
        <ContentList />
        <ProjectDriveMock />
      </section>
    </main>
  );
}
