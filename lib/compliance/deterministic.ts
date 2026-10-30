import { withInsertText } from "./fix-text";
import { selectRules } from "./applicable";
import type { AssetContext, DraftFinding, ProductFacts, RuleDef } from "./types";
import { stateApplies } from "./states";

/**
 * Deterministic (non-AI) layer. Every finding's quote is an exact substring of
 * ctx.content. Patterns come from data, so compile failures are swallowed.
 */

const MAX_PER_RULE = 5;
const MAX_MATCHES = 2000; // bounds work on hostile 20k-character inputs
const MAX_WIDEN = 60;
const WORD = new RegExp("[\\p{L}\\p{N}_]", "u");

interface Span {
  start: number;
  end: number;
}
interface Hit {
  pos: number;
  finding: DraftFinding;
}

function compile(pattern: string, global: boolean): RegExp | null {
  try {
    return new RegExp(pattern, global ? "iug" : "iu");
  } catch {
    return null;
  }
}

function compileAll(patterns: string[] | undefined, global: boolean): RegExp[] {
  const out: RegExp[] = [];
  for (const p of patterns ?? []) {
    const re = typeof p === "string" ? compile(p, global) : null;
    if (re) out.push(re);
  }
  return out;
}

function* matchesOf(re: RegExp, text: string): Generator<RegExpExecArray> {
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  for (let n = 0; n < MAX_MATCHES && (m = re.exec(text)); n++) {
    if (m[0].length === 0) re.lastIndex++;
    else yield m;
  }
}

const isWord = (ch: string | undefined) => ch !== undefined && WORD.test(ch);

/** Trim whitespace, then grow to whole words if the span starts or ends mid-word. */
function tidy(content: string, start: number, end: number): Span | null {
  while (start < end && /\s/.test(content[start])) start++;
  while (end > start && /\s/.test(content[end - 1])) end--;
  if (end <= start) return null;
  for (let i = 0; i < MAX_WIDEN && start > 0 && isWord(content[start]) && isWord(content[start - 1]); i++) start--;
  for (let i = 0; i < MAX_WIDEN && end < content.length && isWord(content[end - 1]) && isWord(content[end]); i++) end++;
  return { start, end };
}

function withDetail(base: string, detail: string): string {
  const b = base.trim();
  return `${b}${/[.!?]$/.test(b) ? "" : "."} ${detail}`;
}

function draft(rule: RuleDef, quote: string, issue: string): DraftFinding {
  const cfg = rule.config as { suggestion?: string };
  return { source: "rule", ruleCode: rule.code, severity: rule.severity, quote, issue, suggestion: cfg.suggestion };
}

// ---------------------------------------------------------------- phrase

function runPhrase(rule: RuleDef, content: string, patterns: string[], issue: string): Hit[] {
  const spans: Span[] = [];
  for (const re of compileAll(patterns, true)) {
    for (const m of matchesOf(re, content)) {
      const s = tidy(content, m.index, m.index + m[0].length);
      if (s) spans.push(s);
    }
  }
  spans.sort((a, b) => a.start - b.start || a.end - b.end);
  const seen = new Set<string>();
  const hits: Hit[] = [];
  for (const s of spans) {
    const quote = content.slice(s.start, s.end);
    if (seen.has(quote)) continue;
    seen.add(quote);
    hits.push({ pos: s.start, finding: draft(rule, quote, issue) });
    if (hits.length >= MAX_PER_RULE) break;
  }
  return hits;
}

// -------------------------------------------------------------- required

/** First ~80 characters, ending on a word boundary. */
function leadingSpan(content: string): Span | null {
  let start = 0;
  while (start < content.length && /\s/.test(content[start])) start++;
  let end = Math.min(content.length, start + 80);
  if (end < content.length && isWord(content[end - 1]) && isWord(content[end])) {
    const cut = content.slice(start, end).search(/\s\S*$/);
    if (cut > 0) end = start + cut;
  }
  return tidy(content, start, end);
}

