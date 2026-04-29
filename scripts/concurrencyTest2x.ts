/**
 * 2 인스턴스 라운드로빈 동시성 측정.
 * 2개 Ollama endpoint 에 N개 요청을 절반씩 분산 → throughput / latency 측정.
 *
 * 사용:
 *   npx tsx scripts/concurrencyTest2x.ts
 *   LLM_BASE_URLS=http://localhost:11434,http://localhost:11435 npx tsx scripts/concurrencyTest2x.ts
 */
import { performance } from 'node:perf_hooks';

const BASE_URLS = (process.env.LLM_BASE_URLS ?? 'http://localhost:11434,http://localhost:11435').split(',');
const MODEL = process.env.LLM_MODEL ?? 'gemma2:9b';
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
  endpoint: string;
  startMs: number;
  endMs: number;
  latencyMs: number;
  ok: boolean;
  errorMessage?: string;
}

async function callLlm(t0: number, baseUrl: string): Promise<CallResult> {
  const startMs = performance.now() - t0;
  const start = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${baseUrl}/api/chat`, {
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
    await res.json();
    return {
      endpoint: baseUrl,
      startMs,
      endMs: performance.now() - t0,
      latencyMs: performance.now() - start,
      ok: res.ok,
    };
  } catch (err) {
    return {
      endpoint: baseUrl,
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

async function runWave(n: number) {
  console.log(`\n=== Concurrency ${n} (${BASE_URLS.length} endpoints round-robin) ===`);
  const t0 = performance.now();
  const promises = Array.from({ length: n }, (_, i) => callLlm(t0, BASE_URLS[i % BASE_URLS.length]));
  const results = await Promise.all(promises);
  const wallClockMs = performance.now() - t0;

  const successResults = results.filter((r) => r.ok);
  const failResults = results.filter((r) => !r.ok);
  const latencies = successResults.map((r) => r.latencyMs).sort((a, b) => a - b);

  const mean = latencies.length === 0 ? 0 : latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const throughput = successResults.length / (wallClockMs / 1000);

  // per-endpoint breakdown
  const perEndpoint = new Map<string, number[]>();
  for (const r of successResults) {
    if (!perEndpoint.has(r.endpoint)) perEndpoint.set(r.endpoint, []);
    perEndpoint.get(r.endpoint)!.push(r.latencyMs);
  }

  console.log(`  wall ${wallClockMs.toFixed(0)}ms | throughput ${throughput.toFixed(2)} req/s | success ${successResults.length}/${n}`);
  console.log(
    `  latency  min ${latencies[0]?.toFixed(0) ?? '-'} | p50 ${percentile(latencies, 50).toFixed(0)} | mean ${mean.toFixed(0)} | p95 ${percentile(latencies, 95).toFixed(0)} | max ${latencies[latencies.length - 1]?.toFixed(0) ?? '-'} ms`,
  );
  for (const [ep, lats] of perEndpoint) {
    const epMean = lats.reduce((a, b) => a + b, 0) / lats.length;
    console.log(`    ${ep}: ${lats.length} req | mean ${epMean.toFixed(0)}ms`);
  }
  if (failResults.length > 0) {
    console.log('  failures:');
    for (const f of failResults.slice(0, 5)) {
      console.log(`    - ${f.endpoint}: ${f.errorMessage ?? 'unknown'}`);
    }
  }
  return { n, wallClockMs, throughput, successCount: successResults.length, p95: percentile(latencies, 95) };
}

async function warmup() {
  console.log(`Warmup (모델 로드)... model=${MODEL}`);
  for (const url of BASE_URLS) {
    const t0 = performance.now();
    const r = await callLlm(t0, url);
    console.log(`  ${url}: ${r.latencyMs.toFixed(0)}ms ${r.ok ? 'OK' : 'FAIL ' + (r.errorMessage ?? '')}`);
  }
}

async function main() {
  console.log(`Multi-instance concurrency test  endpoints=${BASE_URLS.length}  model=${MODEL}`);
  for (const url of BASE_URLS) console.log(`  - ${url}`);
  await warmup();

  const summaries = [];
  for (const n of LEVELS) {
    summaries.push(await runWave(n));
    await new Promise((r) => setTimeout(r, 800));
  }

  console.log('\n=== Summary ===');
  console.log('N    wall(ms)   thr(req/s)  p95(ms)   succ');
  for (const s of summaries) {
    console.log(`${String(s.n).padStart(2)}   ${s.wallClockMs.toFixed(0).padStart(7)}    ${s.throughput.toFixed(2).padStart(6)}     ${s.p95.toFixed(0).padStart(5)}   ${s.successCount}/${s.n}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
