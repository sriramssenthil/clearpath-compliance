import { describe, expect, it } from "vitest";
import { anchorFindings, anchorQuote } from "@/lib/compliance/anchor";
import type { DraftFinding } from "@/lib/compliance/types";

const slice = (c: string, s: { start: number; end: number } | null) => (s ? c.slice(s.start, s.end) : null);

describe("anchorQuote", () => {
  it("matches exactly", () => {
    const c = "Get Guaranteed approval today! Apply now.";
    expect(slice(c, anchorQuote(c, "Guaranteed approval"))).toBe("Guaranteed approval");
  });

  it("returns null for empty input", () => {
    expect(anchorQuote("abc", "")).toBeNull();
    expect(anchorQuote("", "abc")).toBeNull();
  });

  it("matches across whitespace differences and maps to original offsets", () => {
    const c = "Intro.\n\n  Rates   from\n 4.99%  APR for qualified buyers.";
    const r = anchorQuote(c, "Rates from 4.99% APR");
    expect(slice(c, r)).toBe("Rates   from\n 4.99%  APR");
  });

  it("matches curly quotes, dashes, ellipsis and case", () => {
    const c = "Don’t wait — “No credit check”… apply";
    expect(slice(c, anchorQuote(c, `don't wait - "no credit check"...`))).toBe(
      "Don’t wait — “No credit check”…",
    );
    expect(slice(c, anchorQuote(c, "NO CREDIT CHECK"))).toBe("No credit check");
  });

  it("maps a quote written with curly quotes onto straight quotes in content", () => {
    const c = `Say "yes" to savings`;
    expect(slice(c, anchorQuote(c, "Say “yes” to savings"))).toBe(`Say "yes" to savings`);
  });

  it("tolerates a missing trailing period", () => {
    const c = "Payments as low as $199/month for 60 months. Apply now.";
    expect(slice(c, anchorQuote(c, "Payments as low as $199/month for 60 months."))).toBe(
      "Payments as low as $199/month for 60 months.",
    );
  });

  it("fuzzy-matches a lightly corrupted long quote", () => {
    const c = "Intro text. We offer the lowest rates in the entire market, guaranteed. Outro.";
    const r = anchorQuote(c, "We offer the lowest rate in the entire market, garanteed.");
    expect(slice(c, r)).toBe("We offer the lowest rates in the entire market, guaranteed.");
  });

  it("returns null for a hallucinated quote", () => {
    const c = "Rates from 4.99% APR. Apply today and see your offer in minutes.";
    expect(anchorQuote(c, "Guaranteed approval for everyone with any credit history")).toBeNull();
  });

  it("does not fuzzy-match short quotes", () => {
    expect(anchorQuote("We offer low rates", "low rats")).toBeNull();
  });

  it("does not match a quote that only shares a few words", () => {
    const c = "Apply today for a personal loan with flexible repayment options and fast funding.";
    expect(anchorQuote(c, "Apply today for a mortgage with guaranteed approval and no fees at all")).toBeNull();
  });
});

describe("anchorFindings", () => {
  const draft = (quote: string): DraftFinding => ({
    source: "ai",
    ruleCode: "UDAAP-GUARANTEE",
    severity: "high",
    quote,
    issue: "x",
  });

  it("sets offsets and replaces non-exact quotes with the real slice", () => {
    const c = "Hi.  GUARANTEED   approval, apply now";
    const [a, b] = anchorFindings(c, [draft("guaranteed approval"), draft("nonexistent claim about everything")]);
    expect(a.start).not.toBeNull();
    expect(a.quote).toBe(c.slice(a.start!, a.end!));
    expect(a.quote).toBe("GUARANTEED   approval");
    expect(b.start).toBeNull();
    expect(b.end).toBeNull();
    expect(b.quote).toBe("nonexistent claim about everything");
  });
});
