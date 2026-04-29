import type { LlmUserType } from '../../../domain/types';

export const ALL_LABELS: LlmUserType[] = [
  '대학생',
  '직장인',
  '프리랜서',
  '팀 사용자',
  'unknown',
];

export interface CaseResult {
  id: string;
  expected: LlmUserType;
  predicted: LlmUserType | null; // null = adapter 실패 (timeout / parse error 등)
  confidence: number | null;
  latencyMs: number;
  difficulty: 'easy' | 'edge';
  errorMessage?: string;
}

export interface ClassMetric {
  label: LlmUserType;
  support: number; // 정답 라벨 등장 횟수
  predicted: number; // 예측된 횟수
  truePositive: number;
  falsePositive: number;
  falseNegative: number;
  precision: number;
  recall: number;
  f1: number;
}

export interface EvalSummary {
  total: number;
  succeeded: number; // adapter 호출 성공 (라벨 반환)
  failed: number; // adapter 실패
  accuracy: number; // 정답 / succeeded
  accuracyOverall: number; // 정답 / total (실패는 오답 처리)
  macroF1: number;
  perClass: ClassMetric[];
  confusionMatrix: number[][]; // [expected][predicted], unknown 포함
  confidenceMean: { correct: number; incorrect: number };
  latency: { mean: number; p50: number; p95: number; max: number };
  difficulty: {
    easy: { total: number; correct: number; accuracy: number };
    edge: { total: number; correct: number; accuracy: number };
  };
}

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(
    sortedAsc.length - 1,
    Math.ceil((p / 100) * sortedAsc.length) - 1,
  );
  return sortedAsc[Math.max(0, idx)];
}

export function computeSummary(results: CaseResult[]): EvalSummary {
  const total = results.length;
  const succeeded = results.filter((r) => r.predicted !== null).length;
  const failed = total - succeeded;

  const labelIndex = new Map<LlmUserType, number>();
  ALL_LABELS.forEach((l, i) => labelIndex.set(l, i));

  const matrix: number[][] = ALL_LABELS.map(() => ALL_LABELS.map(() => 0));
  const perClassCounts = new Map<
    LlmUserType,
    { tp: number; fp: number; fn: number; support: number; predicted: number }
  >();
  ALL_LABELS.forEach((l) =>
    perClassCounts.set(l, { tp: 0, fp: 0, fn: 0, support: 0, predicted: 0 }),
  );

  let correct = 0;
  const correctConfs: number[] = [];
  const incorrectConfs: number[] = [];
  const latencies: number[] = [];

  for (const r of results) {
    latencies.push(r.latencyMs);
    const expectedBucket = perClassCounts.get(r.expected)!;
    expectedBucket.support += 1;

    if (r.predicted === null) {
      // 실패는 모든 클래스에 대해 false negative 로 카운트(예측 없음)
      expectedBucket.fn += 1;
      continue;
    }

    const predictedBucket = perClassCounts.get(r.predicted)!;
    predictedBucket.predicted += 1;

    const ei = labelIndex.get(r.expected)!;
    const pi = labelIndex.get(r.predicted)!;
    matrix[ei][pi] += 1;

    if (r.predicted === r.expected) {
      correct += 1;
      expectedBucket.tp += 1;
      if (r.confidence !== null) correctConfs.push(r.confidence);
    } else {
      expectedBucket.fn += 1;
      predictedBucket.fp += 1;
      if (r.confidence !== null) incorrectConfs.push(r.confidence);
    }
  }

  const perClass: ClassMetric[] = ALL_LABELS.map((label) => {
    const c = perClassCounts.get(label)!;
    const precision = c.tp + c.fp === 0 ? 0 : c.tp / (c.tp + c.fp);
    const recall = c.tp + c.fn === 0 ? 0 : c.tp / (c.tp + c.fn);
    const f1 =
      precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
    return {
      label,
      support: c.support,
      predicted: c.predicted,
      truePositive: c.tp,
      falsePositive: c.fp,
      falseNegative: c.fn,
      precision,
      recall,
      f1,
    };
  });

  const macroF1 =
    perClass.reduce((acc, c) => acc + c.f1, 0) / Math.max(1, perClass.length);

  const sortedLatency = [...latencies].sort((a, b) => a - b);
  const mean = (xs: number[]) =>
    xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;

  const easy = results.filter((r) => r.difficulty === 'easy');
  const edge = results.filter((r) => r.difficulty === 'edge');
  const correctIn = (rs: CaseResult[]) =>
    rs.filter((r) => r.predicted === r.expected).length;

  return {
    total,
    succeeded,
    failed,
    accuracy: succeeded === 0 ? 0 : correct / succeeded,
    accuracyOverall: total === 0 ? 0 : correct / total,
    macroF1,
    perClass,
    confusionMatrix: matrix,
    confidenceMean: {
      correct: mean(correctConfs),
      incorrect: mean(incorrectConfs),
    },
    latency: {
      mean: mean(latencies),
      p50: percentile(sortedLatency, 50),
      p95: percentile(sortedLatency, 95),
      max: sortedLatency[sortedLatency.length - 1] ?? 0,
    },
    difficulty: {
      easy: {
        total: easy.length,
        correct: correctIn(easy),
        accuracy: easy.length === 0 ? 0 : correctIn(easy) / easy.length,
      },
      edge: {
        total: edge.length,
        correct: correctIn(edge),
        accuracy: edge.length === 0 ? 0 : correctIn(edge) / edge.length,
      },
    },
  };
}

