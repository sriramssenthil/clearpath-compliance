import { diffWordsWithSpace } from "diff";
import type { ChangeHunk, ChangeScope } from "./feature-types";
import type { RuleDef } from "./types";

/**
 * Change-scoped review: split the difference between two versions into hunks and mark each one that
 * could touch a claim or a disclosure. Deliberately biased toward "regulated": a false fast-track lets
 * a claim change slip past the reviewer, a false "regulated" only costs a closer look. Reviewer aid only.
 */

export interface ClassifyOptions {
  rules: RuleDef[];
  /** Offsets into `before` of text that was flagged in the earlier version. */
  flaggedSpans?: { start: number; end: number }[];
  comparedTo: ChangeScope["comparedTo"];
}

interface Span {
  start: number;
  end: number;
}
interface LabeledSpan extends Span {
  label: string;
}

const FLAG_PROXIMITY = 40;
const MAX_MATCHES = 2000;
const MAX_EXPAND = 40;
const DIFF_TIMEOUT_MS = 250; // a full rewrite of a long asset falls back to "review everything"

const FINANCE_TERMS: [string, string][] = [
  ["APR", String.raw`\baprs?\b|annual percentage`],
  ["rate", String.raw`\brates?\b`],
  ["interest", String.raw`\binterest\b`],
  ["fee", String.raw`\bfees?\b`],
  ["cost", String.raw`\bcosts?\b`],
  ["payment", String.raw`\bpayments?\b|\bpay\b`],
  ["term", String.raw`\bterms?\b`],
  ["month", String.raw`\bmonths?\b|\bmonthly\b`],
  ["loan amount", String.raw`\bloans?\b|\bborrow\w*`],
  ["credit", String.raw`\bcredit\b`],
  ["approval", String.raw`\bapprov\w*`],
  ["qualify", String.raw`\bqualif\w*`],
  ["guarantee", String.raw`\bguarant\w*`],
  ["prequalify", String.raw`\bpre-?\s?qualif\w*`],
  ["pre-approval", String.raw`\bpre-?\s?approv\w*`],
  ["offer", String.raw`\boffer\w*`],
  ["introductory", String.raw`\bintro\w*`],
  ["cash back", String.raw`\bcash[- ]?back\b`],
  ["rewards", String.raw`\brewards?\b`],
  ["balance transfer", String.raw`\bbalance transfers?\b`],
  ["no annual fee", String.raw`\bno annual fee\b`],
  ["limited time", String.raw`\blimited[- ]time\b`],
  ["today only", String.raw`\btoday only\b`],
  ["lowest", String.raw`\blowest\b`],
  ["best", String.raw`\bbest\b`],
  ["#1", String.raw`#\s?1\b|\bnumber one\b|\bno\.\s?1\b`],
  ["free", String.raw`\bfree\b`],
  ["fixed or variable", String.raw`\bfixed\b|\bvariable\b`],
  ["debt", String.raw`\bdebt\b|\bconsolidat\w*`],
  ["savings", String.raw`\bsav(?:e|es|ings?)\b`],
];

const DISCLOSURE_TERMS: [string, string][] = [
  ["NMLS", String.raw`\bnmls\b`],
  ["Equal Housing", String.raw`\bequal housing\b|\bhousing lender\b`],
  ["unsubscribe", String.raw`\bunsubscrib\w*`],
  ["opt out", String.raw`\bopt[- ]?out\b`],
  ["terms apply", String.raw`\bterms?\s+(?:and conditions\s+|&\s+conditions\s+)?apply\b|\bconditions apply\b`],
  ["#ad", String.raw`#ad\b|#advert\w*|\badvertis\w*`],
  ["sponsored", String.raw`\bsponsor\w*`],
  ["paid", String.raw`\bpaid\b`],
  ["commission", String.raw`\bcommission\w*`],
  ["license", String.raw`\blicen[cs]\w*`],
  ["California Financing Law", String.raw`\bcalifornia financing law\b`],
  ["affiliate", String.raw`\baffiliat\w*`],
  ["FDIC", String.raw`\bfdic\b`],
  ["disclosure", String.raw`\bdisclos\w*`],
  ["lender", String.raw`\blender\b`],
];