function runRequired(
  rule: RuleDef,
  ctx: AssetContext,
  cfg: Extract<RuleDef["config"], { type: "required" }>,
): Hit[] {
  if (cfg.affiliateOnly && !ctx.isAffiliate) return [];
  if (!stateApplies(ctx, cfg.statesAny)) return [];
  const content = ctx.content;
  if (content.trim() === "") return [];

  let span: Span | null;
  if (cfg.triggers && cfg.triggers.length > 0) {
    let best: RegExpExecArray | null = null;
    for (const re of compileAll(cfg.triggers, false)) {
      const m = re.exec(content);
      if (m && m[0].trim() !== "" && (!best || m.index < best.index)) best = m;
    }
    if (!best) return [];
    span = tidy(content, best.index, best.index + best[0].length);
  } else {
    span = leadingSpan(content);
  }
  if (!span) return [];

  if (compileAll(cfg.satisfiedBy, false).some((re) => re.test(content))) return [];
  return [{ pos: span.start, finding: draft(rule, content.slice(span.start, span.end), cfg.issue) }];
}

// --------------------------------------------------------------- numeric

type NumericCheck = Extract<RuleDef["config"], { type: "numeric" }>["check"];

const PERCENT = new RegExp("(?<![\\d.,])(\\d{1,3}(?:\\.\\d{1,4})?)\\s?(?:%|percent\\b)", "giu");
const DOLLARS = new RegExp(
  "(?<![\\w$])\\$\\s?(\\d{1,3}(?:,\\d{3})+|\\d+)(\\.\\d+)?(?:\\s?(k|thousand|million|m)\\b)?",
  "giu",
);
const DURATION = new RegExp("(?<![\\d.])(\\d{1,3})[\\s-]?(months?|mos?|years?|yrs?)\\b", "giu");

const BOUNDARY = /[.!?;]\s|\n|\b(?:then|after|thereafter)\b/gi;
const SENTENCE = /[.!?;]\s|\n/gi;
const BOUNDARY_FIRST = /[.!?;]\s|\n|\b(?:then|after|thereafter)\b/i;
const SENTENCE_FIRST = /[.!?;]\s|\n/i;
const APR_WORD = /\bAPR\b|annual percentage rate/i;
const RATE_WORD = /\brates?\b|\binterest\b/i;
const APR_KEYWORD = /\bAPR\b|annual percentage rate|\brates?\b|as low as|starting (?:at|from)/gi;
const APR_DIRECT = /^\s*(?:(?:fixed|variable|intro(?:ductory)?|promo(?:tional)?)\s+)*(?:APR\b|annual percentage rate)/i;
const AS_LOW_AS = /(?:as low as|starting (?:at|from))\s*$/i;
const NOT_A_RATE_AFTER =
  /^\s*(?:of\b|(?:cash\s*)?back\b|cash\b|rewards?\b|off\b|discount|bonus|APY\b|savings|down\b|fees?\b|origination|late\b|closing|points?\b|increase|decrease|more\b|less\b|higher|lower|faster)/i;
const NOT_A_RATE_BEFORE = /\b(?:fees?|origination|down\s*payment|closing costs?|points?|discount|save|bonus)\s*(?:of|is|are|:|at)?\s*$/i;
const INTRO_APR_LABEL =
  /\bintro(?:ductory)?\b|\bpromo(?:tional)?\b|\blimited[- ]time\b|\bfor\s+(?:the\s+)?(?:first\s+)?\d+\s*(?:months?|years?|mos?)\b|\bfirst\s+\d+\s*(?:months?|years?)\b|\bbalance transfers?\b|\bnew purchases\b/i;
const INTRO_LABEL =
  /\bintro(?:ductory)?\b|\bpromo(?:tional)?\b|\b0(?:\.0+)?\s?(?:%|percent)|\bno[\s-]interest\b|\binterest[\s-]free\b|\bbalance transfers?\b|\bdeferred\b/i;
