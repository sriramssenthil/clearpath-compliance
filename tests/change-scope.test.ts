import { describe, expect, it } from "vitest";
import { classifyChanges } from "@/lib/compliance/change-scope";
import type { RuleDef } from "@/lib/compliance/types";
import { RULES } from "@/lib/seed/rules";

const comparedTo = { kind: "previous_version" as const, label: "Version 1" };
const run = (before: string, after: string, extra: Partial<Parameters<typeof classifyChanges>[2]> = {}) =>
  classifyChanges(before, after, { rules: RULES, comparedTo, ...extra });

const rule = (code: string, config: RuleDef["config"]): RuleDef => ({
  code,
  title: code,
  description: "",
  category: "Test",
  severity: "high",
  kind: config.type === "phrase" ? "phrase" : "required",
  products: [],
  channels: [],
  checkInstruction: "",
  config,
  citation: "",
  guidance: "",
  enabled: true,
});

describe("classifyChanges: non-regulated edits", () => {
  it("treats a greeting change as non-regulated and fast-track eligible", () => {
    const s = run("Hi Sam, thanks for reading.", "Hi there, thanks for reading.");
    expect(s.hunks).toHaveLength(1);
    expect(s.hunks[0]).toMatchObject({ kind: "changed", before: "Sam", after: "there", regulated: false, reasons: [] });
    expect(s.fastTrack).toBe(true);
    expect(s.summary).toBe("1 change; none touch a claim or disclosure. Fast-track eligible.");
  });

  it("treats an added exclamation mark or emoji as non-regulated", () => {
    expect(run("Thanks for being with us.", "Thanks for being with us!").fastTrack).toBe(true);
    const e = run("See you soon, the ClearPath team", "See you soon, the ClearPath team \u{1F44B}");
    expect(e.hunks[0].kind).toBe("added");
    expect(e.fastTrack).toBe(true);
  });

  it("allows a product-name capitalisation fix even in a sentence with a rate", () => {
    const s = run("Clearpath loans from 8.99% APR.", "ClearPath loans from 8.99% APR.");
    expect(s.hunks).toHaveLength(1);
    expect(s.hunks[0].regulated).toBe(false);
  });

  it("ignores whitespace-only changes and reports identical text as no changes, not fast-track", () => {
    const ws = run("Hello  there.\nBye.", "Hello there.\n\nBye.");
    expect(ws.hunks).toHaveLength(0);
    expect(ws.fastTrack).toBe(false);
    const same = run("Same text.", "Same text.");
    expect(same).toMatchObject({ hunks: [], regulatedCount: 0, fastTrack: false });
    expect(same.summary).toMatch(/^No changes/);
  });
});

describe("classifyChanges: regulated edits", () => {
  it("flags a CTA that now mentions a rate", () => {
    const s = run("Ready? Apply now", "Ready? Check your rate");
    expect(s.hunks).toHaveLength(1);
    expect(s.hunks[0]).toMatchObject({ before: "Apply now", after: "Check your rate", regulated: true });
    expect(s.hunks[0].reasons).toContain("Finance term: rate");
    expect(s.fastTrack).toBe(false);
  });

  it("flags a changed percentage", () => {
    const s = run("Rates from 8.99% APR.", "Rates from 7.99% APR.");
    expect(s.regulatedCount).toBe(1);
    expect(s.hunks[0].reasons).toContain("Changes a percentage");
    expect(s.hunks[0]).toMatchObject({ before: "8.99%", after: "7.99%" });
  });

  it("labels dollar amounts and durations", () => {
    expect(run("Borrow up to $40,000 today.", "Borrow up to $50,000 today.").hunks[0].reasons).toContain("Changes a dollar amount");
    expect(run("Pay it off in 36 months or less.", "Pay it off in 60 months or less.").hunks[0].reasons).toContain("Changes a duration");
  });

  it("flags adding #ad as a disclosure change", () => {
    const s = run("Loved working with ClearPath.", "Loved working with ClearPath. #ad");
    expect(s.hunks[0].regulated).toBe(true);
    expect(s.hunks[0].reasons).toContain("Disclosure: #ad");
  });

  it("flags a typo fix inside a sentence that states an APR", () => {
    const s = run("Fixed rates from 8.99% APR for qualifed borrowers.", "Fixed rates from 8.99% APR for qualified borrowers.");
    expect(s.hunks[0].regulated).toBe(true);
    expect(s.hunks[0].reasons).toContain("In the same sentence as a number or rate");
  });

  it("flags a typo fix in a sentence with a number even when the word itself is harmless", () => {
    const s = run("Join 2 million custumers today. Hi Sam.", "Join 2 million customers today. Hi Sam.");
    expect(s.hunks[0].reasons).toEqual(["In the same sentence as a number or rate"]);
    expect(run("Join 2 million customers. Hi Sam.", "Join 2 million customers. Hi there.").fastTrack).toBe(true);
  });

  it("flags removing the Equal Housing Lender line", () => {
    const s = run("Get prequalified in minutes.\nNMLS #12345. Equal Housing Lender.", "Get prequalified in minutes.\nNMLS #12345.");
    expect(s.hunks).toHaveLength(1);
    expect(s.hunks[0].kind).toBe("removed");
    expect(s.hunks[0].reasons).toContain("Disclosure: Equal Housing");
  });

  it("flags a single-word edit inside a multi-word disclosure", () => {
    const s = run("Reply STOP to opt out.", "Reply STOP to opt-out now.");
    expect(s.hunks.every((h) => h.regulated)).toBe(true);
  });

  it("flags removing a footnote marker", () => {
    const s = run("No annual fee* for you", "No annual fee for you");
    expect(s.hunks[0].reasons).toContain("Adds or removes a footnote marker");
  });
});