// "STOP" is matched case-sensitively: lower-case "stop" is ordinary prose, the opt-out keyword is upper case.
const STOP_KEYWORD = /\bSTOP\b/gu;
const FOOTNOTE = /[*†‡§¹²³]/u;
const NUMBER_WORDS =
  /\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|half|double|triple)\b/iu;
const DURATION_AFTER = /^\s*(?:-?\s*)?(?:days?|weeks?|months?|mos?\b|years?|yrs?\b)/iu;
const DURATION_IN = /\d\s*-?\s*(?:days?|weeks?|months?|mos?|years?|yrs?)\b/iu;

function compile(pattern: string, flags: string): RegExp | null {
  try {
    return new RegExp(pattern, flags);
  } catch {
    return null;
  }
}

function spansOf(re: RegExp, text: string, label: string, out: LabeledSpan[]): void {
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  for (let n = 0; n < MAX_MATCHES && (m = re.exec(text)); n++) {
    if (m[0].length === 0) {
      re.lastIndex++;
      continue;
    }
    out.push({ start: m.index, end: m.index + m[0].length, label });
  }
}

/** Every deterministic pattern a rule carries, matching how lib/compliance/deterministic.ts reads them. */
function rulePatterns(rules: RuleDef[]): { code: string; re: RegExp }[] {
  const out: { code: string; re: RegExp }[] = [];
  for (const rule of rules) {
    const cfg = rule.config;
    const patterns =
      cfg.type === "phrase" ? cfg.patterns : cfg.type === "required" ? [...(cfg.triggers ?? []), ...cfg.satisfiedBy] : [];
    for (const p of patterns) {
      const re = typeof p === "string" ? compile(p, "iug") : null;
      if (re) out.push({ code: rule.code, re });
    }
  }
  return out;
}

interface TextIndex {
  text: string;
  finance: LabeledSpan[];
  disclosure: LabeledSpan[];
  rules: LabeledSpan[];
  sentences: { start: number; end: number; hasNumber: boolean }[];
}

const FINANCE_RES = FINANCE_TERMS.map(([label, p]) => ({ label, re: new RegExp(p, "giu") }));
const DISCLOSURE_RES = DISCLOSURE_TERMS.map(([label, p]) => ({ label, re: new RegExp(p, "giu") }));

function sentencesOf(text: string): TextIndex["sentences"] {
  const out: TextIndex["sentences"] = [];
  const boundary = /[.!?]+(?=\s|$)|\n/gu;
  let start = 0;
  let m: RegExpExecArray | null;
  while ((m = boundary.exec(text))) {
    const end = m.index + m[0].length;
    out.push({ start, end, hasNumber: /\d/.test(text.slice(start, end)) });
    start = end;
  }
  if (start < text.length) out.push({ start, end: text.length, hasNumber: /\d/.test(text.slice(start)) });
  return out;
}

function indexText(text: string, rules: { code: string; re: RegExp }[]): TextIndex {
  const finance: LabeledSpan[] = [];
  const disclosure: LabeledSpan[] = [];
  const ruleSpans: LabeledSpan[] = [];
  for (const { label, re } of FINANCE_RES) spansOf(re, text, label, finance);
  for (const { label, re } of DISCLOSURE_RES) spansOf(re, text, label, disclosure);
  spansOf(STOP_KEYWORD, text, "STOP", disclosure);
  for (const { code, re } of rules) spansOf(re, text, code, ruleSpans);
  return { text, finance, disclosure, rules: ruleSpans, sentences: sentencesOf(text) };
}

/** A pure insertion touches a match it falls inside or directly abuts (it may extend or qualify it). */
function touches(s: Span, r: Span): boolean {
  return r.start === r.end ? s.start <= r.start && s.end >= r.start : s.start < r.end && s.end > r.start;
}

function labelsTouching(spans: LabeledSpan[], r: Span, out: Set<string>): void {
  for (const s of spans) if (touches(s, r)) out.add(s.label);
}

function expandToToken(text: string, r: Span): Span {
  let { start, end } = r;
  for (let i = 0; i < MAX_EXPAND && start > 0 && !/\s/.test(text[start - 1]); i++) start--;
  for (let i = 0; i < MAX_EXPAND && end < text.length && !/\s/.test(text[end]); i++) end++;
  return { start, end };
}

