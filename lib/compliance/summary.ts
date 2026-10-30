import type { Severity } from "./types";

/**
 * The verdict must agree with the findings the server actually kept, so it is written here from the final
 * list, never by the model. The model only contributes a description of what the asset says; any sentence
 * in it that states a verdict ("no issues were found", "is compliant") is dropped, because the model writes
 * before the server merges rule findings and discards invalid AI ones.
 */
const VERDICT = /\b(no|zero|not any)\s+(compliance\s+)?(issues?|problems?|violations?|concerns?|findings?|flags?)\b|\b(is|appears|looks|seems)\s+(fully\s+|generally\s+|largely\s+)?compliant\b|\bcompliant\s+(as written|overall)\b|\bnothing\s+to\s+flag\b|\b(main|key|primary)\s+concerns?\b|\bflag(?:ged|s)?\b|\bviolat/i;

export function verdictSentence(findings: { severity: Severity }[]): string {
  if (findings.length === 0) return "No issues found by the rule checks or the AI review.";
  const n = (s: Severity) => findings.filter((f) => f.severity === s).length;
  const parts = (["high", "medium", "low"] as const).filter((s) => n(s) > 0).map((s) => `${n(s)} ${s}`);
  return `${findings.length} issue${findings.length === 1 ? "" : "s"} found (${parts.join(", ")} severity).`;
}

export function describeOnly(modelSummary: string | null | undefined): string {
  if (!modelSummary) return "";
  // Split only where a terminator is followed by whitespace, so decimals (8.99%) and U.S. stay intact.
  const sentences = modelSummary.trim().split(/(?<=[.!?])\s+(?=["'“(A-Z0-9])/);
  return sentences
    .map((s) => s.trim())
    .filter((s) => s && !VERDICT.test(s))
    .join(" ");
}

export function composeSummary(findings: { severity: Severity }[], modelSummary?: string | null): string {
  const description = describeOnly(modelSummary);
  return description ? `${verdictSentence(findings)} ${description}` : verdictSentence(findings);
}
