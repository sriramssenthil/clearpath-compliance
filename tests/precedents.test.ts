import { describe, expect, it } from "vitest";
import type { Precedent } from "@/lib/compliance/feature-types";
import { findPrecedents, stem, tokenize } from "@/lib/compliance/precedents";
import { RULE_CODES } from "@/lib/compliance/types";
import { PRECEDENT_LIBRARY } from "@/lib/seed/precedents";
import { attachPrecedents } from "@/lib/workflow/precedents";
import type { FindingView } from "@/lib/workflow/types";

const terms = (s: string) => tokenize(s).map((t) => t.term);

function prec(id: string, over: Partial<Precedent>): Precedent {
  return {
    id, source: "library", ruleCode: "UDAAP-GUARANTEE", product: "personal_loan", channel: "display",
    originalText: "", issue: "", reviewerName: "Priya Raman", reviewerComment: "", outcome: "fixed",
    approvedText: null, decidedAt: new Date("2026-01-01T00:00:00Z"), submissionCode: null, ...over,
  };
}

describe("tokenize", () => {
  it("lowercases, drops punctuation and stopwords, keeps numbers with $ and %", () => {
    expect(terms("Rates as low as 8.99% APR, borrow $50,000!")).toEqual(["rat", "low", "8.99%", "apr", "borrow", "$50000"]);
  });
  it("joins hyphenated and apostrophe words and also indexes the parts", () => {
    expect(terms("You're pre-approved")).toEqual(["your", "preapprov", "approv"]);
    expect(terms("preapproved")).toEqual(["preapprov"]);
    expect(tokenize("You're pre-approved")[0].surface).toBe("you're");
  });
  it("stems lightly so word forms meet", () => {
    expect(stem("approved")).toBe(stem("approval"));
    expect(stem("guaranteed")).toBe(stem("guarantee"));
    expect(stem("months")).toBe(stem("month"));
    expect(stem("fees")).toBe(stem("fee"));
    expect(stem("0%")).toBe("0%");
  });
});

describe("library corpus", () => {
  it("has 55 to 60 decisions over the last year with valid rule codes and a reviewer comment", () => {
    expect(PRECEDENT_LIBRARY.length).toBeGreaterThanOrEqual(55);
    expect(PRECEDENT_LIBRARY.length).toBeLessThanOrEqual(60);
    const codes = new Set<string>(RULE_CODES);
    for (const p of PRECEDENT_LIBRARY) {
      expect(codes.has(p.ruleCode)).toBe(true);
      expect(p.reviewerComment.length).toBeGreaterThan(10);
      if (p.outcome === "fixed") expect(p.approvedText).toBeTruthy();
    }
    expect(new Set(PRECEDENT_LIBRARY.map((p) => p.id)).size).toBe(PRECEDENT_LIBRARY.length);
    expect(new Set(PRECEDENT_LIBRARY.map((p) => p.outcome))).toEqual(new Set(["fixed", "dismissed", "rejected"]));
  });
});