/** What kind of number a changed stretch carries, judged from the whole token around it. */
function numberKind(idx: TextIndex, r: Span, raw: string): string | null {
  const span = expandToToken(idx.text, r);
  const token = idx.text.slice(span.start, span.end);
  if (!/\d/.test(token) && !NUMBER_WORDS.test(raw)) return null;
  if (/%|percent/iu.test(token)) return "percentage";
  if (/\$/.test(token)) return "dollar amount";
  if (DURATION_IN.test(token) || DURATION_IN.test(raw) || DURATION_AFTER.test(idx.text.slice(span.end, span.end + 12)))
    return "duration";
  return "number";
}

function sentenceHasNumber(idx: TextIndex, r: Span): boolean {
  for (const s of idx.sentences) {
    if (s.start > r.end) break;
    const inside = r.start === r.end ? s.start <= r.start && r.start <= s.end : s.start < r.end && s.end > r.start;
    if (inside && s.hasNumber) return true;
  }
  return false;
}

interface RawHunk {
  b: Span;
  a: Span;
}

function rawHunks(before: string, after: string): RawHunk[] | null {
  const parts = diffWordsWithSpace(before, after, { timeout: DIFF_TIMEOUT_MS });
  if (!parts) return null;
  const out: RawHunk[] = [];
  let bPos = 0;
  let aPos = 0;
  let open: RawHunk | null = null;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    const len = p.value.length;
    if (p.added || p.removed) {
      open ??= { b: { start: bPos, end: bPos }, a: { start: aPos, end: aPos } };
      if (p.added) aPos += len;
      else bPos += len;
      open.b.end = bPos;
      open.a.end = aPos;
      continue;
    }
    // Spaces between two changes belong to one edit ("Apply now" -> "Check your rate"); a line break ends it.
    const next = parts[i + 1];
    const bridge = open && /^[^\S\n]+$/u.test(p.value) && next && (next.added || next.removed);
    bPos += len;
    aPos += len;
    if (bridge && open) {
      open.b.end = bPos;
      open.a.end = aPos;
    } else if (open) {
      out.push(open);
      open = null;
    }
  }
  if (open) out.push(open);
  return out.map((h) => toWholeTokens(before, after, h));
}

/**
 * Widen an edit that splits a number ("8.99%" -> "7.99%" diffs as "8" -> "7") to the whole number, so the
 * reviewer sees what changed. Words are already whole diff tokens. The context around a hunk is identical on
 * both sides, so both spans grow by the same amount.
 */
function toWholeTokens(before: string, after: string, h: RawHunk): RawHunk {
  const solid = (ch: string | undefined) => ch !== undefined && /[\d.,%$]/u.test(ch);
  const edges = [before[h.b.start - 1], before[h.b.end], before.slice(h.b.start, h.b.end), after.slice(h.a.start, h.a.end)];
  if (!edges.some((t) => t !== undefined && /\d/u.test(t))) return h;
  let left = 0;
  while (left < MAX_EXPAND && solid(before[h.b.start - left - 1]) && h.a.start - left - 1 >= 0) left++;
  let right = 0;
  while (right < MAX_EXPAND && solid(before[h.b.end + right]) && h.a.end + right < after.length) right++;
  return { b: { start: h.b.start - left, end: h.b.end + right }, a: { start: h.a.start - left, end: h.a.end + right } };
}

function trimSpan(text: string, r: Span): Span {
  let { start, end } = r;
  while (start < end && /\s/.test(text[start])) start++;
  while (end > start && /\s/.test(text[end - 1])) end--;
  return start === end ? { start: r.start, end: r.start } : { start, end };
}

