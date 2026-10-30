/**
 * Precedent recall: given a finding, rank the company's past decisions by how similar the flagged wording is.
 *
 * Similarity is lexical: Okapi BM25 over each precedent's original text plus its issue, with a character-trigram
 * containment score blended in so short quotes ("You're pre-approved") still match paraphrases, then a strong
 * boost for the same rule and a light one for the same product and channel. Pure and deterministic.
 *
 * At production scale (tens of thousands of decisions, many paraphrases and synonyms such as "sure thing" for
 * "guaranteed") embeddings in a vector index would replace BM25 so that meaning, not shared words, drives
 * recall. At this corpus size (a few hundred rows written in the house vocabulary of one compliance team),
 * BM25 is enough: the claims that matter repeat the same words and numbers, every match is explainable by the
 * terms it shares, and it needs no model call, no index service and no network.
 */
import type { Precedent, PrecedentMatch } from "./feature-types";
import type { Channel, Product } from "./types";

export interface PrecedentQuery {
  ruleCode: string;
  quote: string;
  issue?: string;
  product: Product;
  channel: Channel;
}

const K1 = 1.2;
const B = 0.75;
const ISSUE_WEIGHT = 0.5;
const W_TEXT = 0.7;
const W_RULE = 0.22;
const W_PRODUCT = 0.05;
const W_CHANNEL = 0.03;
const SHORT_QUERY_TOKENS = 4;
const DEFAULT_MIN_SCORE = 0.3;
const MAX_TERMS = 6;

const STOPWORDS = new Set(
  ("a an and are as at be been but by can do for from has have i if in into is it its just me my of on or our so " +
    "than that the their then there these this to us was we were what when which who will with you your yours " +
    "also any may must not pre use used get")
    .split(" "),
);

/** Light suffix stripping: enough to join approved/approval/approve and rates/rate, not a full stemmer. */
export function stem(word: string): string {
  if (/[\d$%]/.test(word)) return word;
  const w = word;
  for (const suffix of ["ing", "ed", "es", "al", "ly", "s"]) {
    if (w.endsWith(suffix) && w.length - suffix.length >= 3 && !(suffix === "s" && w.endsWith("ss"))) {
      return w.slice(0, -suffix.length);
    }
  }
  // "guarantee" -> "guarante" to meet "guaranteed"; only when no suffix was removed.
  return w.endsWith("e") && w.length > 3 ? w.slice(0, -1) : w;
}

export interface Token {
  term: string;
  surface: string;
}

/**
 * Lowercased, punctuation-free, stopword-free tokens. Numbers keep their $ and % ("$199", "0%", "8.99%").
 * Apostrophes are dropped ("you're" = "youre"); a hyphenated word yields the joined word and its parts, so
 * "pre-approved" matches "preapproved" and "approved". `surface` is the word as written, for display.
 */
