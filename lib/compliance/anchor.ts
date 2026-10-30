import type { AnchoredFinding, DraftFinding } from "./types";

export interface Span {
  start: number;
  end: number;
}

const FUZZY_MIN_LENGTH = 13; // fuzzy matching only for quotes longer than 12 characters
const FUZZY_MIN_SIMILARITY = 0.9;

function mapChar(ch: string): string {
  switch (ch) {
    case "‘":
    case "’":
    case "‚":
    case "‛":
    case "′":
      return "'";
    case "“":
    case "”":
    case "„":
    case "‟":
    case "″":
      return '"';
    case "‐":
    case "‑":
    case "‒":
    case "–":
    case "—":
    case "―":
    case "−":
      return "-";
    case "…":
      return "...";
    case " ":
      return " ";
    default:
      return ch;
  }
}

interface Normalized {
  text: string;
  /** For each normalized char, the original offset it came from. */
  starts: number[];
  /** For each normalized char, the original offset just past its source char. */
  ends: number[];
}

/** Lowercase, collapse whitespace, ASCII-fold quotes/dashes/ellipsis, drop zero-width chars; keeps an index map. */
function normalize(input: string): Normalized {
  const out: string[] = [];
  const starts: number[] = [];
  const ends: number[] = [];
  let i = 0;
  for (const ch of input) {
    const at = i;
    i += ch.length;
    if (/[​-‍﻿­]/.test(ch)) continue;
    const mapped = mapChar(ch);
    if (/^\s$/.test(mapped)) {
      if (out.length === 0) continue;
      if (out[out.length - 1] === " ") ends[ends.length - 1] = i;
      else {
        out.push(" ");
        starts.push(at);
        ends.push(i);
      }
      continue;
    }
    for (const m of mapped.toLowerCase()) {
      out.push(m);
      starts.push(at);
      ends.push(i);
    }
  }
  while (out.length > 0 && out[out.length - 1] === " ") {
    out.pop();
    starts.pop();
    ends.pop();
  }
  return { text: out.join(""), starts, ends };
}

/** Edit distance of `needle` against the best-matching prefix of `window`; returns distance and prefix length. */
function bestPrefixDistance(needle: string, window: string, maxDist: number): { dist: number; len: number } | null {
  let prev = Array.from({ length: window.length + 1 }, (_, j) => j);
  for (let i = 1; i <= needle.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= window.length; j++) {
      const cost = needle[i - 1] === window[j - 1] ? 0 : 1;
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      cur.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > maxDist) return null;
    prev = cur;
  }
  let best = { dist: Infinity, len: 0 };
  for (let j = 0; j <= window.length; j++) if (prev[j] < best.dist) best = { dist: prev[j], len: j };
  return best.dist <= maxDist ? best : null;
}

/** Best window of the content (by normalized edit distance) against the needle, similarity >= FUZZY_MIN_SIMILARITY. */
function fuzzyFind(norm: Normalized, needle: string): Span | null {
  const hay = norm.text;
  const maxDist = Math.floor(needle.length * (1 - FUZZY_MIN_SIMILARITY));
  if (hay.length < needle.length - maxDist) return null;

  // Candidate starts: occurrences of the quote's first/last few chars, so one corrupted edge still finds the window.
  const candidates = new Set<number>();
  const head = needle.slice(0, 6);
  const tail = needle.slice(-6);
  for (let p = hay.indexOf(head); p !== -1; p = hay.indexOf(head, p + 1)) candidates.add(p);
  for (let p = hay.indexOf(tail); p !== -1; p = hay.indexOf(tail, p + 1)) {
    for (let d = -maxDist; d <= maxDist; d++) {
      const s = p + tail.length - needle.length + d;
      if (s >= 0) candidates.add(s);
    }
  }
  // Interior corruption of both edges: also try word starts when the content is small.
  if (hay.length <= 3000) for (let p = 0; p < hay.length; p++) if (p === 0 || hay[p - 1] === " ") candidates.add(p);

  let best: { dist: number; s: number; e: number } | null = null;
  for (const s of candidates) {
    const r = bestPrefixDistance(needle, hay.slice(s, s + needle.length + maxDist), maxDist);
    if (r && r.len > 0 && (!best || r.dist < best.dist)) best = { dist: r.dist, s, e: s + r.len };
  }
  if (!best) return null;
  const sim = 1 - best.dist / Math.max(needle.length, best.e - best.s);
  if (sim < FUZZY_MIN_SIMILARITY) return null;
  let { s: from, e: to } = best;
  while (from < to && hay[from] === " ") from++;
  while (to > from && hay[to - 1] === " ") to--;
  return { start: norm.starts[from], end: norm.ends[to - 1] };
}

/** Locate `quote` in `content`; offsets always refer to the original `content` string. */
export function anchorQuote(content: string, quote: string): Span | null {
  if (!quote || !content) return null;

  const exact = content.indexOf(quote);
  if (exact !== -1) return { start: exact, end: exact + quote.length };

  const q = normalize(quote);
  if (q.text.length === 0) return null;
  const c = normalize(content);

  const at = c.text.indexOf(q.text);
  if (at !== -1) return { start: c.starts[at], end: c.ends[at + q.text.length - 1] };

  // Trailing punctuation is the most common casualty of paraphrased copying.
  const trimmed = q.text.replace(/[\s.,;:!?"')\]]+$/g, "").replace(/^[\s"'(\[]+/g, "");
  if (trimmed.length >= FUZZY_MIN_LENGTH && trimmed !== q.text) {
    const t = c.text.indexOf(trimmed);
    if (t !== -1) return { start: c.starts[t], end: c.ends[t + trimmed.length - 1] };
  }

  if (q.text.length < FUZZY_MIN_LENGTH) return null;
  return fuzzyFind(c, q.text);
}

/** Anchor drafts to `content`. Anchored findings get quote === content.slice(start, end). */
export function anchorFindings(content: string, drafts: DraftFinding[]): AnchoredFinding[] {
  return drafts.map((d) => {
    const span = anchorQuote(content, d.quote);
    if (!span) return { ...d, start: null, end: null };
    return { ...d, quote: content.slice(span.start, span.end), start: span.start, end: span.end };
  });
}
