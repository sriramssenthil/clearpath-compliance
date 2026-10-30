import type { DraftFinding, ProductFacts, RuleDef } from "./types";

/**
 * A finding's `suggestion` is guidance for a person ("Add the approved email footer."). Only text that
 * can go into the ad as-is may be offered as a one-click edit, so instructions are filtered out here.
 */
const INSTRUCTION = /^(?:please\s+)?(?:add|remove|delete|replace|use|state|include|disclose|change|revise|clarify|ensure|avoid|swap|insert|rewrite|move|drop|reword|qualify|label|place|put|show|list|mention|specify|make|keep|cite|link|attach|confirm|consider)\b/i;

export function looksLikeInstruction(text: string): boolean {
  return INSTRUCTION.test(text.trim().replace(/^["'“]/, ""));
}

/** Text usable as ad copy, or undefined when it is empty, an instruction, or identical to the quote. */
export function usableCopy(text: string | null | undefined, quote?: string): string | undefined {
  const t = text?.trim();
  if (!t || looksLikeInstruction(t)) return undefined;
  if (quote !== undefined && t === quote.trim()) return undefined;
  return t;
}

/** The approved snippet a rule's guidance points to ("approved snippet: can_spam_footer"), if this product has it. */
export function snippetFor(rule: Pick<RuleDef, "guidance">, facts: ProductFacts): string | undefined {
  const ids = [...rule.guidance.matchAll(/approved snippet:\s*([a-z0-9_]+)/gi)].map((m) => m[1]);
  for (const id of ids) {
    const s = facts.approvedSnippets.find((x) => x.id === id);
    if (s) return s.text;
  }
  return undefined;
}

/** Missing-disclosure rule findings get the approved disclosure text as copy to add. */
export function withInsertText(findings: DraftFinding[], rules: RuleDef[], facts: ProductFacts): DraftFinding[] {
  const byCode = new Map(rules.map((r) => [r.code, r]));
  return findings.map((f) => {
    const rule = byCode.get(f.ruleCode);
    if (!rule || rule.config.type !== "required" || f.insertText) return f;
    const text = snippetFor(rule, facts);
    return text ? { ...f, insertText: text } : f;
  });
}