const AMOUNT_CONTEXT =
  /\b(?:loans?|borrow\w*|financ\w*|amounts?|credit (?:line|limit)|limits?|up to|lend\w*|mortgage|funds?|cash|approved for|prequalif\w*|qualify|get|receive|as much as)\b/i;
const NOT_AN_AMOUNT_AFTER =
  /^\s*(?:\/|per\b|a\s+(?:month|year)|monthly|annual|in\s+(?:savings|interest|rewards|fees)|cash\s*back|bonus|fees?\b)/i;
const TERM_CONTEXT =
  /\b(?:terms?|repay\w*|loans?|financ\w*|payments?|mortgage|up to|as long as|over|amortiz\w*|fixed|flexible)\b/i;
const NOT_A_TERM_AFTER = /^\s*(?:of\s+)?(?:experience|history|in business|ago|old|warranty|guarantee)/i;
const NOT_A_TERM_BEFORE = /\b(?:since|for the past|the past|the last|last|past)\s*$/i;
const LEAD_PHRASE = /(?:\b(?:up to|as much as|as long as|of|from|to|get|borrow|borrowing|over|terms?)\s+)+$/i;

/** Text around a token, clipped at sentence boundaries (and optionally "then"/"after"). */
function around(content: string, start: number, end: number, width: number, cutThen: boolean) {
  const b0 = Math.max(0, start - width);
  let before = content.slice(b0, start);
  let after = content.slice(end, end + width);
  const re = cutThen ? BOUNDARY : SENTENCE;
  let keep = 0;
  for (const m of before.matchAll(re)) keep = m.index! + m[0].length;
  before = before.slice(keep);
  const first = after.search(cutThen ? BOUNDARY_FIRST : SENTENCE_FIRST);
  if (first >= 0) after = after.slice(0, first);
  return { before, after, beforeStart: start - before.length, afterEnd: end + after.length };
}

function lastMatch(re: RegExp, text: string): RegExpMatchArray | null {
  let last: RegExpMatchArray | null = null;
  for (const m of text.matchAll(re)) last = m;
  return last;
}

function extendLeft(content: string, start: number): number {
  const m = LEAD_PHRASE.exec(content.slice(Math.max(0, start - 25), start));
  return m ? start - m[0].length : start;
}

const fmtPct = (n: number) => `${n}%`;
const fmtUsd = (n: number) => `$${n.toLocaleString("en-US")}`;
const fmtMonths = (n: number) => `${n} months`;

