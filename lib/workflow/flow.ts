/**
 * Pure workflow rules: statuses, who may do what, and deadlines. No database access, so the UI,
 * the service layer and the seed script all share exactly the same logic (and it is unit-testable).
 */

export type Status = "submitted" | "in_review" | "changes_requested" | "approved" | "rejected" | "withdrawn";
export type Role = "marketer" | "affiliate" | "reviewer" | "lead";
export type Outcome = "approved" | "changes_requested" | "rejected";

/** Statuses where compliance holds the ball (the SLA clock runs). */
export const WITH_COMPLIANCE: Status[] = ["submitted", "in_review"];
export const FINAL: Status[] = ["approved", "rejected", "withdrawn"];

export const STATUS_LABEL: Record<Status, string> = {
  submitted: "Awaiting review",
  in_review: "In review",
  changes_requested: "Changes requested",
  approved: "Approved",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

/** Hours compliance has to respond. Re-reviews of a revision are faster than first reviews. */
export const SLA_HOURS = { standard: 72, expedited: 24, resubmission: 24 } as const;
export const DUE_SOON_HOURS = 12;

export function computeDueAt(from: Date, priority: "standard" | "expedited", isResubmission: boolean): Date {
  const hours = isResubmission ? Math.min(SLA_HOURS.resubmission, SLA_HOURS[priority]) : SLA_HOURS[priority];
  return new Date(from.getTime() + hours * 3_600_000);
}

export type SlaState = "on_track" | "due_soon" | "overdue" | "not_applicable";

export function slaState(status: Status, dueAt: Date | null, now: Date = new Date()): SlaState {
  if (!dueAt || !WITH_COMPLIANCE.includes(status)) return "not_applicable";
  const msLeft = dueAt.getTime() - now.getTime();
  if (msLeft < 0) return "overdue";
  return msLeft <= DUE_SOON_HOURS * 3_600_000 ? "due_soon" : "on_track";
}

export function canReview(role: Role): boolean {
  return role === "reviewer" || role === "lead";
}

/** Statuses a reviewer may decide from. */
export function canDecideFrom(status: Status): boolean {
  return status === "in_review" || status === "submitted";
}

export function canResubmitFrom(status: Status): boolean {
  return status === "changes_requested";
}

export function canWithdrawFrom(status: Status): boolean {
  return !FINAL.includes(status);
}

export function nextStatusFor(outcome: Outcome): Status {
  return outcome;
}

/**
 * Approval guard: a high-severity finding that is still open (undecided) or accepted (confirmed
 * violation that must be fixed) blocks approval. The reviewer has to dismiss it with a reason or
 * send the asset back for changes.
 */
export function approvalBlockers(findings: { severity: string; status: string }[]): number {
  return findings.filter((f) => f.severity === "high" && (f.status === "open" || f.status === "accepted")).length;
}

/** Human-friendly submission code, e.g. CP-1042. */
export const formatCode = (n: number) => `CP-${n}`;
