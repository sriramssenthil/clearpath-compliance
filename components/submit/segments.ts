/** Pure helpers for the pre-check UI (no React) so they can be unit tested. */

export type Sev = "high" | "medium" | "low";

export interface Locatable {
  start: number | null;
  end: number | null;
  severity: Sev;
}

export interface Segment {
  text: string;
  start: number;
  end: number;
  /** Indexes (into the array given to buildSegments) of every finding covering this stretch. Empty = plain text. */
  ids: number[];
  /** Highest severity among the covering findings. */
  severity: Sev | null;
}

const RANK: Record<Sev, number> = { high: 0, medium: 1, low: 2 };

export const severityRank = (s: Sev) => RANK[s];

/** Position order (unlocated last), then severity, so the list reads in the same order as the text. */
export function sortByPosition<T extends Locatable>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => {
    const as = a.start ?? Infinity;
    const bs = b.start ?? Infinity;
    if (as !== bs) return as < bs ? -1 : 1;
    return RANK[a.severity] - RANK[b.severity];
  });
}

const isHigh = (c: number) => c >= 0xd800 && c <= 0xdbff;
const isLow = (c: number) => c >= 0xdc00 && c <= 0xdfff;

/** Offsets are UTF-16 indexes; nudge them off the middle of a surrogate pair so an emoji is never split. */
function snap(content: string, i: number, dir: "back" | "forward"): number {
  if (i <= 0 || i >= content.length) return Math.min(Math.max(i, 0), content.length);
  if (isLow(content.charCodeAt(i)) && isHigh(content.charCodeAt(i - 1))) return dir === "back" ? i - 1 : i + 1;
  return i;
}

/** A finding's span clamped into the content, or null when it has no usable offsets. */
export function validSpan(content: string, f: Pick<Locatable, "start" | "end">): { start: number; end: number } | null {
  if (f.start === null || f.end === null) return null;
  if (!Number.isFinite(f.start) || !Number.isFinite(f.end)) return null;
  const start = snap(content, Math.max(0, Math.floor(f.start)), "back");
  const end = snap(content, Math.min(content.length, Math.floor(f.end)), "forward");
  return end > start ? { start, end } : null;
}

/**
 * Splits content into ordered, non-overlapping segments covering all of it. Overlapping findings share the
 * stretch they overlap (ids lists all of them). Findings with null or out-of-range offsets are skipped.
 */
export function buildSegments(content: string, findings: readonly Locatable[]): Segment[] {
  if (content.length === 0) return [];
  const spans = findings.map((f, id) => ({ id, span: validSpan(content, f), severity: f.severity }));
  const cuts = new Set<number>([0, content.length]);
  for (const s of spans) {
    if (s.span) {
      cuts.add(s.span.start);
      cuts.add(s.span.end);
    }
  }
  const points = [...cuts].sort((a, b) => a - b);
  const out: Segment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    const covering = spans.filter((s) => s.span && s.span.start <= start && s.span.end >= end);
    const ids = covering.map((s) => s.id);
    const severity = covering.reduce<Sev | null>((best, s) => (best === null || RANK[s.severity] < RANK[best] ? s.severity : best), null);
    const prev = out[out.length - 1];
    if (prev && prev.ids.length === ids.length && prev.ids.every((v, k) => v === ids[k])) {
      prev.end = end;
      prev.text = content.slice(prev.start, end);
    } else {
      out.push({ text: content.slice(start, end), start, end, ids, severity });
    }
  }
  return out;
}

export interface Edit {
  text: string;
  /** Range of the inserted text in the new string. */
  start: number;
  end: number;
}

/** Replaces the first occurrence of `quote` (exact, then case-insensitive). Null when the quote is not in the text. */
export function replaceQuote(text: string, quote: string, replacement: string): Edit | null {
  if (!quote) return null;
  let at = text.indexOf(quote);
  if (at === -1) {
    // Lowercasing can change string length for a few characters; only trust the index when it does not.
    const lt = text.toLowerCase();
    const lq = quote.toLowerCase();
    if (lt.length === text.length && lq.length === quote.length) at = lt.indexOf(lq);
  }
  if (at === -1) return null;
  return { text: text.slice(0, at) + replacement + text.slice(at + quote.length), start: at, end: at + replacement.length };
}

/** Adds text at the end as its own paragraph. */
export function appendText(text: string, addition: string): Edit {
  const base = text.replace(/\s+$/, "");
  const joined = base.length === 0 ? addition : `${base}\n\n${addition}`;
  return { text: joined, start: joined.length - addition.length, end: joined.length };
}

export function wordCount(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}