function runNumeric(
  rule: RuleDef,
  check: NumericCheck,
  issue: string,
  content: string,
  facts: ProductFacts["facts"],
): Hit[] {
  const hits: Hit[] = [];
  const seen = new Set<string>();
  const add = (start: number, end: number, detail: string): boolean => {
    const s = tidy(content, start, end);
    if (!s) return false;
    const quote = content.slice(s.start, s.end);
    if (seen.has(quote)) return false;
    seen.add(quote);
    hits.push({ pos: s.start, finding: draft(rule, quote, withDetail(issue, detail)) });
    return hits.length >= MAX_PER_RULE;
  };

  if (check === "apr_below_floor") {
    const floor = facts.aprMin;
    if (floor === undefined) return hits;
    const introOffered = facts.introMonths !== undefined || facts.introAprPercent !== undefined;
    for (const m of matchesOf(PERCENT, content)) {
      const value = parseFloat(m[1]);
      if (!(value < floor)) continue;
      const start = m.index;
      const end = start + m[0].length;
      const w = around(content, start, end, 40, false);
      const direct = APR_DIRECT.test(w.after);
      const excluded = NOT_A_RATE_AFTER.test(w.after) || NOT_A_RATE_BEFORE.test(w.before);
      const claim =
        direct ||
        (!excluded &&
          (APR_WORD.test(w.before) || APR_WORD.test(w.after) || RATE_WORD.test(w.before) ||
            RATE_WORD.test(w.after) || AS_LOW_AS.test(w.before)));
      if (!claim) continue;
      // Promotional rates are allowed only where the product offers one; their length is
      // checked by intro_period_exceeds.
      const t = around(content, start, end, 40, true);
      if (introOffered && INTRO_APR_LABEL.test(`${t.before} ${t.after}`)) continue;

      let qs = start;
      let qe = end;
      const kb = lastMatch(APR_KEYWORD, t.before);
      if (kb) qs = t.beforeStart + kb.index!;
      const ka = t.after.match(new RegExp(APR_KEYWORD.source, "i"));
      if (ka) qe = end + ka.index! + ka[0].length;
      if (add(qs, qe, `Advertised ${fmtPct(value)} is below the lowest APR ClearPath offers (${fmtPct(floor)}).`)) break;
    }
  } else if (check === "amount_above_max") {
    const max = facts.amountMax;
    if (max === undefined) return hits;
    for (const m of matchesOf(DOLLARS, content)) {
      const mult = { k: 1e3, thousand: 1e3, m: 1e6, million: 1e6 }[(m[3] ?? "").toLowerCase()] ?? 1;
      const value = parseFloat(m[1].replace(/,/g, "") + (m[2] ?? "")) * mult;
      if (!(value > max)) continue;
      const start = m.index;
      const end = start + m[0].length;
      const w = around(content, start, end, 40, false);
      if (NOT_AN_AMOUNT_AFTER.test(w.after) || !AMOUNT_CONTEXT.test(`${w.before} ${w.after}`)) continue;
      if (add(extendLeft(content, start), end, `Advertised ${fmtUsd(value)} exceeds the largest amount ClearPath offers (${fmtUsd(max)}).`)) break;
    }
  } else {
    const isTerm = check === "term_above_max";
    const limit = isTerm ? facts.termMonthsMax : facts.introMonths;
    if (limit === undefined) return hits;
    for (const m of matchesOf(DURATION, content)) {
      const unitYears = /^y/i.test(m[2]);
      const months = parseInt(m[1], 10) * (unitYears ? 12 : 1);
      if (!(months > limit)) continue;
      const start = m.index;
      const end = start + m[0].length;
      const w = around(content, start, end, 40, true);
      const intro = INTRO_LABEL.test(`${w.before} ${w.after}`);
      if (isTerm) {
        if (intro || !TERM_CONTEXT.test(`${w.before} ${w.after}`)) continue;
        if (NOT_A_TERM_AFTER.test(w.after) || NOT_A_TERM_BEFORE.test(w.before)) continue;
      } else if (!intro) continue;
      const shown = unitYears ? `${m[1]} years (${fmtMonths(months)})` : fmtMonths(months);
      const detail = isTerm
        ? `Advertised ${shown} exceeds the longest term ClearPath offers (${fmtMonths(limit)}).`
        : `Advertised promotional period of ${shown} exceeds the ${fmtMonths(limit)} ClearPath offers.`;
      if (add(extendLeft(content, start), end, detail)) break;
    }
  }
  return hits;
}

// ---------------------------------------------------------------- runner

export function runDeterministic(ctx: AssetContext, rules: RuleDef[], facts: ProductFacts): DraftFinding[] {
  const hits: Hit[] = [];
  for (const rule of selectRules(ctx, rules)) {
    const cfg = rule.config;
    if (!cfg) continue;
    try {
      if (cfg.type === "phrase") hits.push(...runPhrase(rule, ctx.content, cfg.patterns, cfg.issue));
      else if (cfg.type === "required") hits.push(...runRequired(rule, ctx, cfg));
      else if (cfg.type === "numeric") hits.push(...runNumeric(rule, cfg.check, cfg.issue, ctx.content, facts.facts));
    } catch {
      // A malformed rule must never take the whole review down.
    }
  }
  const ordered = hits
    .sort((a, b) => a.pos - b.pos || (a.finding.ruleCode < b.finding.ruleCode ? -1 : a.finding.ruleCode > b.finding.ruleCode ? 1 : 0))
    .map((h) => h.finding);
  // Rule suggestions are instructions, never copy; missing disclosures get the approved text to add.
  return withInsertText(ordered, rules, facts);
}
