import { describe, expect, it } from "vitest";
import { mergeFindings } from "@/lib/compliance/merge";
import type { DraftFinding } from "@/lib/compliance/types";

const content = "Guaranteed approval! No credit check. Rates from 4.99%, just $199/month. Click my link!";
const applicable = new Set(["UDAAP-GUARANTEE", "REGZ-24-TRIGGER", "REGZ-24-APR", "FTC-AFFILIATE"]);

const f = (over: Partial<DraftFinding>): DraftFinding => ({
  source: "ai",
  ruleCode: "REGZ-24-TRIGGER",
  severity: "medium",
  quote: "just $199/month",
  issue: "issue",
  ...over,
});

describe("mergeFindings", () => {
  it("keeps deterministic findings and anchors them", () => {
    const det = f({ source: "rule", ruleCode: "UDAAP-GUARANTEE", severity: "high", quote: "Guaranteed approval" });
    const { findings, droppedAi } = mergeFindings(content, [det], [], { applicableRuleCodes: applicable });
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ start: 0, end: 19, quote: "Guaranteed approval" });
    expect(droppedAi).toEqual([]);
  });

  it("drops AI findings for rules not applicable, distinguishing unknown codes", () => {
    const ai = [f({ ruleCode: "MORT-NMLS" }), f({ ruleCode: "MADE-UP" })];
    const { findings, droppedAi } = mergeFindings(content, [], ai, {
      applicableRuleCodes: applicable,
      knownRuleCodes: new Set([...applicable, "MORT-NMLS"]),
    });
    expect(findings).toEqual([]);
    expect(droppedAi.map((d) => d.reason)).toEqual(["not_applicable", "unknown_rule"]);
  });

  it("drops hallucinated (unanchorable) AI quotes", () => {
    const ai = [f({ quote: "This product will make you rich beyond your wildest dreams" })];
    const { findings, droppedAi } = mergeFindings(content, [], ai, { applicableRuleCodes: applicable });
    expect(findings).toEqual([]);
    expect(droppedAi).toEqual([{ reason: "unanchored", ruleCode: "REGZ-24-TRIGGER", quote: ai[0].quote }]);
  });

  it("drops AI duplicates of deterministic findings (same rule, overlapping span); deterministic wins", () => {
    const det = f({ source: "rule", ruleCode: "REGZ-24-TRIGGER", severity: "high", quote: "Rates from 4.99%, just $199/month" });
    const ai = f({ quote: "just $199/month" });
    const { findings, droppedAi } = mergeFindings(content, [det], [ai], { applicableRuleCodes: applicable });
    expect(findings).toHaveLength(1);
    expect(findings[0].source).toBe("rule");
    expect(droppedAi.map((d) => d.reason)).toEqual(["duplicate"]);
  });

  it("keeps AI finding for the same span under a different rule", () => {
    const det = f({ source: "rule", ruleCode: "UDAAP-GUARANTEE", severity: "high", quote: "Guaranteed approval" });
    const ai = f({ ruleCode: "REGZ-24-APR", quote: "Guaranteed approval" });
    const { findings } = mergeFindings(content, [det], [ai], { applicableRuleCodes: applicable });
    expect(findings).toHaveLength(2);
  });

  it("dedupes AI findings against each other, keeping the higher severity", () => {
    const a = f({ severity: "low", quote: "Rates from 4.99%" });
    const b = f({ severity: "high", quote: "from 4.99%, just $199/month" });
    const { findings, droppedAi } = mergeFindings(content, [], [a, b], { applicableRuleCodes: applicable });
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("high");
    expect(droppedAi).toHaveLength(1);
    expect(droppedAi[0].reason).toBe("duplicate");
  });

  it("keeps deterministic findings that fail to anchor, with null offsets, sorted last", () => {
    const missing = f({ source: "rule", ruleCode: "MORT-NMLS", severity: "high", quote: "not in the text at all really" });
    const ok = f({ ruleCode: "UDAAP-GUARANTEE", severity: "high", quote: "No credit check" });
    const { findings } = mergeFindings(content, [missing], [ok], { applicableRuleCodes: applicable });
    expect(findings.map((x) => x.ruleCode)).toEqual(["UDAAP-GUARANTEE", "MORT-NMLS"]);
    expect(findings[1].start).toBeNull();
  });

  it("sorts by start, then severity, then rule code", () => {
    const a = f({ source: "rule", ruleCode: "UDAAP-GUARANTEE", severity: "medium", quote: "Guaranteed approval" });
    const b = f({ source: "rule", ruleCode: "FTC-AFFILIATE", severity: "high", quote: "Guaranteed approval" });
    const c = f({ source: "rule", ruleCode: "REGZ-24-APR", severity: "medium", quote: "Guaranteed approval" });
    const d = f({ source: "rule", ruleCode: "REGZ-24-TRIGGER", severity: "low", quote: "Click my link!" });
    const { findings } = mergeFindings(content, [d, a, c, b], [], { applicableRuleCodes: applicable });
    expect(findings.map((x) => x.ruleCode)).toEqual(["FTC-AFFILIATE", "REGZ-24-APR", "UDAAP-GUARANTEE", "REGZ-24-TRIGGER"]);
  });
});