export function tokenize(text: string): Token[] {
  const out: Token[] = [];
  const lower = text.toLowerCase().replace(/[\u2018\u2019]/g, "'");
  for (const m of lower.matchAll(/\$?\d+(?:[.,]\d+)*%?|[a-z0-9]+(?:['-][a-z0-9]+)*/g)) {
    const surface = m[0].replace(/,(?=\d)/g, "");
    const joined = surface.replace(/['-]/g, "");
    if (STOPWORDS.has(joined)) continue;
    out.push({ term: stem(joined), surface });
    if (surface.includes("-")) {
      for (const part of surface.split("-")) if (part.length >= 3 && !STOPWORDS.has(part)) out.push({ term: stem(part), surface });
    }
  }
  return out;
}

function trigrams(tokens: Token[]): Set<string> {
  const s = ` ${tokens.map((t) => t.surface).join(" ")} `;
  const grams = new Set<string>();
  for (let i = 0; i + 3 <= s.length; i++) grams.add(s.slice(i, i + 3));
  return grams;
}

interface Doc {
  precedent: Precedent;
  tf: Map<string, number>;
  length: number;
  grams: Set<string>;
}

interface Index {
  docs: Doc[];
  df: Map<string, number>;
  avgLength: number;
}

const indexCache = new WeakMap<Precedent[], Index>();

function buildIndex(corpus: Precedent[]): Index {
  const cached = indexCache.get(corpus);
  if (cached) return cached;
  const df = new Map<string, number>();
  const docs = corpus.map((precedent) => {
    const tokens = tokenize(`${precedent.originalText} ${precedent.issue}`);
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t.term, (tf.get(t.term) ?? 0) + 1);
    for (const term of tf.keys()) df.set(term, (df.get(term) ?? 0) + 1);
    return { precedent, tf, length: tokens.length, grams: trigrams(tokenize(precedent.originalText)) };
  });
  const avgLength = docs.reduce((n, d) => n + d.length, 0) / Math.max(1, docs.length);
  const index = { docs, df, avgLength };
  indexCache.set(corpus, index);
  return index;
}

/** Query terms with weights: the quote counts fully, the finding's issue half. */
function queryTerms(query: PrecedentQuery): { weights: Map<string, number>; surface: Map<string, string> } {
  const weights = new Map<string, number>();
  const surface = new Map<string, string>();
  const add = (tokens: Token[], w: number) => {
    for (const t of tokens) {
      weights.set(t.term, Math.max(weights.get(t.term) ?? 0, w));
      if (!surface.has(t.term)) surface.set(t.term, t.surface);
    }
  };
  add(tokenize(query.quote), 1);
  if (query.issue) add(tokenize(query.issue), ISSUE_WEIGHT);
  return { weights, surface };
}

export function findPrecedents(
  query: PrecedentQuery,
  corpus: Precedent[],
  opts: { k?: number; minScore?: number } = {},
): PrecedentMatch[] {
  const k = opts.k ?? 3;
  const minScore = opts.minScore ?? DEFAULT_MIN_SCORE;
  if (corpus.length === 0 || k <= 0) return [];
  const index = buildIndex(corpus);
  const n = index.docs.length;
  const { weights, surface } = queryTerms(query);
  const quoteTokens = tokenize(query.quote);
  const quoteGrams = trigrams(quoteTokens);
  const short = quoteTokens.length <= SHORT_QUERY_TOKENS;

  const idf = (term: string) => {
    const d = index.df.get(term) ?? 0;
    return Math.log(1 + (n - d + 0.5) / (d + 0.5));
  };
  // Upper bound of the weighted BM25 sum (every term present with saturating frequency), so 0..1.
  let ceiling = 0;
  for (const [term, w] of weights) ceiling += w * idf(term) * (K1 + 1);

  const matches: PrecedentMatch[] = [];
  for (const doc of index.docs) {
    let raw = 0;
    const shared: { surface: string; fromQuote: boolean; idf: number }[] = [];
    for (const [term, w] of weights) {
      const f = doc.tf.get(term);
      if (!f) continue;
      const termIdf = idf(term);
      raw += (w * termIdf * f * (K1 + 1)) / (f + K1 * (1 - B + (B * doc.length) / index.avgLength));
      shared.push({ surface: surface.get(term) ?? term, fromQuote: w === 1, idf: termIdf });
    }
    const lexical = ceiling > 0 ? Math.min(1, raw / ceiling) : 0;
    let common = 0;
    for (const g of quoteGrams) if (doc.grams.has(g)) common++;
    const grams = quoteGrams.size > 0 ? common / quoteGrams.size : 0;
    const text = short ? 0.6 * lexical + 0.4 * grams : 0.8 * lexical + 0.2 * grams;
    if (shared.length === 0 && grams < 0.35) continue; // a rule or product match alone is not a precedent

    const p = doc.precedent;
    const sameRule = p.ruleCode === query.ruleCode;
    const score =
      W_TEXT * text + (sameRule ? W_RULE : 0) + (p.product === query.product ? W_PRODUCT : 0) + (p.channel === query.channel ? W_CHANNEL : 0);
    if (score < minScore) continue;
    // Words from the flagged quote (what the reviewer sees), rarest first; issue words only when the quote shares none.
    const fromQuote = shared.filter((s) => s.fromQuote);
    const ordered = (fromQuote.length > 0 ? fromQuote : shared).sort((a, b) => b.idf - a.idf || a.surface.localeCompare(b.surface));
    const matchedTerms = [...new Set(ordered.map((s) => s.surface))].slice(0, MAX_TERMS);
    matches.push({ precedent: p, score: Math.round(Math.min(1, score) * 1000) / 1000, sameRule, matchedTerms });
  }
  // The same wording flagged under the same rule (e.g. every version of one asset) is shown once: the best match.
  const seen = new Set<string>();
  const out: PrecedentMatch[] = [];
  for (const m of matches.sort((a, b) => b.score - a.score || compareIds(a.precedent.id, b.precedent.id))) {
    const key = `${m.precedent.ruleCode}|${m.precedent.originalText.toLowerCase().replace(/\s+/g, " ").trim()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
    if (out.length === k) break;
  }
  return out;
}

function compareIds(a: string, b: string): number {
  return a.localeCompare(b, "en", { numeric: true });
}
