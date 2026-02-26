import { performance } from "node:perf_hooks";

import { evaluateGuideStepFromFrame } from "../src/app.js";
import { OcrToken, RawFrame } from "../src/types.js";

function buildSyntheticFrame(tokenCount: number): RawFrame {
  const tokens: OcrToken[] = [];
  const lexicon = [
    "HERO",
    "Summary",
    "Skills",
    "Loadout",
    "Achievements",
    "show completed",
    "show locked",
    "skills",
    "exploration",
    "area tasks",
    "combat",
    "lore",
    "activities",
    "completionist",
    "feats",
    "grace",
  ];
  for (let i = 0; i < tokenCount; i++) {
    const text = lexicon[i % lexicon.length];
    tokens.push({
      text,
      confidence: 0.9,
      rect: { x: 20 + (i % 30) * 10, y: 24 + Math.floor(i / 30) * 18, width: 80, height: 15 },
    });
  }
  return { tokens, timestampMs: Date.now() };
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[idx];
}

function run(): void {
  const samples = 150;
  const durations: number[] = [];
  for (let i = 0; i < samples; i++) {
    const frame = buildSyntheticFrame(220);
    const t0 = performance.now();
    evaluateGuideStepFromFrame(frame);
    const t1 = performance.now();
    durations.push(t1 - t0);
  }

  const p50 = percentile(durations, 0.5);
  const p95 = percentile(durations, 0.95);
  const max = Math.max(...durations);
  const budgetMs = 16;

  console.log(`perf samples=${samples}`);
  console.log(`p50_ms=${p50.toFixed(3)}`);
  console.log(`p95_ms=${p95.toFixed(3)}`);
  console.log(`max_ms=${max.toFixed(3)}`);
  console.log(`budget_ms=${budgetMs}`);

  if (p95 > budgetMs) {
    console.error(`Performance budget exceeded: p95 ${p95.toFixed(3)} > ${budgetMs}`);
    process.exitCode = 1;
  }
}

run();

