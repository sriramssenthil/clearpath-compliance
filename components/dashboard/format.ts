/** Pure formatting and chart-scale helpers for the lead dashboard. No React, no dates beyond ISO strings. */

export const NO_DATA = "Not enough data yet";

/** "45 minutes", "7 hours", "1.6 days". Null means there is nothing to measure. */
export function formatHours(hours: number | null): string {
  if (hours === null || !Number.isFinite(hours)) return NO_DATA;
  if (hours < 1) {
    const m = Math.max(1, Math.round(hours * 60));
    return `${m} ${m === 1 ? "minute" : "minutes"}`;
  }
  if (hours < 24) {
    const h = Math.round(hours);
    return h >= 24 ? "1 day" : `${h} ${h === 1 ? "hour" : "hours"}`;
  }
  const d = Math.round((hours / 24) * 10) / 10;
  return d === 1 ? "1 day" : `${d.toFixed(1)} days`;
}

/** A 0..1 ratio as a whole-number percentage; null renders as "Not enough data yet". */
export function formatPercent(ratio: number | null, fallback: string = NO_DATA): string {
  if (ratio === null || !Number.isFinite(ratio)) return fallback;
  return `${Math.round(ratio * 100)}%`;
}

/** Reviewer agreement: accepted / (accepted + dismissed), null when nobody has judged a finding yet. */
export function agreementRate(accepted: number, dismissed: number): number | null {
  const judged = accepted + dismissed;
  return judged > 0 ? accepted / judged : null;
}

export function formatDecimal(n: number | null, digits = 1): string {
  return n === null || !Number.isFinite(n) ? NO_DATA : n.toFixed(digits);
}

export const pluralize = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "Sep 8" for a YYYY-MM-DD week start (UTC, as the service computes it). */
export function formatWeekLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1] ?? "";
  return y ? `${month} ${d}` : "";
}

export const STANDING_LABEL = { good: "Good standing", watch: "Watch", high_risk: "High risk" } as const;
export const STANDING_VARIANT = { good: "success", watch: "warning", high_risk: "danger" } as const;

// ---- chart scales

/** Round up to 1, 2, 5 or 10 times a power of ten, with a floor so an empty chart still has an axis. */
export function niceMax(max: number, floor = 5): number {
  const m = Math.max(floor, Math.ceil(max));
  const pow = 10 ** Math.floor(Math.log10(m));
  for (const step of [1, 2, 5, 10]) if (m <= step * pow) return step * pow;
  return 10 * pow;
}

/** Evenly spaced whole-number ticks from 0 to niceMax(max). */
export function niceTicks(max: number, floor = 5): number[] {
  const top = niceMax(max, floor);
  const divisions = [4, 5, 2, 3, 1].find((d) => top % d === 0) ?? 1;
  return Array.from({ length: divisions + 1 }, (_, i) => (top / divisions) * i);
}

/** Height or width of a mark as a percentage of the axis maximum, clamped to 0..100. */
export function percentOf(value: number, axisMax: number): number {
  if (axisMax <= 0) return 0;
  return Math.min(100, Math.max(0, (value / axisMax) * 100));
}

export interface StackSegment {
  key: string;
  value: number;
  /** Percent of the axis, measured from the segment's own baseline. */
  heightPct: number;
  /** Percent from the bottom of the plot to the segment's bottom edge. */
  bottomPct: number;
}

/** Stack values bottom to top; each segment knows where it starts and how tall it is. */
export function stackSegments(parts: { key: string; value: number }[], axisMax: number): StackSegment[] {
  let acc = 0;
  return parts.map((p) => {
    const seg = { key: p.key, value: p.value, heightPct: percentOf(p.value, axisMax), bottomPct: percentOf(acc, axisMax) };
    acc += p.value;
    return seg;
  });
}
