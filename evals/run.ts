import { config } from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { analyzeAsset } from "../lib/compliance/engine";
import { RULE_CODES, type AssetContext } from "../lib/compliance/types";
import { PRODUCT_FACTS } from "../lib/seed/product-facts";
import { RULES } from "../lib/seed/rules";
import type { EvalCase } from "./types";

config({ path: ".env.local", quiet: true });

// Opus 5.5 list prices, dollars per million tokens.
const PRICE = { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 };

interface CaseRun {
  id: string;
  expected: string[];
  found: string[];
  mustNotFlag: string[];
  latencyMs: number;
  costUsd: number;
  droppedAi: number;
  aiNote?: string;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (name: string) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  return {
    rulesOnly: args.includes("--rules-only"),
    concurrency: Number(get("--concurrency") ?? 4),
    only: get("--only"),
    out: get("--out"),
  };
}

async function runCase(c: EvalCase, rulesOnly: boolean): Promise<CaseRun> {
  const facts = PRODUCT_FACTS.find((f) => f.product === c.product)!;
  const ctx: AssetContext = {
    product: c.product,
    channel: c.channel,
    states: c.states,
    content: c.content,
    isAffiliate: c.isAffiliate,
  };
  const r = await analyzeAsset(ctx, { rules: RULES, facts, skipAi: rulesOnly });
  const u = r.usage;
  const costUsd = u
    ? (u.inputTokens * PRICE.input + u.outputTokens * PRICE.output + u.cacheReadTokens * PRICE.cacheRead + u.cacheWriteTokens * PRICE.cacheWrite) / 1e6
    : 0;
  return {
    id: c.id,
    expected: c.expectedRuleCodes,
    found: [...new Set(r.findings.map((f) => f.ruleCode))].sort(),
    mustNotFlag: c.mustNotFlag ?? [],
    latencyMs: r.latencyMs,
    costUsd,
    droppedAi: r.droppedAi.length,
    aiNote: r.aiNote,
  };
}

async function pool<T, R>(items: T[], size: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

const pct = (n: number, d: number) => (d === 0 ? "n/a" : `${Math.round((100 * n) / d)}%`);
const percentile = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0;
};

async function main() {
  const { rulesOnly, concurrency, only, out } = parseArgs();
  const dir = path.join(__dirname, "cases");
  let cases: EvalCase[] = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));
  if (only) cases = cases.filter((c) => c.id.includes(only));

  console.log(`Running ${cases.length} cases (${rulesOnly ? "rules only" : "rules + Claude"}, concurrency ${concurrency})...`);
  const runs = await pool(cases, concurrency, (c) => runCase(c, rulesOnly));

  const perRule: Record<string, { tp: number; fp: number; fn: number }> = {};
  for (const code of RULE_CODES) perRule[code] = { tp: 0, fp: 0, fn: 0 };
  let trapHits = 0;
  for (const r of runs) {
    for (const code of RULE_CODES) {
      const exp = r.expected.includes(code);
      const got = r.found.includes(code);
      if (exp && got) perRule[code].tp++;
      else if (!exp && got) perRule[code].fp++;
      else if (exp && !got) perRule[code].fn++;
    }
    trapHits += r.mustNotFlag.filter((c) => r.found.includes(c)).length;
  }

  console.log("\n| Rule | Expected | TP | FP | FN | Precision | Recall |");
  console.log("|---|---|---|---|---|---|---|");
  let TP = 0, FP = 0, FN = 0;
  for (const code of RULE_CODES) {
    const { tp, fp, fn } = perRule[code];
    TP += tp; FP += fp; FN += fn;
    console.log(`| ${code} | ${tp + fn} | ${tp} | ${fp} | ${fn} | ${pct(tp, tp + fp)} | ${pct(tp, tp + fn)} |`);
  }
  console.log(`| **All** | ${TP + FN} | ${TP} | ${FP} | ${FN} | ${pct(TP, TP + FP)} | ${pct(TP, TP + FN)} |`);

  const clean = runs.filter((r) => r.expected.length === 0);
  const cleanFlagged = clean.filter((r) => r.found.length > 0);
  const lat = runs.map((r) => r.latencyMs);
  const cost = runs.reduce((s, r) => s + r.costUsd, 0);
  console.log(`\nClean controls flagged: ${cleanFlagged.length}/${clean.length}${cleanFlagged.length ? ` (${cleanFlagged.map((r) => `${r.id}: ${r.found.join(",")}`).join("; ")})` : ""}`);
  console.log(`mustNotFlag trap hits: ${trapHits}`);
  console.log(`AI findings discarded by the server: ${runs.reduce((s, r) => s + r.droppedAi, 0)}`);
  console.log(`Latency p50 ${percentile(lat, 0.5)} ms, p95 ${percentile(lat, 0.95)} ms`);
  console.log(`Cost: $${cost.toFixed(2)} total, $${(cost / runs.length).toFixed(3)} per asset`);
  const failedAi = runs.filter((r) => r.aiNote && !rulesOnly);
  if (failedAi.length) console.log(`AI unavailable on ${failedAi.length} case(s): ${failedAi.map((r) => r.id).join(", ")}`);

  console.log("\nMisses and false alarms:");
  for (const r of runs) {
    const missed = r.expected.filter((c) => !r.found.includes(c));
    const extra = r.found.filter((c) => !r.expected.includes(c));
    if (missed.length || extra.length) {
      console.log(`- ${r.id}${missed.length ? `  MISSED ${missed.join(",")}` : ""}${extra.length ? `  EXTRA ${extra.join(",")}` : ""}`);
    }
  }

  if (out) {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify({ rulesOnly, runs, perRule, summary: { TP, FP, FN, cost } }, null, 2));
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
