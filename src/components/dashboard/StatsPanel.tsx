import { StatCard } from './StatCard';

const stats = [
  { label: '총 투입 시간', value: '38h 45m', delta: '+12%', trend: 'up' as const, accent: 'time' as const },
  { label: '완료율', value: '75%', delta: '+5%', trend: 'up' as const, accent: 'completion' as const },
  { label: '알림 인가율', value: '10%', delta: '+1%', trend: 'up' as const, accent: 'notification' as const },
  { label: '전송률', value: '92%', delta: '+4%', trend: 'up' as const, accent: 'delivery' as const },
];

export function StatsPanel() {
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
