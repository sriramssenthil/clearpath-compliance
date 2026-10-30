/** Queue priority: one explainable score per submission. Pure; no I/O. */
import type { PriorityBreakdown } from "@/lib/compliance/feature-types";
import { DUE_SOON_HOURS } from "./flow";
import type { SubmissionSummary } from "./types";

export type PartnerStanding = "good" | "watch" | "high_risk";

/**
 * ClearPath internal policy, tuned by the compliance lead. Points are additive.
 * - Open findings dominate: a high-severity finding is a likely consumer-harm or enforcement issue, so it
 *   outweighs everything except a blown deadline or launch.
 * - Deadlines: an overdue SLA or a launch that has already happened (the asset may be live unapproved) are
 *   the most urgent operational signals; an imminent launch is close behind.
 * - Expedited adds a little: the submitter already stated a business reason, and the SLA clock reflects it.
 * - Partner standing and product reflect where problems historically come from (rejection rates; mortgage
 *   ads carry the most disclosure rules, credit cards the next most).
 * - Age is only a tie-breaker so nothing waits forever; it is capped so it never outranks a real risk.
 */
export const PRIORITY_WEIGHTS = {
  highFinding: 5,
  otherFinding: 2,
  slaOverdue: 6,
  slaDueSoon: 3,
  expedited: 2,
  launchPassed: 6,
  launchWithin48h: 5,
  launchWithin7d: 2,
  partnerHighRisk: 3,
  partnerWatch: 1,
  productMortgage: 2,
  productCreditCard: 1,
  agePerDay: 1,
  ageMax: 3,
} as const;

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const CLOSED = new Set(["approved", "rejected", "withdrawn"]);

export type PriorityInput = Pick<
  SubmissionSummary,
  "status" | "priority" | "product" | "openFindings" | "highOpenFindings" | "dueAt" | "sla" | "launchDate" | "submittedAt"
> & { partnerStanding?: PartnerStanding };

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function computePriority(item: PriorityInput, now: Date): PriorityBreakdown {
  const W = PRIORITY_WEIGHTS;
  const factors: PriorityBreakdown["factors"] = [];
  const add = (label: string, points: number) => {
    if (points > 0) factors.push({ label, points });
  };

  const high = item.highOpenFindings;
  const other = Math.max(0, item.openFindings - high);
  add(`${plural(high, "high-severity finding")} open (${W.highFinding} each)`, high * W.highFinding);
  add(`${plural(other, "other finding")} open (${W.otherFinding} each)`, other * W.otherFinding);

  // Only while compliance holds the clock.
  if (item.dueAt && item.sla !== "not_applicable") {
    const left = item.dueAt.getTime() - now.getTime();
    if (left <= 0) add("SLA deadline passed", W.slaOverdue);
    else if (left <= DUE_SOON_HOURS * HOUR) add(`SLA due within ${DUE_SOON_HOURS} hours`, W.slaDueSoon);
  }

  if (item.priority === "expedited") add("Expedited request", W.expedited);

  // Launch dates are calendar days (stored as UTC midnight): "passed" means the launch day is over.
  if (item.launchDate && !CLOSED.has(item.status)) {
    const start = item.launchDate.getTime();
    if (start + DAY <= now.getTime()) add("Launch date passed, not yet approved", W.launchPassed);
    else if (start - now.getTime() <= 48 * HOUR) add("Launches within 48 hours", W.launchWithin48h);
    else if (start - now.getTime() <= 7 * DAY) add("Launches within 7 days", W.launchWithin7d);
  }

  if (item.partnerStanding === "high_risk") add("Partner on high-risk standing", W.partnerHighRisk);
  else if (item.partnerStanding === "watch") add("Partner on watch", W.partnerWatch);

  if (item.product === "mortgage_prequal") add("Mortgage product", W.productMortgage);
  else if (item.product === "credit_card") add("Credit card product", W.productCreditCard);

  const days = Math.floor(Math.max(0, now.getTime() - item.submittedAt.getTime()) / DAY);
  add(`Waiting ${plural(days, "day")}`, Math.min(W.ageMax, days * W.agePerDay));

  return { score: factors.reduce((s, f) => s + f.points, 0), factors };
}

/** Score descending; ties go to the earlier due date (no due date last), then the lower id. */
export function comparePriority(
  a: { id: number; dueAt: Date | null; priorityScore?: PriorityBreakdown },
  b: { id: number; dueAt: Date | null; priorityScore?: PriorityBreakdown },
): number {
  return (
    (b.priorityScore?.score ?? 0) - (a.priorityScore?.score ?? 0) ||
    (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity) ||
    a.id - b.id
  );
}

/** Score at which the queue bar is drawn full (scores above it are still shown as numbers). */
export const PRIORITY_BAR_MAX = 25;
