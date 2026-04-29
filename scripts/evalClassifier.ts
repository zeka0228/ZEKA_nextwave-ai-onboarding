/**
 * LLM 분류기 성능 평가 러너.
 *
 * 사용:
 *   npx tsx scripts/evalClassifier.ts
 *   npx tsx scripts/evalClassifier.ts --filter 직장인
 *   npx tsx scripts/evalClassifier.ts --limit 5
 *   npx tsx scripts/evalClassifier.ts --out eval-result.json
 *
 * 환경변수 (모두 선택):
 *   LLM_BASE_URL    default 'http://localhost:11434' (Ollama host root, native /api/chat)
 *   LLM_MODEL       default 'qwen2.5:3b'
 *   LLM_API_KEY     default 'ollama'
 *   LLM_TIMEOUT_MS  default 30000
 *
 * 주의: 브라우저 어댑터(llmClassifierAdapter.ts)는 import.meta.env 사용으로
 * Node 에서 직접 실행 불가. 동일한 호출/파싱 규약을 여기서 재구현한다.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

import { buildClassificationPrompt } from '../src/domain/classification/classificationPrompt';
import type { LlmUserType } from '../src/domain/types';
import {
  evalCases,
  qaScenarioCases,
  type EvalCase,
} from '../src/services/classifiers/__eval__/testset';
import {
  ALL_LABELS,
  computeSummary,
  formatReport,
  type CaseResult,
} from '../src/services/classifiers/__eval__/metrics';

const BASE_URL = process.env.LLM_BASE_URL ?? 'http://localhost:11434';
const MODEL = process.env.LLM_MODEL ?? 'qwen2.5:3b';
const API_KEY = process.env.LLM_API_KEY ?? 'ollama';
const TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS) || 30_000;
const KEEP_ALIVE = process.env.LLM_KEEP_ALIVE ?? '30m';

interface CliArgs {
  filter?: string;
  limit?: number;
  out?: string;
  qa?: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--filter') args.filter = argv[++i];
    else if (a === '--limit') args.limit = Number(argv[++i]);
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--qa') args.qa = true;
  }
  return args;
}

const QA_PASS_THRESHOLD = 0.8;

interface OllamaChatResponse {
  message?: { content?: string };
}

async function callLlm(prompt: string): Promise<{
  userType: LlmUserType;
  confidence: number;
}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        stream: false,
        think: false,
        format: 'json',
        keep_alive: KEEP_ALIVE,
        options: { temperature: 0 },
        messages: [
          {
            role: 'system',
            content:
              'You are a strict JSON classifier. Respond with a single JSON object only — no prose, no markdown fences.',
          },
          { role: 'user', content: prompt },
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`LLM API ${res.status}: ${body.slice(0, 200)}`);
    }

    const completion = (await res.json()) as OllamaChatResponse;
    const content = completion.message?.content;
    if (typeof content !== 'string' || content.length === 0) {
      throw new Error('LLM response missing content');
    }

    const parsed = JSON.parse(content) as Record<string, unknown>;
    const userType = parsed.user_type;
    const confidence = parsed.confidence;

    if (
      typeof userType !== 'string' ||
      !ALL_LABELS.includes(userType as LlmUserType)
    ) {
      throw new Error(`invalid user_type: ${String(userType)}`);
    }
    if (
      typeof confidence !== 'number' ||
      Number.isNaN(confidence) ||
      confidence < 0 ||
      confidence > 1
    ) {
      throw new Error(`invalid confidence: ${String(confidence)}`);
    }

    return { userType: userType as LlmUserType, confidence };
  } finally {
    clearTimeout(timer);
  }
}

async function runOne(c: EvalCase): Promise<CaseResult> {
  const prompt = buildClassificationPrompt(c.input);
  const start = performance.now();
  try {
    const { userType, confidence } = await callLlm(prompt);
    const latencyMs = performance.now() - start;
    return {
      id: c.id,
      expected: c.expected,
      predicted: userType,
      confidence,
      latencyMs,
      difficulty: c.difficulty,
    };
  } catch (err) {
    const latencyMs = performance.now() - start;
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      id: c.id,
      expected: c.expected,
      predicted: null,
      confidence: null,
      latencyMs,
      difficulty: c.difficulty,
      errorMessage,
    };
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const sourceLabel = args.qa ? 'qa-scenarios §C-3' : 'full evalCases';
  let cases: EvalCase[] = args.qa ? qaScenarioCases : evalCases;
  if (args.filter) cases = cases.filter((c) => c.expected === args.filter);
  if (args.limit && args.limit > 0) cases = cases.slice(0, args.limit);

  if (cases.length === 0) {
    console.error('no cases match the given filter/limit.');
    process.exit(2);
  }

  console.log(
    `Eval start  set=${sourceLabel}  cases=${cases.length}  model=${MODEL}  base=${BASE_URL}  timeout=${TIMEOUT_MS}ms`,
  );

  const results: CaseResult[] = [];
  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    const r = await runOne(c);
    results.push(r);
    const mark = r.predicted === null ? 'X' : r.predicted === r.expected ? 'O' : '·';
    const pred = r.predicted ?? `FAIL(${r.errorMessage?.slice(0, 60) ?? '?'})`;
    const conf = r.confidence === null ? '   -' : r.confidence.toFixed(2);
    console.log(
      `[${String(i + 1).padStart(2)}/${cases.length}] ${mark}  ${c.id.padEnd(15)}  expected=${c.expected.padEnd(8)}  predicted=${String(pred).padEnd(8)}  conf=${conf}  ${r.latencyMs.toFixed(0)}ms`,
    );
  }

  const summary = computeSummary(results);
  console.log('');
  console.log(formatReport(summary));

  if (args.qa) {
    const passed = summary.accuracyOverall >= QA_PASS_THRESHOLD;
    console.log('');
    console.log(
      `QA §C-3 합격 기준 ≥ ${(QA_PASS_THRESHOLD * 100).toFixed(0)}%  →  결과 ${(summary.accuracyOverall * 100).toFixed(1)}%  ${passed ? 'PASS' : 'FAIL'}`,
    );
  }

  if (args.out) {
    const outPath = resolve(process.cwd(), args.out);
    writeFileSync(
      outPath,
      JSON.stringify(
        {
          meta: {
            timestamp: new Date().toISOString(),
            model: MODEL,
            baseUrl: BASE_URL,
            timeoutMs: TIMEOUT_MS,
          },
          summary,
          results,
        },
        null,
        2,
      ),
      'utf8',
    );
    console.log(`\nSaved JSON: ${outPath}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
