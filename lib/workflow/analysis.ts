import { createHash } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { DEFAULT_MODEL } from "@/lib/compliance/claude";
import { analyzeAsset, type EngineResult } from "@/lib/compliance/engine";
import { PROMPT_VERSION } from "@/lib/compliance/prompt";
import { computeRisk, recommend } from "@/lib/compliance/risk";
import type { AssetContext, RuleDef } from "@/lib/compliance/types";
import { loadFacts, loadRules } from "@/lib/data/reference";
import { db, tables } from "@/lib/db";
import { reserveAiCall } from "./budget";
import type { RuleInfo } from "./types";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
export const contentHash = (content: string) => sha(content);

/** Share of a partner's decided submissions that were rejected; undefined until there is history. */
export async function partnerRejectionRate(partnerId: number | null): Promise<number | undefined> {
  if (partnerId === null) return undefined;
  const rows = await db
    .select({ status: tables.submissions.status })
    .from(tables.submissions)
    .where(eq(tables.submissions.partnerId, partnerId));
  const approved = rows.filter((r) => r.status === "approved").length;
  const rejected = rows.filter((r) => r.status === "rejected").length;
  return approved + rejected >= 3 ? rejected / (approved + rejected) : undefined;
}

function cacheKey(ctx: AssetContext, rules: RuleDef[], facts: unknown): string {
  const rulesFp = sha(JSON.stringify(rules.map((r) => [r.code, r.severity, r.enabled, r.aiReview, r.checkInstruction, r.config])));
  return sha(
    JSON.stringify([
      PROMPT_VERSION,
      process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL,
      process.env.ANTHROPIC_EFFORT ?? "low",
      rulesFp,
      sha(JSON.stringify(facts)),
      ctx.product,
      ctx.channel,
      [...ctx.states].sort(),
      ctx.isAffiliate,
      ctx.content,
    ]),
  );
}

/**
 * Runs the hybrid engine against the live rules library, reusing a cached result when the same
 * text was already analysed under the same rules. Only complete (rules + AI) results are cached, so
 * a transient AI outage is never frozen in. Risk is always recomputed with the partner's record.
 */
export async function analyzeForSubmission(ctx: AssetContext, partnerId: number | null, userId: number | null = null) {
  const [rules, facts, rate] = await Promise.all([loadRules(), loadFacts(ctx.product), partnerRejectionRate(partnerId)]);
  const key = cacheKey(ctx, rules, facts);

  let result: EngineResult | null = null;
  const [hit] = await db.select().from(tables.analysisCache).where(eq(tables.analysisCache.key, key));
  if (hit) result = hit.result as EngineResult;

  if (!result) {
    const budget = await reserveAiCall(userId);
    result = await analyzeAsset(ctx, { rules, facts, skipAi: !budget.ok, skipReason: budget.ok ? undefined : budget.reason });
    if (result.status === "complete") {
      await db
        .insert(tables.analysisCache)
        .values({ key, result })
        .onConflictDoNothing();
    }
  }

  const risk = computeRisk(result.findings, ctx, rate);
  const final: EngineResult = { ...result, riskScore: risk.score, riskLevel: risk.level, recommendation: recommend(result.findings) };
  const ruleInfo = Object.fromEntries(
    rules.map((r): [string, RuleInfo] => [r.code, { code: r.code, title: r.title, category: r.category, citation: r.citation, guidance: r.guidance }]),
  );
  return { analysis: final, ruleInfo, cached: Boolean(hit) };
}

export async function ruleInfoFor(codes: string[]): Promise<Record<string, RuleInfo>> {
  if (codes.length === 0) return {};
  const rows = await db.select().from(tables.rules).where(inArray(tables.rules.code, codes));
  return Object.fromEntries(rows.map((r) => [r.code, { code: r.code, title: r.title, category: r.category, citation: r.citation, guidance: r.guidance }]));
}
