import { readFileSync } from 'node:fs';
import { evalCases } from '../src/services/classifiers/__eval__/testset';

const path = process.argv[2] ?? 'eval-result-150-full.json';
const data = JSON.parse(readFileSync(path, 'utf8')) as {
  results: Array<{ id: string; expected: string; predicted: string | null; confidence: number | null; latencyMs: number; errorMessage?: string }>;
};

const fails = data.results.filter((r) => r.predicted !== r.expected);
console.log(`오답 ${fails.length}건:\n`);
for (const r of fails) {
  const c = evalCases.find((e) => e.id === r.id);
  console.log(`[${r.id}] expected=${r.expected} → predicted=${r.predicted} conf=${r.confidence} ${Math.round(r.latencyMs)}ms`);
  if (c) {
    console.log(`  type=${c.input.type}  title="${c.input.title}"  content="${c.input.content}"`);
    console.log(`  note: ${c.note ?? '-'}  difficulty: ${c.difficulty}`);
  }
  if (r.errorMessage) console.log(`  err: ${r.errorMessage}`);
  console.log('');
}
