/** Pure helpers for deadlines and ages in the queue. No React; times render in one fixed zone so server output is stable. */
import { STATUS_LABEL, type SlaState, type Status } from "@/lib/workflow/flow";

export const DISPLAY_TZ = "America/Chicago";
const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** "12m", "5h", "3d": the largest whole unit, rounded down, never "0". */
export function formatDurationShort(ms: number): string {
  const abs = Math.max(0, Math.abs(ms));
  if (abs < HOUR) return `${Math.max(1, Math.floor(abs / MIN))}m`;
  if (abs < 2 * DAY) return `${Math.floor(abs / HOUR)}h`;
  return `${Math.floor(abs / DAY)}d`;
}

const fmt = (opts: Intl.DateTimeFormatOptions, d: Date) =>
  new Intl.DateTimeFormat("en-US", { timeZone: DISPLAY_TZ, ...opts }).format(d);

/** "Tue 3pm" within a week, otherwise "Nov 4, 3pm". */
export function formatDueDay(due: Date, now: Date): string {
  const time = fmt({ hour: "numeric", minute: due.getMinutes() ? "2-digit" : undefined }, due).replace(/\s?(AM|PM)/i, (_, p: string) => p.toLowerCase());
  const within = Math.abs(due.getTime() - now.getTime()) < 6 * DAY;
  return within ? `${fmt({ weekday: "short" }, due)} ${time}` : `${fmt({ month: "short", day: "numeric" }, due)}, ${time}`;
}

/** Absolute timestamp for title attributes. */
export function formatAbsolute(d: Date): string {
  return fmt({ month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }, d);
}

export type DeadlineTone = "danger" | "warning" | "neutral";
export interface DeadlineLabel {
  text: string;
  tone: DeadlineTone;
}

/** The SLA badge text: "Overdue by 6h", "Due in 5h" (inside the 12h window), "Due Tue 3pm" otherwise. */
export function slaLabel(sla: SlaState, dueAt: Date | null, now: Date): DeadlineLabel | null {
  if (!dueAt || sla === "not_applicable") return null;
  const diff = dueAt.getTime() - now.getTime();
  if (sla === "overdue") return { text: `Overdue by ${formatDurationShort(diff)}`, tone: "danger" };
  if (sla === "due_soon") return { text: `Due in ${formatDurationShort(diff)}`, tone: "warning" };
  return { text: `Due ${formatDueDay(dueAt, now)}`, tone: "neutral" };
}

/** What the deadline column says for any status: compliance owes a response only while submitted or in review. */
export function deadlineCell(
  s: { status: Status; sla: SlaState; dueAt: Date | null; decidedAt: Date | null },
  now: Date,
): DeadlineLabel & { absolute: Date | null } {
  const label = slaLabel(s.sla, s.dueAt, now);
  if (label) return { ...label, absolute: s.dueAt };
  if (s.status === "changes_requested") return { text: "Waiting on submitter", tone: "neutral", absolute: null };
  if (s.status === "approved" || s.status === "rejected" || s.status === "withdrawn") {
    const label = STATUS_LABEL[s.status];
    return { text: s.decidedAt ? `${label} ${relativeTime(s.decidedAt, now)}` : label, tone: "neutral", absolute: s.decidedAt };
  }
  return { text: "No deadline", tone: "neutral", absolute: null };
}

/** A low-risk item with nothing flagged can be cleared quickly. Only meaningful while compliance holds it. */
export function isFastLane(s: { status: Status; riskLevel: "low" | "medium" | "high"; openFindings: number }): boolean {
  return (s.status === "submitted" || s.status === "in_review") && s.riskLevel === "low" && s.openFindings === 0;
}

/** "just now", "5 minutes ago", "3 hours ago", "2 days ago". */
export function relativeTime(then: Date, now: Date): string {
  const ms = Math.max(0, now.getTime() - then.getTime());
  if (ms < MIN) return "just now";
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"} ago`;
  if (ms < HOUR) return plural(Math.floor(ms / MIN), "minute");
  if (ms < DAY) return plural(Math.floor(ms / HOUR), "hour");
  return plural(Math.floor(ms / DAY), "day");
}

/**
 * Launch dates are calendar days stored as UTC midnight, so they are formatted in UTC.
 * "Launch passed" once the day is over; "Launches today", "Launches tomorrow", "Launches Fri" within a week, else "Launches Nov 12".
 */
export function launchLabel(
  s: { status: Status; launchDate: Date | null },
  now: Date,
): { text: string; tone: DeadlineTone; title: string } | null {
  if (!s.launchDate || s.status === "approved" || s.status === "rejected" || s.status === "withdrawn") return null;
  const day = (d: Date) => Math.floor(d.getTime() / DAY);
  const diff = day(s.launchDate) - day(now);
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...o }).format(s.launchDate!);
  const title = `Target launch ${f({ weekday: "long", month: "short", day: "numeric", year: "numeric" })}`;
  if (diff < 0) return { text: "Launch passed", tone: "danger", title: `${title}, before a compliance decision` };
  const text = diff === 0 ? "Launches today" : diff === 1 ? "Launches tomorrow" : diff < 7 ? `Launches ${f({ weekday: "short" })}` : `Launches ${f({ month: "short", day: "numeric" })}`;
  return { text, tone: diff <= 2 ? "warning" : "neutral", title };
}