export function formatReport(summary: EvalSummary): string {
  const lines: string[] = [];
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  const num = (x: number) => x.toFixed(3);

  lines.push('='.repeat(64));
  lines.push('LLM Classifier Eval Report');
  lines.push('='.repeat(64));
  lines.push(
    `Total: ${summary.total}  |  Succeeded: ${summary.succeeded}  |  Failed: ${summary.failed}`,
  );
  lines.push(
    `Accuracy (succeeded): ${pct(summary.accuracy)}   Accuracy (overall, fail=miss): ${pct(summary.accuracyOverall)}`,
  );
  lines.push(`Macro-F1: ${num(summary.macroF1)}`);
  lines.push(
    `Confidence  correct=${num(summary.confidenceMean.correct)}  incorrect=${num(summary.confidenceMean.incorrect)}`,
  );
  lines.push(
    `Latency ms  mean=${summary.latency.mean.toFixed(0)}  p50=${summary.latency.p50.toFixed(0)}  p95=${summary.latency.p95.toFixed(0)}  max=${summary.latency.max.toFixed(0)}`,
  );
  lines.push(
    `Difficulty  easy=${summary.difficulty.easy.correct}/${summary.difficulty.easy.total} (${pct(summary.difficulty.easy.accuracy)})  edge=${summary.difficulty.edge.correct}/${summary.difficulty.edge.total} (${pct(summary.difficulty.edge.accuracy)})`,
  );

  lines.push('');
  lines.push('Per-class metrics');
  lines.push('-'.repeat(64));
  lines.push('label           support  pred  TP  FP  FN  prec   recall  f1');
  for (const c of summary.perClass) {
    lines.push(
      `${c.label.padEnd(14)}  ${String(c.support).padStart(6)}  ${String(c.predicted).padStart(4)}  ${String(c.truePositive).padStart(2)}  ${String(c.falsePositive).padStart(2)}  ${String(c.falseNegative).padStart(2)}  ${num(c.precision)}  ${num(c.recall)}   ${num(c.f1)}`,
    );
  }

  lines.push('');
  lines.push('Confusion matrix (rows=expected, cols=predicted)');
  lines.push('-'.repeat(64));
  const header =
    '              ' + ALL_LABELS.map((l) => l.padStart(8)).join(' ');
  lines.push(header);
  ALL_LABELS.forEach((label, i) => {
    const row = summary.confusionMatrix[i]
      .map((n) => String(n).padStart(8))
      .join(' ');
    lines.push(`${label.padEnd(12)}  ${row}`);
  });

  return lines.join('\n');
}
