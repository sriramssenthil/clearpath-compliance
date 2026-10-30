/** Pure date and label helpers. Dates are formatted in UTC so server and client output always agree. */

const ABS = new Intl.DateTimeFormat("en-US", {
  month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC",
});
const DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export const formatDateTime = (d: Date) => `${ABS.format(d)} UTC`;
export const formatDay = (d: Date) => DAY.format(d);

export { relativeTime } from "@/lib/time";

export type SlaTone = "success" | "warning" | "danger";

/** Label and tone for the SLA badge. Null when the clock is not running (compliance does not hold the ball). */
export function slaBadge(
  sla: "on_track" | "due_soon" | "overdue" | "not_applicable",
  dueAt: Date | null,
  now: Date,
): { label: string; tone: SlaTone; title: string } | null {
  if (sla === "not_applicable" || !dueAt) return null;
  const hoursLeft = (dueAt.getTime() - now.getTime()) / 3_600_000;
  const title = `Compliance response due ${formatDateTime(dueAt)}`;
  if (sla === "overdue") return { label: "Overdue", tone: "danger", title };
  if (sla === "due_soon") return { label: `Due in ${Math.max(1, Math.ceil(hoursLeft))}h`, tone: "warning", title };
  return { label: "On track", tone: "success", title };
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export const PRODUCT_LABEL = { personal_loan: "Personal loan", credit_card: "Credit card", mortgage_prequal: "Mortgage prequalification" } as const;
export const CHANNEL_LABEL = { email: "Email", social: "Social", display: "Display", affiliate_page: "Affiliate page", sms: "SMS" } as const;

export const feedbackSubject = (code: string, title: string, outcome: "approved" | "changes_requested" | "rejected") =>
  `${code}: ${title} - ${outcome === "rejected" ? "not approved" : outcome === "approved" ? "approved" : "changes requested"}`;
