type AnalysisState = 'idle' | 'analyzing' | 'done';

interface AnalysisStatusProps {
  state: AnalysisState;
}

const labelMap: Record<AnalysisState, string> = {
  idle: '대기 중',
  analyzing: 'AI 분석 중...',
  done: 'AI 분석 완료',
};

export function AnalysisStatus({ state }: AnalysisStatusProps) {
  if (state === 'idle') return null;

  return (
    <span className={`analysis-status analysis-status-${state}`} role="status">
      <span className="analysis-status-dot" aria-hidden />
      {labelMap[state]}
    </span>
  );
}
