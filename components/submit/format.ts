/** Date helpers that render identically on server and client (fixed locale and UTC). */

const ABSOLUTE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short",
});

const DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export const formatAbsolute = (d: Date) => ABSOLUTE.format(d);
export const formatDay = (d: Date) => DAY.format(d);


/** "2 days ago" / "in 5 hours". */
export { relativeTime } from "@/lib/time";

/** Compact duration, e.g. "5h" or "2d 3h". */
export function shortDuration(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60_000));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}
