type StatAccent = 'time' | 'completion' | 'notification' | 'delivery';

interface StatCardProps {
  label: string;
  value: string;
  delta: string;
  trend: 'up' | 'down';
  accent: StatAccent;
}

export function StatCard({ label, value, delta, trend, accent }: StatCardProps) {
  return (
    <div className={`stat-card stat-accent-${accent}`}>
      <p className="stat-label">{label}</p>
      <strong className="stat-value">{value}</strong>
      <span className={`stat-delta stat-delta-${trend}`}>
        <span aria-hidden>{trend === 'up' ? '▲' : '▼'}</span> {delta}
      </span>
    </div>
  );
}
