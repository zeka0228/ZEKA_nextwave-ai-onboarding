/**
 * Ollama 동시성/throughput 측정 스크립트.
 * N개 요청을 동시에 발사 → 개별 latency + wall-clock + throughput 측정.
 *
 * 사용:
 *   npx tsx scripts/concurrencyTest.ts
 *   LLM_MODEL=qwen2.5:3b npx tsx scripts/concurrencyTest.ts
 *
 * 의미:
 *  - N=1 vs N=K 의 p95 latency 비교 → effective parallelism 추정
 *  - throughput (req/s) 곡선 → GPU 의 처리 한계
 */
import { performance } from 'node:perf_hooks';

const BASE_URL = process.env.LLM_BASE_URL ?? 'http://localhost:11434';
const MODEL = process.env.LLM_MODEL ?? 'gemma4:e4b';
const TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS) || 120_000;

const LEVELS = [1, 2, 4, 8, 16];

const TEST_PROMPT = `당신은 사용자의 생산성 도구 사용 맥락을 분석하는 분류기입니다.
사용자가 작성한 메모 또는 일정의 제목과 내용을 보고 user_type 을 선택합니다.

[user_type]
- 대학생, 직장인, 프리랜서, 팀 사용자, unknown

[입력]
제목: 주간 회의록 정리
내용: 4월 KPI 리뷰
타입: schedule

[출력]
{"user_type":"...","confidence":0.0}`;

interface CallResult {
  startMs: number;
  endMs: number;
  latencyMs: number;
  ok: boolean;
  status?: number;
  errorMessage?: string;
  evalCount?: number;
  promptEvalCount?: number;
}

async function callLlm(t0: number): Promise<CallResult> {
  const startMs = performance.now() - t0;
  const start = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        stream: false,
        think: false,
        format: 'json',
        options: { temperature: 0 },
        messages: [
          { role: 'system', content: 'You are a strict JSON classifier. Respond with a single JSON object only.' },
          { role: 'user', content: TEST_PROMPT },
        ],
      }),
      signal: controller.signal,
    });

    const body = (await res.json()) as { eval_count?: number; prompt_eval_count?: number };
    const latencyMs = performance.now() - start;
    return {
      startMs,
      endMs: performance.now() - t0,
      latencyMs,
      ok: res.ok,
      status: res.status,
      evalCount: body.eval_count,
      promptEvalCount: body.prompt_eval_count,
    };
  } catch (err) {
    return {
      startMs,
      endMs: performance.now() - t0,
      latencyMs: performance.now() - start,
      ok: false,
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.ceil((p / 100) * sortedAsc.length) - 1);
  return sortedAsc[Math.max(0, idx)];
}

interface WaveSummary {
  n: number;
  wallClockMs: number;
  throughputRps: number;
  successCount: number;
  failCount: number;
  latencyMin: number;
  latencyP50: number;
  latencyMean: number;
  latencyP95: number;
  latencyMax: number;
  startSpreadMs: number;
}

async function runWave(n: number): Promise<WaveSummary> {
  console.log(`\n=== Concurrency ${n} ===`);
  const t0 = performance.now();
  const promises = Array.from({ length: n }, () => callLlm(t0));
  const results = await Promise.all(promises);
  const wallClockMs = performance.now() - t0;

  const successResults = results.filter((r) => r.ok);
  const failResults = results.filter((r) => !r.ok);
  const latencies = successResults.map((r) => r.latencyMs).sort((a, b) => a - b);
  const starts = results.map((r) => r.startMs);
  const startSpreadMs = Math.max(...starts) - Math.min(...starts);

  const mean = latencies.length === 0 ? 0 : latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const summary: WaveSummary = {
    n,
    wallClockMs,
    throughputRps: successResults.length / (wallClockMs / 1000),
    successCount: successResults.length,
    failCount: failResults.length,
    latencyMin: latencies[0] ?? 0,
    latencyP50: percentile(latencies, 50),
    latencyMean: mean,
    latencyP95: percentile(latencies, 95),
    latencyMax: latencies[latencies.length - 1] ?? 0,
    startSpreadMs,
  };

  console.log(
    `  wall ${summary.wallClockMs.toFixed(0)}ms | throughput ${summary.throughputRps.toFixed(2)} req/s | success ${successResults.length}/${n}`,
  );
  console.log(
    `  latency  min ${summary.latencyMin.toFixed(0)} | p50 ${summary.latencyP50.toFixed(0)} | mean ${summary.latencyMean.toFixed(0)} | p95 ${summary.latencyP95.toFixed(0)} | max ${summary.latencyMax.toFixed(0)} ms`,
  );
  console.log(`  start-spread ${summary.startSpreadMs.toFixed(0)}ms (요청 발사 간격)`);
  if (failResults.length > 0) {
    console.log('  failures:');
    for (const f of failResults.slice(0, 5)) {
      console.log(`    - ${f.status ?? '?'} ${f.errorMessage ?? 'unknown'}`);
    }
  }
  return summary;
}

async function warmup() {
  console.log(`Warmup (모델 로드)... model=${MODEL}`);
  const t0 = performance.now();
  const r = await callLlm(t0);
  console.log(`  warmup ${r.latencyMs.toFixed(0)}ms ${r.ok ? 'OK' : 'FAIL'} (cold start 포함)`);
}

async function main() {
  console.log(`Ollama concurrency test  base=${BASE_URL}  model=${MODEL}`);
  await warmup();

  const summaries: WaveSummary[] = [];
  for (const n of LEVELS) {
    summaries.push(await runWave(n));
    // 다음 레벨 전 잠깐 쉬어서 GPU 안정화
    await new Promise((r) => setTimeout(r, 800));
  }

  console.log('\n=== Summary table ===');
  console.log('N    wall(ms)   thr(req/s)  p50(ms)   mean(ms)   p95(ms)   max(ms)   succ');
  for (const s of summaries) {
    console.log(
      `${String(s.n).padStart(2)}   ${s.wallClockMs.toFixed(0).padStart(7)}    ${s.throughputRps.toFixed(2).padStart(6)}     ${s.latencyP50.toFixed(0).padStart(5)}    ${s.latencyMean.toFixed(0).padStart(6)}    ${s.latencyP95.toFixed(0).padStart(5)}    ${s.latencyMax.toFixed(0).padStart(5)}   ${s.successCount}/${s.n}`,
    );
  }

  // 진단
  console.log('\n=== 해석 가이드 ===');
  const base = summaries[0];
  for (const s of summaries.slice(1)) {
    const expectedSerial = base.latencyMean * s.n; // 직렬 처리 시 wall clock 예상
    const parallelismRatio = expectedSerial / s.wallClockMs;
    const p95Ratio = s.latencyP95 / base.latencyMean;
    console.log(
      `N=${s.n}: 직렬예상 wall ${expectedSerial.toFixed(0)}ms vs 실제 ${s.wallClockMs.toFixed(0)}ms — effective parallelism ≈ ${parallelismRatio.toFixed(2)}x  (p95/baseline = ${p95Ratio.toFixed(2)}x)`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
