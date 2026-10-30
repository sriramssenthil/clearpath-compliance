/** Pure helpers that describe a rule in plain language. No React. */
import type { RuleConfig } from "@/lib/compliance/types";
import { agreementRate } from "@/components/dashboard/format";

export function detectionLabel(kind: string, aiReview: boolean): "Pattern rule" | "AI-assisted" | "Pattern and AI" {
  if (kind === "ai") return "AI-assisted";
  return aiReview ? "Pattern and AI" : "Pattern rule";
}

export const DETECTION_CAPTION =
  "Pattern rule: decided by code alone, so the same text always gives the same result. AI-assisted: Claude looks for it and every flag is cited. Pattern and AI: code finds the clear cases and Claude checks the context. The AI only adds flags; it never approves anything.";

const count = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/** One-line summary of the deterministic config; the raw patterns are shown separately and only on request. */
export function describeConfig(config: RuleConfig): string {
  switch (config.type) {
    case "phrase":
      return `Flags any of ${count(config.patterns.length, "phrase pattern")}.`;
    case "required": {
      const t = config.triggers?.length;
      const base = t
        ? `When any of ${count(t, "trigger pattern")} appears, one of ${count(config.satisfiedBy.length, "required-text pattern")} must also appear.`
        : `One of ${count(config.satisfiedBy.length, "required-text pattern")} must appear.`;
      const scope = [config.statesAny?.length ? `only for ads targeting ${config.statesAny.join(", ")}` : "", config.affiliateOnly ? "only for affiliate submissions" : ""].filter(Boolean);
      return scope.length ? `${base} Applies ${scope.join(" and ")}.` : base;
    }
    case "numeric":
      return `Compares numbers in the copy with the product facts (check: ${config.check.replaceAll("_", " ")}).`;
    default:
      return "No deterministic check; this rule is evaluated by the AI reviewer only.";
  }
}

/** Raw regex sources grouped by role, for the lead's "Show patterns" view. */
export function configPatterns(config: RuleConfig): { label: string; items: string[] }[] {
  if (config.type === "phrase") return [{ label: "Flag when any of these match", items: config.patterns }];
  if (config.type === "required") {
    return [
      ...(config.triggers?.length ? [{ label: "Triggers", items: config.triggers }] : []),
      { label: "Satisfied by any of", items: config.satisfiedBy },
    ];
  }
  return [];
}

/** "Fired 12 times; reviewers agreed 75%" with honest wording when there is nothing to average. */
export function usageText(usage: { total: number; accepted: number; dismissed: number }): { fired: string; agreed: string } {
  const fired = usage.total === 0 ? "Never fired" : `Fired ${count(usage.total, "time")}`;
  const rate = agreementRate(usage.accepted, usage.dismissed);
  const agreed = rate === null ? "No reviewer decisions yet" : `Reviewers agreed ${Math.round(rate * 100)}%`;
  return { fired, agreed };
}
