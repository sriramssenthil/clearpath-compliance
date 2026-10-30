import { anchorFindings } from "./anchor";
import type { AnchoredFinding, DraftFinding, Severity } from "./types";

export type DropReason = "unknown_rule" | "not_applicable" | "unanchored" | "duplicate";
export interface DroppedAi {
  reason: DropReason;
  ruleCode: string;
  quote: string;
}

const SEVERITY_ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

const overlaps = (a: AnchoredFinding, b: AnchoredFinding): boolean =>
  a.start !== null && a.end !== null && b.start !== null && b.end !== null && a.start < b.end && b.start < a.end;

const sameQuote = (a: AnchoredFinding, b: AnchoredFinding): boolean =>
  a.quote.trim().toLowerCase() === b.quote.trim().toLowerCase();

const isDuplicate = (a: AnchoredFinding, b: AnchoredFinding): boolean =>
  a.ruleCode === b.ruleCode && (overlaps(a, b) || sameQuote(a, b));

/**
 * Deterministic findings always win. AI findings are untrusted: each must use an applicable rule,
 * quote text that really exists in the asset, and add something the rules have not already flagged.
 */
export function mergeFindings(
  content: string,
  deterministic: DraftFinding[],
  ai: DraftFinding[],
  opts: { applicableRuleCodes: Set<string>; knownRuleCodes?: Set<string> },
): { findings: AnchoredFinding[]; droppedAi: DroppedAi[] } {
  const droppedAi: DroppedAi[] = [];
  const kept: AnchoredFinding[] = anchorFindings(content, deterministic);
  const drop = (reason: DropReason, f: DraftFinding) =>
    droppedAi.push({ reason, ruleCode: f.ruleCode, quote: f.quote });

  const candidates: AnchoredFinding[] = [];
  for (const f of anchorFindings(content, ai)) {
    if (!opts.applicableRuleCodes.has(f.ruleCode)) {
      drop(opts.knownRuleCodes && !opts.knownRuleCodes.has(f.ruleCode) ? "unknown_rule" : "not_applicable", f);
    } else if (f.start === null) {
      drop("unanchored", f);
    } else if (kept.some((d) => isDuplicate(d, f))) {
      drop("duplicate", f);
    } else {
      candidates.push(f);
    }
  }

  // Higher severity first (then higher confidence) so that the survivor of an overlap is the stronger flag.
  const confRank = { high: 0, medium: 1, low: 2 } as const;
  candidates.sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      confRank[a.confidence ?? "medium"] - confRank[b.confidence ?? "medium"],
  );
  const aiKept: AnchoredFinding[] = [];
  for (const f of candidates) {
    if (aiKept.some((k) => isDuplicate(k, f))) drop("duplicate", f);
    else aiKept.push(f);
  }

  const findings = [...kept, ...aiKept].sort((a, b) => {
    if ((a.start === null) !== (b.start === null)) return a.start === null ? 1 : -1;
    return (
      (a.start ?? 0) - (b.start ?? 0) ||
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      a.ruleCode.localeCompare(b.ruleCode)
    );
  });
  return { findings, droppedAi };
}
