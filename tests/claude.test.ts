import type Anthropic from "@anthropic-ai/sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AiAnalysisError, analyzeWithClaude } from "@/lib/compliance/claude";
import type { AssetContext, ProductFacts, RuleDef } from "@/lib/compliance/types";

const rule = (code: string, severity: RuleDef["severity"]): RuleDef => ({
  code,
  title: code,
  description: "d",
  category: "Test",
  severity,
  kind: "ai",
  products: [],
  channels: [],
  checkInstruction: "check",
  config: { type: "none" },
  citation: "cite",
  guidance: "guide",
  enabled: true,
});
const rules = [rule("UDAAP-GUARANTEE", "high"), rule("REGZ-24-APR", "medium")];
const facts: ProductFacts = {
  product: "personal_loan",
  facts: { displayName: "Loan", notes: [] },
  approvedSnippets: [],
};
const ctx: AssetContext = { product: "personal_loan", channel: "email", states: [], content: "Guaranteed approval!", isAffiliate: false };

const usage = { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 700, cache_creation_input_tokens: 20 };
const finding = (over: Record<string, unknown> = {}) => ({
  rule_code: "UDAAP-GUARANTEE",
  severity: "high",
  quote: "Guaranteed approval",
  issue: "i",
  suggestion: "s",
  confidence: "high",
  ...over,
});

function fakeClient(response: Record<string, unknown> | Error) {
  const parse = vi.fn(async () => {
    if (response instanceof Error) throw response;
    return { model: "claude-opus-5-5", usage, stop_reason: "end_turn", ...response };
  });
  return { client: { messages: { parse } } as unknown as Anthropic, parse };
}

const ok = (findings: unknown[]) => ({ parsed_output: { extracted_text: null, summary: "sum", findings } });

