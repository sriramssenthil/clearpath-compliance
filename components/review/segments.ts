/** Pure text segmentation for highlighting. No React: unit-tested in tests/review-utils.test.ts. */

export interface MarkRange {
  id: number;
  start: number | null;
  end: number | null;
}

export interface Segment {
  text: string;
  start: number;
  end: number;
  /** Findings covering this segment, innermost (shortest) range first. Empty = plain text. */
  ids: number[];
}

/** Moves an offset off the middle of a surrogate pair so a code point is never cut in half. */
function snap(content: string, i: number): number {
  if (i > 0 && i < content.length) {
    const code = content.charCodeAt(i);
    const prev = content.charCodeAt(i - 1);
    if (code >= 0xdc00 && code <= 0xdfff && prev >= 0xd800 && prev <= 0xdbff) return i - 1;
  }
  return i;
}

/** A usable range: integer offsets, start < end after clamping to the content. Anything else is "not located". */
export function normalizeRange(content: string, start: number | null, end: number | null): { start: number; end: number } | null {
  if (start === null || end === null || !Number.isFinite(start) || !Number.isFinite(end)) return null;
  const s = snap(content, Math.max(0, Math.floor(start)));
  const e = snap(content, Math.min(content.length, Math.floor(end)));
  return s < e ? { start: s, end: e } : null;
}

/**
 * Splits `content` at every range boundary so overlapping findings can share text: each segment
 * lists all findings covering it. Concatenating the segments always reproduces `content` exactly.
 */
export function buildSegments(content: string, marks: MarkRange[]): Segment[] {
  if (content.length === 0) return [];
  const ranges = marks.flatMap((m) => {
    const r = normalizeRange(content, m.start, m.end);
    return r ? [{ id: m.id, ...r }] : [];
  });
  if (ranges.length === 0) return [{ text: content, start: 0, end: content.length, ids: [] }];

  const cuts = [...new Set([0, content.length, ...ranges.flatMap((r) => [r.start, r.end])])].sort((a, b) => a - b);
  const out: Segment[] = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const start = cuts[i];
    const end = cuts[i + 1];
    const ids = ranges
      .filter((r) => r.start <= start && r.end >= end)
      .sort((a, b) => a.end - a.start - (b.end - b.start))
      .map((r) => r.id);
    out.push({ text: content.slice(start, end), start, end, ids });
  }
  return out;
}

/** Finding ids that have no usable range (null offsets, or an empty/out-of-bounds span). */
export function unlocatedIds(content: string, marks: MarkRange[]): number[] {
  return marks.filter((m) => normalizeRange(content, m.start, m.end) === null).map((m) => m.id);
}

/** Offsets of a selection inside rendered segments -> [start, end) in content, or null when empty. */
export function selectionToRange(content: string, start: number, end: number): { start: number; end: number; text: string } | null {
  const a = Math.min(start, end);
  const b = Math.max(start, end);
  const raw = content.slice(Math.max(0, a), Math.min(content.length, b));
  const lead = raw.length - raw.trimStart().length;
  const text = raw.trim();
  if (!text) return null;
  return { start: Math.max(0, a) + lead, end: Math.max(0, a) + lead + text.length, text };
}