/** Concrete reasons read better than rule codes; codes appear only when nothing else explains the flag. */
function summaryTags(tags: { tag: string; rank: number }[]): string[] {
  const plain = tags.filter((t) => t.rank < 3);
  return (plain.length ? plain : tags).sort((x, y) => x.rank - y.rank).map((t) => t.tag);
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function summarize(hunks: ChangeHunk[], regulated: number, tags: string[], identical: boolean): string {
  if (hunks.length === 0) return identical ? "No changes: the text is identical." : "No changes beyond whitespace and line breaks.";
  const base = plural(hunks.length, "change", "changes");
  if (regulated === 0) return `${base}; none touch a claim or disclosure. Fast-track eligible.`;
  const shown = tags.slice(0, 4).join(", ");
  const more = tags.length > 4 ? `, +${tags.length - 4} more` : "";
  const verb = regulated === 1 ? "touches" : "touch";
  return `${base}; ${regulated} ${verb} claims or disclosures (${shown}${more}).`;
}

export function classifyChanges(before: string, after: string, opts: ClassifyOptions): ChangeScope {
  const { comparedTo } = opts;
  if (before === after) return { comparedTo, hunks: [], regulatedCount: 0, fastTrack: false, summary: summarize([], 0, [], true) };

  const raw = rawHunks(before, after);
  if (!raw) {
    const hunk: ChangeHunk = {
      kind: "changed",
      before,
      after,
      regulated: true,
      reasons: ["Too many changes to compare word by word; review the whole text"],
    };
    return { comparedTo, hunks: [hunk], regulatedCount: 1, fastTrack: false, summary: "The text was largely rewritten; review the whole text." };
  }

  const rules = rulePatterns(opts.rules.filter((r) => r.enabled !== false));
  const bi = indexText(before, rules);
  const ai = indexText(after, rules);
  const flagged = opts.flaggedSpans ?? [];
  const hunks: ChangeHunk[] = [];
  const allTags: { tag: string; rank: number }[] = [];

  for (const h of raw) {
    const b = trimSpan(before, h.b);
    const a = trimSpan(after, h.a);
    const bText = before.slice(b.start, b.end);
    const aText = after.slice(a.start, a.end);
    if (bText.replace(/\s+/gu, "") === aText.replace(/\s+/gu, "")) continue;

    const reasons: string[] = [];
    // Rank orders the summary: concrete claims first, rule codes last.
    const add = (reason: string, tag: string, rank: number) => {
      if (!reasons.includes(reason)) reasons.push(reason);
      if (!allTags.some((t) => t.tag === tag)) allTags.push({ tag, rank });
    };

    const nums = new Set<string>();
    for (const [idx, r, t] of [[bi, b, bText], [ai, a, aText]] as const) {
      if (r.start === r.end) continue;
      const kind = numberKind(idx, r, t);
      if (kind) nums.add(kind);
    }
    for (const k of nums) add(`Changes a ${k}`, k, 0);

    const finance = new Set<string>();
    const disclosure = new Set<string>();
    const ruleCodes = new Set<string>();
    for (const [idx, r] of [[bi, b], [ai, a]] as const) {
      labelsTouching(idx.finance, r, finance);
      labelsTouching(idx.disclosure, r, disclosure);
      labelsTouching(idx.rules, r, ruleCodes);
    }
    for (const t of finance) add(`Finance term: ${t}`, t, 1);
    for (const t of disclosure) add(`Disclosure: ${t}`, t, 1);
    for (const c of ruleCodes) add(`Matches rule ${c}`, c, 3);

    if (FOOTNOTE.test(bText) || FOOTNOTE.test(aText)) add("Adds or removes a footnote marker", "footnote marker", 2);

    const nearFlag = { start: b.start - FLAG_PROXIMITY, end: b.end + FLAG_PROXIMITY };
    if (flagged.some((f) => f.start < nearFlag.end && f.end > nearFlag.start))
      add("At or near text flagged in the earlier version", "flagged text", 2);

    // A capitalisation fix does not change what a sentence claims; any other edit next to a number might.
    const caseOnly = bText.toLowerCase() === aText.toLowerCase();
    if (!caseOnly && nums.size === 0 && (sentenceHasNumber(bi, b) || sentenceHasNumber(ai, a)))
      add("In the same sentence as a number or rate", "sentence with a number", 2);

    const kind: ChangeHunk["kind"] = !bText ? "added" : !aText ? "removed" : "changed";
    hunks.push({ kind, before: bText, after: aText, regulated: reasons.length > 0, reasons });
  }

  const regulatedCount = hunks.filter((h) => h.regulated).length;
  return {
    comparedTo,
    hunks,
    regulatedCount,
    fastTrack: hunks.length > 0 && regulatedCount === 0,
    summary: summarize(hunks, regulatedCount, summaryTags(allTags), false),
  };
}