describe("analyzeWithClaude", () => {
  const saved = { ...process.env };
  beforeEach(() => {
    delete process.env.ANTHROPIC_MODEL;
    delete process.env.ANTHROPIC_EFFORT;
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it("maps a good response to draft findings, usage and summary", async () => {
    const { client } = fakeClient(ok([finding()]));
    const r = await analyzeWithClaude(ctx, rules, facts, { client });
    expect(r.findings).toEqual([
      { source: "ai", ruleCode: "UDAAP-GUARANTEE", severity: "high", quote: "Guaranteed approval", issue: "i", suggestion: "s", confidence: "high" },
    ]);
    expect(r.summary).toBe("sum");
    expect(r.extractedText).toBeNull();
    expect(r.model).toBe("claude-opus-5-5");
    expect(r.usage).toEqual({ inputTokens: 100, outputTokens: 50, cacheReadTokens: 700, cacheWriteTokens: 20 });
    expect(r.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("throws refusal", async () => {
    const { client } = fakeClient({ stop_reason: "refusal", stop_details: { type: "refusal", category: "cyber" }, parsed_output: null });
    await expect(analyzeWithClaude(ctx, rules, facts, { client })).rejects.toMatchObject({ name: "AiAnalysisError", reason: "refusal" });
  });

  it("throws truncated on max_tokens, even if parsed_output exists", async () => {
    const { client } = fakeClient({ stop_reason: "max_tokens", ...ok([finding()]) });
    await expect(analyzeWithClaude(ctx, rules, facts, { client })).rejects.toMatchObject({ reason: "truncated" });
  });

  it("throws parse on null parsed_output", async () => {
    const { client } = fakeClient({ parsed_output: null });
    const err = await analyzeWithClaude(ctx, rules, facts, { client }).catch((e) => e);
    expect(err).toBeInstanceOf(AiAnalysisError);
    expect(err.reason).toBe("parse");
  });

  it("wraps SDK errors as reason api", async () => {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const rate = new Anthropic.RateLimitError(429, { type: "error", error: { type: "rate_limit_error", message: "slow down" } }, "slow down", new Headers());
    const { client } = fakeClient(rate);
    await expect(analyzeWithClaude(ctx, rules, facts, { client })).rejects.toMatchObject({ reason: "api" });
    const { client: c2 } = fakeClient(new Error("boom"));
    await expect(analyzeWithClaude(ctx, rules, facts, { client: c2 })).rejects.toMatchObject({ reason: "api" });
  });

  it("drops unknown rule codes and forces rule-library severity", async () => {
    const { client } = fakeClient(
      ok([
        finding({ rule_code: "MADE-UP-RULE" }),
        finding({ rule_code: "REGZ-24-APR", severity: "low", quote: "4.99%" }),
        finding({ rule_code: "UDAAP-GUARANTEE", severity: "low" }),
      ]),
    );
    const r = await analyzeWithClaude(ctx, rules, facts, { client });
    expect(r.findings.map((f) => [f.ruleCode, f.severity])).toEqual([
      ["REGZ-24-APR", "medium"],
      ["UDAAP-GUARANTEE", "high"],
    ]);
  });

  it("sends the expected request shape", async () => {
    const { client, parse } = fakeClient(ok([]));
    await analyzeWithClaude(ctx, rules, facts, { client });
    const req = (parse.mock.calls[0] as unknown as [Record<string, any>])[0];
    expect(req.model).toBe("claude-opus-5-5");
    expect(req.max_tokens).toBe(16000);
    for (const k of ["temperature", "top_p", "top_k", "thinking", "tool_choice", "tools"]) expect(req).not.toHaveProperty(k);
    expect(req.system).toHaveLength(1);
    expect(req.system[0]).toMatchObject({ type: "text", cache_control: { type: "ephemeral" } });
    expect(req.system[0].text).toContain("REGZ-24-APR");
    expect(req.output_config.format).toMatchObject({ type: "json_schema" });
    expect(req.output_config.effort).toBe("low");
    expect(req.messages).toHaveLength(1);
    expect(req.messages[0].role).toBe("user");
    const text = req.messages[0].content.at(-1).text as string;
    expect(text).toContain("<submission>\nGuaranteed approval!\n</submission>");
    expect(req.system[0].text).not.toContain("Guaranteed approval!");
  });

  it("honors ANTHROPIC_MODEL and ANTHROPIC_EFFORT, ignoring invalid effort", async () => {
    process.env.ANTHROPIC_MODEL = "claude-test-model";
    process.env.ANTHROPIC_EFFORT = "high";
    const a = fakeClient(ok([]));
    await analyzeWithClaude(ctx, rules, facts, { client: a.client });
    const req = (a.parse.mock.calls[0] as unknown as [Record<string, any>])[0];
    expect(req.model).toBe("claude-test-model");
    expect(req.output_config.effort).toBe("high");

    process.env.ANTHROPIC_EFFORT = "bogus";
    const b = fakeClient(ok([]));
    await analyzeWithClaude(ctx, rules, facts, { client: b.client });
    expect((b.parse.mock.calls[0] as unknown as [Record<string, any>])[0].output_config.effort).toBe("low");
  });

  it("puts an image block first in the user content", async () => {
    const { client, parse } = fakeClient(ok([]));
    await analyzeWithClaude(ctx, rules, facts, { client, image: { mediaType: "image/png", base64: "AAAA" } });
    const req = (parse.mock.calls[0] as unknown as [Record<string, any>])[0];
    expect(req.messages[0].content[0]).toMatchObject({ type: "image", source: { type: "base64", media_type: "image/png" } });
  });

  it("the lenient format returns null instead of throwing on malformed JSON", async () => {
    const { client, parse } = fakeClient(ok([]));
    await analyzeWithClaude(ctx, rules, facts, { client });
    const fmt = (parse.mock.calls[0] as unknown as [Record<string, any>])[0].output_config.format;
    expect(fmt.parse("{not json")).toBeNull();
    expect(fmt.parse(JSON.stringify({ extracted_text: null, summary: "s", findings: [] }))).toEqual({ extracted_text: null, summary: "s", findings: [] });
  });
});
