const RTF = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 86_400_000],
  ["month", 30 * 86_400_000],
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
];

/**
 * The one relative-time formatter used across the app, so the queue, the detail page and everything else
 * agree for the same instant. Truncates toward zero ("3 days 22 hours" is "3 days ago"): an age or a
 * deadline is never overstated.
 */
export function relativeTime(date: Date, now: Date = new Date()): string {
  const diff = date.getTime() - now.getTime();
  for (const [unit, ms] of UNITS) {
    if (Math.abs(diff) >= ms) return RTF.format(Math.trunc(diff / ms), unit);
  }
  return "just now";
}
