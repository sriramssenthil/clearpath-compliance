import { usableCopy } from "./fix-text";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { AiAnalysisSchema, type AiAnalysis } from "./ai-schema";
import { buildSystemPrompt, buildUserContent, type ImageMediaType } from "./prompt";
import type { AssetContext, DraftFinding, ProductFacts, RuleDef } from "./types";

export const DEFAULT_MODEL = "claude-opus-5-5";
const EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;
type Effort = (typeof EFFORTS)[number];

export type AiFailureReason = "refusal" | "truncated" | "parse" | "api";

/** Thrown for any AI failure; callers fall back to rules-only mode. */
export class AiAnalysisError extends Error {
  constructor(
    public readonly reason: AiFailureReason,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "AiAnalysisError";
  }
}

export interface ClaudeResult {
  findings: DraftFinding[];
  summary: string;
  extractedText: string | null;
  model: string;
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number };
  latencyMs: number;
}

export interface ClaudeOptions {
  image?: { mediaType: ImageMediaType | "application/pdf"; base64: string };
  client?: Anthropic;
}

function effortFromEnv(): Effort {
  const e = process.env.ANTHROPIC_EFFORT;
  return (EFFORTS as readonly string[]).includes(e ?? "") ? (e as Effort) : "low";
}

/**
 * zodOutputFormat's parse() throws on bad JSON, which would hide stop_reason. Return null instead
 * so we can look at stop_reason first and report the true cause.
 */
function lenientFormat() {
  const format = zodOutputFormat(AiAnalysisSchema);
  return {
    ...format,
    parse: (content: string): AiAnalysis => {
      try {
        return format.parse(content);
      } catch {
        return null as unknown as AiAnalysis;
      }
    },
  };
}

function wrapApiError(err: unknown): AiAnalysisError {
  if (err instanceof AiAnalysisError) return err;
  if (err instanceof Anthropic.RateLimitError) return new AiAnalysisError("api", "Rate limited by the AI provider", { cause: err });
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError)
    return new AiAnalysisError("api", "AI provider rejected the credentials", { cause: err });
  if (err instanceof Anthropic.APIConnectionError) return new AiAnalysisError("api", "Could not reach the AI provider (network or timeout)", { cause: err });
  if (err instanceof Anthropic.APIError) return new AiAnalysisError("api", `AI provider error ${err.status ?? ""}: ${err.message}`.trim(), { cause: err });
  return new AiAnalysisError("api", err instanceof Error ? err.message : "Unknown AI error", { cause: err });
}

export async function analyzeWithClaude(
  ctx: AssetContext,
  rules: RuleDef[],
  facts: ProductFacts,
  opts: ClaudeOptions = {},
): Promise<ClaudeResult> {
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
  const started = Date.now();

  let message;
  try {
    const client = opts.client ?? new Anthropic({ timeout: 90_000, maxRetries: 1 });
    // No temperature/top_p/top_k, no thinking override, no prefill, no forced tool_choice: unsupported on Opus 5.5.
    message = await client.messages.parse({
      model,
      max_tokens: 16000,
      system: [{ type: "text", text: buildSystemPrompt(rules, facts), cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: buildUserContent(ctx, opts.image) }],
      output_config: { format: lenientFormat(), effort: effortFromEnv() },
    });
  } catch (err) {
    throw wrapApiError(err);
  }
  const latencyMs = Date.now() - started;

  if (message.stop_reason === "refusal") {
    const category = message.stop_details?.category;
    throw new AiAnalysisError("refusal", `The model declined to review this asset${category ? ` (${category})` : ""}`);
  }
  if (message.stop_reason === "max_tokens") throw new AiAnalysisError("truncated", "The model's response was cut off before it finished");
  const parsed = message.parsed_output;
  if (!parsed) throw new AiAnalysisError("parse", "The model's response did not match the expected format");

  // The rule library, not the model, decides which rules exist and how severe they are.
  const bySeverity = new Map(rules.map((r) => [r.code, r.severity] as const));
  const findings: DraftFinding[] = [];
  for (const f of parsed.findings) {
    const severity = bySeverity.get(f.rule_code);
    if (!severity) continue;
    findings.push({
      source: "ai",
      ruleCode: f.rule_code,
      severity,
      quote: f.quote,
      issue: f.issue,
      suggestion: f.suggestion,
      replacement: usableCopy(f.replacement, f.quote),
      insertText: usableCopy(f.insert_text),
      confidence: f.confidence,
    });
  }

  const u = message.usage;
  return {
    findings,
    summary: parsed.summary,
    extractedText: parsed.extracted_text,
    model: message.model ?? model,
    usage: {
      inputTokens: u.input_tokens ?? 0,
      outputTokens: u.output_tokens ?? 0,
      cacheReadTokens: u.cache_read_input_tokens ?? 0,
      cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
    },
    latencyMs,
  };
}
