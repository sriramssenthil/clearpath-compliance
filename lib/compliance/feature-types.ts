/**
 * Shared shapes for the second set of features. Each feature module implements functions that return
 * these; the workflow layer stores or computes them and the UI renders them.
 */
import type { Channel, Product } from "./types";

/** #6 "Reasonable consumer" read: what a first-time borrower would take away, compared with the real terms. */
export interface NetImpression {
  /** At most two sentences, written as the consumer's understanding of the offer. */
  takeaway: string;
  /** Specific beliefs the asset creates, each compared with what ClearPath actually offers. */
  beliefs: { belief: string; actual: string; misleading: boolean }[];
  model: string;
}

/** #3 A past compliance decision. */
export interface Precedent {
  id: string; // "lib-12" for the precedent library, "live-345" for a decision taken in this app
  source: "library" | "live";
  ruleCode: string;
  product: Product;
  channel: Channel;
  originalText: string;
  issue: string;
  reviewerName: string;
  reviewerComment: string;
  outcome: "fixed" | "dismissed" | "rejected";
  /** The wording that eventually passed, when known. */
  approvedText: string | null;
  decidedAt: Date;
  submissionCode: string | null;
}

export interface PrecedentMatch {
  precedent: Precedent;
  /** 0..1, higher is more similar. */
  score: number;
  sameRule: boolean;
  /** Terms the finding and the precedent share; shown so the match is explainable. */
  matchedTerms: string[];
}

/** #4 One changed stretch of text between two versions. */
export interface ChangeHunk {
  kind: "added" | "removed" | "changed";
  before: string;
  after: string;
  /** True when the change touches a claim, a number, a disclosure or flagged text. */
  regulated: boolean;
  reasons: string[];
}

export interface ChangeScope {
  comparedTo: { kind: "previous_version" | "master"; label: string };
  hunks: ChangeHunk[];
  regulatedCount: number;
  /** No regulated text changed: a reviewer can clear it quickly. Never an automatic approval. */
  fastTrack: boolean;
  summary: string;
}

/** #5 Why an item sits where it does in the queue. */
export interface PriorityBreakdown {
  score: number;
  factors: { label: string; points: number }[];
}

export interface AssetInfo {
  id: number;
  mediaType: string;
  filename: string;
  sizeBytes: number;
}
