import { useAppState } from '../../app/AppStateProvider';
import { StatCard } from './StatCard';

function formatMinutes(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

export function StatsPanel() {
  const { state } = useAppState();
  const metrics = state.dashboard.metrics;

  const stats = [
    {
      label: '총 투입 시간',
      value: formatMinutes(metrics.totalFocusMinutes),
      delta: '+12%',
      trend: 'up' as const,
      accent: 'time' as const,
    },
    {
      label: '완료율',
      value: `${metrics.completionRate}%`,
      delta: '+5%',
      trend: 'up' as const,
      accent: 'completion' as const,
    },
    {
      label: '알림 인가율',
      value: `${metrics.notificationAdoptionRate}%`,
      delta: '+1%',
      trend: 'up' as const,
      accent: 'notification' as const,
    },
    {
      label: '전송률',
      value: `${metrics.deliveryRate}%`,
      delta: '+4%',
      trend: 'up' as const,
      accent: 'delivery' as const,
    },
  ];

  return (
    <section className="stats-section" aria-label="이번 주 지표">
      <div className="stats-section-header">
        <p className="eyebrow">Mock data</p>
        <span className="stats-section-note">데모 지표</span>
      </div>
      <div className="stats-grid">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>
    </section>
  );
}
