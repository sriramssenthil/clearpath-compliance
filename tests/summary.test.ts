import { describe, expect, it } from "vitest";
import { composeSummary, describeOnly, verdictSentence } from "@/lib/compliance/summary";

describe("summary verdict always agrees with the findings", () => {
  it("states the count and severities from the final findings", () => {
    expect(verdictSentence([])).toBe("No issues found by the rule checks or the AI review.");
    expect(verdictSentence([{ severity: "medium" }])).toBe("1 issue found (1 medium severity).");
    expect(verdictSentence([{ severity: "high" }, { severity: "low" }, { severity: "high" }])).toBe("3 issues found (2 high, 1 low severity).");
  });

  it("drops a model sentence that contradicts the findings (the reported bug)", () => {
    const model = "A display banner for the ClearPath personal loan with an APR range. No compliance issues were found.";
    const s = composeSummary([{ severity: "medium" }], model);
    expect(s).toBe("1 issue found (1 medium severity). A display banner for the ClearPath personal loan with an APR range.");
    expect(s).not.toMatch(/no compliance issues/i);
  });

  it("drops other verdict phrasings but keeps the description", () => {
    expect(describeOnly("An SMS offer for a personal loan. The asset appears compliant.")).toBe("An SMS offer for a personal loan.");
    expect(describeOnly("A blog post about card rewards. The main concerns are the guarantee and missing disclosure.")).toBe("A blog post about card rewards.");
    expect(describeOnly(null)).toBe("");
  });

  it("keeps decimals, percentages and abbreviations intact (regression)", () => {
    const model = "A personal loan ad for U.S. residents offering rates from 8.99% to 35.99% APR. It notes that approval and terms depend on credit.";
    expect(describeOnly(model)).toBe(model);
    expect(composeSummary([{ severity: "medium" }], model)).toBe(`1 issue found (1 medium severity). ${model}`);
  });
});