describe("findPrecedents", () => {
  it("ranks the library precedent for a paraphrased claim first", () => {
    const top = findPrecedents(
      { ruleCode: "FCRA-PREQUAL", quote: "Great news, you are preapproved for a personal loan up to $35,000", product: "personal_loan", channel: "email" },
      PRECEDENT_LIBRARY,
    )[0];
    expect(top.precedent.originalText).toMatch(/^Congratulations, you're pre-approved/);
    const deferred = findPrecedents({ ruleCode: "REGZ-16-DEFERRED", quote: "Pay no interest for 15 months", product: "credit_card", channel: "display" }, PRECEDENT_LIBRARY)[0];
    expect(deferred.precedent.originalText).toMatch(/^Pay no interest for 15 months/);
  });

  it("boosts the same rule over equal wording under another rule", () => {
    const corpus = [
      prec("lib-1", { ruleCode: "UDAAP-SUPERLATIVE", originalText: "Guaranteed approval today" }),
      prec("lib-2", { ruleCode: "UDAAP-GUARANTEE", originalText: "Guaranteed approval today" }),
    ];
    const [a, b] = findPrecedents({ ruleCode: "UDAAP-GUARANTEE", quote: "guaranteed approval", product: "personal_loan", channel: "display" }, corpus, { minScore: 0 });
    expect(a.precedent.id).toBe("lib-2");
    expect(a.sameRule).toBe(true);
    expect(b.sameRule).toBe(false);
    expect(a.score).toBeGreaterThan(b.score);
  });

  it("lets a different rule match when the wording is close", () => {
    const corpus = [
      prec("lib-1", { ruleCode: "UDAAP-GUARANTEE", originalText: "No credit check loans up to $40,000" }),
      prec("lib-2", { ruleCode: "REGZ-24-APR", originalText: "Rates from 8.99% APR" }),
    ];
    const res = findPrecedents({ ruleCode: "UDAAP-APR", quote: "No credit check loans", product: "personal_loan", channel: "display" }, corpus);
    expect(res.map((m) => m.precedent.id)).toEqual(["lib-1"]);
    expect(res[0].sameRule).toBe(false);
  });

  it("does not match on rule, product and channel alone", () => {
    const corpus = [prec("lib-1", { originalText: "Completely different words here" })];
    expect(findPrecedents({ ruleCode: "UDAAP-GUARANTEE", quote: "everyone qualifies", product: "personal_loan", channel: "display" }, corpus, { minScore: 0 })).toEqual([]);
  });

  it("respects k and the minimum score, and scores within 0..1", () => {
    const q = { ruleCode: "UDAAP-GUARANTEE", quote: "Guaranteed approval for everyone", product: "personal_loan", channel: "display" } as const;
    expect(findPrecedents(q, PRECEDENT_LIBRARY)).toHaveLength(3);
    expect(findPrecedents(q, PRECEDENT_LIBRARY, { k: 5 })).toHaveLength(5);
    const all = findPrecedents(q, PRECEDENT_LIBRARY, { k: 100, minScore: 0 });
    expect(all.every((m) => m.score >= 0 && m.score <= 1)).toBe(true);
    const strict = findPrecedents(q, PRECEDENT_LIBRARY, { k: 100, minScore: 0.6 });
    expect(strict.length).toBeGreaterThan(0);
    expect(strict.length).toBeLessThan(all.length);
    expect(strict.every((m) => m.score >= 0.6)).toBe(true);
    expect(findPrecedents(q, [], {})).toEqual([]);
  });

  it("reports the shared terms as written, quote words first, at most six", () => {
    const [m] = findPrecedents({ ruleCode: "REGZ-16-INTRO", quote: "0% APR for 15 months!", issue: "Promotional rate not labelled introductory.", product: "credit_card", channel: "display" }, PRECEDENT_LIBRARY);
    expect(m.matchedTerms.slice(0, 4).sort()).toEqual(["0%", "15", "apr", "months"]);
    expect(m.matchedTerms.length).toBeLessThanOrEqual(6);
    expect(m.matchedTerms).not.toContain("for");
  });

  it("collapses identical wording under the same rule", () => {
    const corpus = [
      prec("live-1", { source: "live", originalText: "lowest rates", submissionCode: "CP-1" }),
      prec("live-2", { source: "live", originalText: "Lowest  rates", submissionCode: "CP-1" }),
    ];
    expect(findPrecedents({ ruleCode: "UDAAP-GUARANTEE", quote: "lowest rates", product: "personal_loan", channel: "display" }, corpus)).toHaveLength(1);
  });

  it("is deterministic", () => {
    const q = { ruleCode: "REGZ-24-TRIGGER", quote: "Low monthly payments of just $249", product: "personal_loan", channel: "affiliate_page" } as const;
    const a = findPrecedents(q, PRECEDENT_LIBRARY);
    const b = findPrecedents(q, [...PRECEDENT_LIBRARY]);
    expect(b).toEqual(a);
  });
});

describe("attachPrecedents", () => {
  const finding = { id: 7, ruleCode: "UDAAP-SUPERLATIVE", quote: "lowest rates", issue: "Unsubstantiated superlative." } as FindingView;
  const corpus = [
    prec("live-3", { source: "live", ruleCode: "UDAAP-SUPERLATIVE", originalText: "lowest rates", submissionCode: "CP-1010" }),
    prec("live-4", { source: "live", ruleCode: "UDAAP-SUPERLATIVE", originalText: "the lowest rates around", submissionCode: "CP-1020" }),
    prec("lib-5", { ruleCode: "UDAAP-SUPERLATIVE", originalText: "lowest rates in America" }),
  ];
  it("never matches a live precedent from the same submission", () => {
    const [f] = attachPrecedents([finding], { product: "personal_loan", channel: "display", excludeSubmissionCode: "CP-1010" }, corpus);
    const ids = f.precedents!.map((m) => m.precedent.id);
    expect(ids).not.toContain("live-3");
    expect(ids).toEqual(expect.arrayContaining(["live-4", "lib-5"]));
  });
  it("keeps everything without an exclusion", () => {
    const [f] = attachPrecedents([finding], { product: "personal_loan", channel: "display" }, corpus);
    expect(f.precedents![0].precedent.id).toBe("live-3");
  });
});
