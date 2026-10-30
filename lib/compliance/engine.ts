import { composeSummary } from "./summary";
import type Anthropic from "@anthropic-ai/sdk";
import { selectAiRules } from "./applicable";
import { AiAnalysisError, analyzeWithClaude, type ClaudeOptions, type ClaudeResult } from "./claude";
import { runDeterministic } from "./deterministic";
import { mergeFindings, type DroppedAi } from "./merge";
import { buildCombinedContent } from "@/lib/workflow/assets";
import { computeRisk, recommend } from "./risk";
import type { AnalysisResult, AssetContext, DraftFinding, ProductFacts, RuleDef } from "./types";

export interface EngineOptions {
  rules: RuleDef[];
  facts: ProductFacts;
  /** Uploaded image or PDF. `ctx.content` is then the typed copy only (may be empty). */
  image?: ClaudeOptions["image"];
  partnerRejectionRate?: number;
  /** Rules-only mode: no model call. Used by tests, the eval baseline and the "AI unavailable" path. */
  skipAi?: boolean;
  /** Shown to the user when `skipAi` is set, e.g. because a usage limit was reached. */
  skipReason?: string;
  client?: Anthropic;
}

export interface EngineResult extends AnalysisResult {
  /** AI findings the server discarded (hallucinated quote, wrong rule, duplicate of a rule hit). */
  droppedAi: DroppedAi[];
  usage: ClaudeResult["usage"] | null;
  latencyMs: number;
  /** Computed in code from the findings; the model never decides this. */
  recommendation: "ready" | "needs_changes";
  /** The text the findings' offsets refer to: for file input, the transcription, then COPY_SEPARATOR and the typed copy. */
  content: string;
}

/**
 * Hybrid review: deterministic rules and Claude each propose findings, then the server decides what
 * survives. The model can only add flags, and every flag must quote text that really exists.
 */
export async function analyzeAsset(ctx: AssetContext, opts: EngineOptions): Promise<EngineResult> {
  const started = Date.now();
  const applicable = selectAiRules(ctx, opts.rules);
  const applicableRuleCodes = new Set(applicable.map((r) => r.code));
  const knownRuleCodes = new Set(opts.rules.map((r) => r.code));

  let ai: ClaudeResult | null = null;
  let aiNote: string | undefined;
  let content = ctx.content;
  let deterministic: DraftFinding[] = [];

  // File input has no text until the model transcribes it, so the model must run first.
  const needsTranscription = Boolean(opts.image);
  if (!needsTranscription) deterministic = runDeterministic(ctx, opts.rules, opts.facts);

  if (opts.skipAi) {
    aiNote = opts.skipReason ?? "AI review skipped; showing rule-based findings only.";
  } else {
    try {
      ai = await analyzeWithClaude(ctx, applicable, opts.facts, { image: opts.image, client: opts.client });
    } catch (err) {
      const reason = err instanceof AiAnalysisError ? err.reason : "api";
      aiNote = `AI review unavailable (${reason}); showing rule-based findings only.`;
      if (!(err instanceof AiAnalysisError)) console.error("Unexpected AI failure:", err);
    }
  }

  if (needsTranscription) {
    content = buildCombinedContent(ai?.extractedText ?? null, ctx.content, true);
    if (!ai) aiNote = `${aiNote} The file's text could not be read without the AI step, so only the typed copy was checked.`;
    deterministic = runDeterministic({ ...ctx, content }, opts.rules, opts.facts);
  }

  const merged = mergeFindings(content, deterministic, ai?.findings ?? [], { applicableRuleCodes, knownRuleCodes });
  const risk = computeRisk(merged.findings, ctx, opts.partnerRejectionRate);

  // The verdict comes from the final findings; the model only describes the asset (see summary.ts).
  const summary = composeSummary(merged.findings, ai?.summary);

  return {
    findings: merged.findings,
    summary,
    // For file input with a working AI step this is never null, which is how the UI knows the content has a transcription part.
    extractedText: needsTranscription && ai ? (ai.extractedText ?? "") : null,
    status: ai ? "complete" : "rules_only",
    model: ai?.model ?? null,
    riskScore: risk.score,
    riskLevel: risk.level,
    aiNote,
    droppedAi: merged.droppedAi,
    usage: ai?.usage ?? null,
    latencyMs: Date.now() - started,
    recommendation: recommend(merged.findings),
    content,
  };
}
