import { describe, expect, it } from "vitest";
import { runDeterministic } from "@/lib/compliance/deterministic";
import { looksLikeInstruction, usableCopy } from "@/lib/compliance/fix-text";
import { EXAMPLE_ASSETS } from "@/lib/seed/examples";
import { PRODUCT_FACTS } from "@/lib/seed/product-facts";
import { RULES } from "@/lib/seed/rules";

describe("usableCopy", () => {
  it("rejects instructions, blanks and no-op rewrites", () => {
    expect(looksLikeInstruction("Add the approved email footer.")).toBe(true);
    expect(usableCopy("Add the approved email footer.")).toBeUndefined();
    expect(usableCopy("  Remove the guarantee.")).toBeUndefined();
    expect(usableCopy("")).toBeUndefined();
    expect(usableCopy("Lowest rates", "Lowest rates")).toBeUndefined();
  });
  it("keeps real ad copy", () => {
    expect(usableCopy("Check your rate with no impact to your credit score.")).toBe("Check your rate with no impact to your credit score.");
    expect(usableCopy("ClearPath Home Lending, NMLS ID 1234567. Equal Housing Lender.")).toBeDefined();
  });
});

describe("regression: one-click edits never insert instructions", () => {
  const email = EXAMPLE_ASSETS.find((e) => e.id === "mortgage-prequal-email")!;
  const facts = PRODUCT_FACTS.find((f) => f.product === email.product)!;
  const findings = runDeterministic({ ...email, content: email.content }, RULES, facts);

  it("rule findings carry no replacement (their suggestion is guidance)", () => {
    expect(findings.length).toBeGreaterThan(0);
    for (const f of findings) expect(f.replacement).toBeUndefined();
  });

  it("the missing email footer offers the approved footer text to add, not the instruction", () => {
    const footer = findings.find((f) => f.ruleCode === "EMAIL-CANSPAM")!;
    expect(footer).toBeDefined();
    const snippet = facts.approvedSnippets.find((s) => s.id === "can_spam_footer")!.text;
    expect(footer.insertText).toBe(snippet);
    expect(looksLikeInstruction(footer.insertText!)).toBe(false);
  });

  it("every insertText on rule findings is real copy", () => {
    for (const f of findings) if (f.insertText) expect(looksLikeInstruction(f.insertText)).toBe(false);
  });
});
