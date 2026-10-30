import type { Channel, Product, Severity } from "./types";

export const RISK_THRESHOLDS = { medium: 5, high: 10 } as const;

const FINDING_POINTS: Record<Severity, number> = { high: 5, medium: 2, low: 1 };
const PRODUCT_POINTS: Record<Product, number> = { mortgage_prequal: 3, credit_card: 2, personal_loan: 1 };
const REJECTION_RATE_THRESHOLD = 0.3;

export function computeRisk(
  findings: { severity: Severity }[],
  ctx: { product: Product; channel: Channel; isAffiliate: boolean },
  partnerRejectionRate?: number,
): { score: number; level: "low" | "medium" | "high" } {
  let score = findings.reduce((sum, f) => sum + FINDING_POINTS[f.severity], 0);
  score += PRODUCT_POINTS[ctx.product];
  if (ctx.isAffiliate) score += 2;
  if (ctx.channel === "social" || ctx.channel === "sms") score += 2;
  if (partnerRejectionRate !== undefined && partnerRejectionRate > REJECTION_RATE_THRESHOLD) score += 2;

  const level = score >= RISK_THRESHOLDS.high ? "high" : score >= RISK_THRESHOLDS.medium ? "medium" : "low";
  return { score, level };
}

/** Computed in code, never by the model: any high finding or three or more findings needs changes. */
export function recommend(findings: { severity: Severity }[]): "ready" | "needs_changes" {
  return findings.some((f) => f.severity === "high") || findings.length >= 3 ? "needs_changes" : "ready";
}