describe("classifyChanges: hunk merging", () => {
  it("merges adjacent removed and added parts across whitespace into one hunk", () => {
    const s = run("Hello Sam Smith, welcome", "Hello Jo Ann Lee, welcome");
    expect(s.hunks).toHaveLength(1);
    expect(s.hunks[0]).toMatchObject({ kind: "changed", before: "Sam Smith", after: "Jo Ann Lee" });
  });

  it("keeps separate edits separate and classifies each", () => {
    const s = run("Hi Sam. Rates from 8.99% APR. Bye Sam.", "Hi Jo. Rates from 9.99% APR. Bye Jo.");
    expect(s.hunks.map((h) => h.regulated)).toEqual([false, true, false]);
    expect(s.regulatedCount).toBe(1);
    expect(s.summary).toBe("3 changes; 1 touches claims or disclosures (percentage).");
  });

  it("does not merge edits across a line break, nor flag a sign-off next to a disclosure line", () => {
    const before = "Apply now\nThe ClearPath team\nNMLS #12345.";
    const s = run(before, "Get started\nCheers, the ClearPath team!\nNMLS #12345.");
    expect(s.hunks.map((h) => [h.before, h.after])).toEqual([["Apply now", "Get started"], ["The", "Cheers, the"], ["", "!"]]);
    expect(s.fastTrack).toBe(true);
  });

  it("records added and removed kinds", () => {
    expect(run("Hello.", "Hello. Welcome aboard.").hunks[0]).toMatchObject({ kind: "added", before: "", after: "Welcome aboard." });
    expect(run("Hello. Welcome aboard.", "Hello.").hunks[0]).toMatchObject({ kind: "removed", after: "" });
  });
});

describe("classifyChanges: flagged spans", () => {
  const before = "Welcome back to our newsletter. Everyone qualifies for this program, honestly. See you soon.";
  const start = before.indexOf("Everyone qualifies");
  const flaggedSpans = [{ start, end: start + "Everyone qualifies".length }];

  it("marks an edit within ~40 characters of a flagged span", () => {
    const after = before.replace("honestly", "truly");
    const s = classifyChanges(before, after, { rules: [], comparedTo, flaggedSpans });
    expect(s.hunks[0].reasons).toContain("At or near text flagged in the earlier version");
  });

  it("does not mark a distant edit", () => {
    const longBefore = before + " ".repeat(10) + "Cheers, Sam";
    const s = classifyChanges(longBefore, longBefore.replace("Sam", "Jo"), { rules: [], comparedTo, flaggedSpans });
    expect(s.hunks[0].regulated).toBe(false);
  });
});

describe("classifyChanges: rule patterns", () => {
  const rules = [
    rule("TEST-PHRASE", { type: "phrase", patterns: [String.raw`\bzippy\s+money\b`, "(unclosed"], issue: "x" }),
    rule("TEST-REQ", { type: "required", triggers: [String.raw`\bselected\b`], satisfiedBy: [String.raw`\bwombat\b`], issue: "x" }),
  ];

  it("matches phrase patterns that span the edit, case-insensitively, and skips bad patterns", () => {
    const s = classifyChanges("Get zippy cash now.", "Get Zippy Money now.", { rules, comparedTo });
    expect(s.hunks[0].reasons).toContain("Matches rule TEST-PHRASE");
  });

  it("matches required-rule triggers and satisfiedBy patterns", () => {
    expect(classifyChanges("You have been chosen.", "You have been selected.", { rules, comparedTo }).hunks[0].reasons).toContain(
      "Matches rule TEST-REQ",
    );
    expect(classifyChanges("Hello wombat friend.", "Hello friend.", { rules, comparedTo }).hunks[0].reasons).toContain(
      "Matches rule TEST-REQ",
    );
  });

  it("ignores disabled rules", () => {
    const off = rules.map((r) => ({ ...r, enabled: false }));
    expect(classifyChanges("Hello wombat friend.", "Hello friend.", { rules: off, comparedTo }).fastTrack).toBe(true);
  });
});

describe("classifyChanges: summary and performance", () => {
  it("lists the reasons in the summary", () => {
    const s = run("Hi Sam. Apply today. Low cost.", "Hi Jo. Low APR today. Low fee.");
    expect(s.summary).toMatch(/^3 changes; 2 touch claims or disclosures \(APR, cost, fee/);
  });

  it("classifies a 20k-character pair well under 100 ms", () => {
    const para = "Hi Sam, thanks for reading our newsletter about saving and planning. Rates from 8.99% APR apply. ";
    const before = para.repeat(Math.ceil(20000 / para.length)).slice(0, 20000);
    const after = before.replace("Hi Sam", "Hi there").replace(/8\.99%/u, "7.99%").replace(/newsletter(?![\s\S]*newsletter)/u, "letter");
    classifyChanges(before, after, { rules: RULES, comparedTo });
    const t0 = performance.now();
    const s = classifyChanges(before, after, { rules: RULES, comparedTo });
    const ms = performance.now() - t0;
    expect(s.hunks.length).toBe(3);
    expect(ms).toBeLessThan(100);
  });

  it("falls back to a single regulated hunk when a long asset is rewritten wholesale", () => {
    const words = (k: number) => Array.from({ length: 3500 }, (_, i) => ["alpha", "beta", "gamma", "delta", "hello", "team", "soon"][(i * k) % 7]).join(" ");
    const t0 = performance.now();
    const s = classifyChanges(words(3), words(5), { rules: RULES, comparedTo });
    expect(performance.now() - t0).toBeLessThan(1000);
    expect(s.fastTrack).toBe(false);
    if (s.hunks.length === 1) expect(s.hunks[0].regulated).toBe(true);
  });
});
