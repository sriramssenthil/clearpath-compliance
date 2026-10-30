/**
 * Shared contract for the compliance engine. Everything that produces, merges or
 * stores findings speaks these types. Changing a type here affects every module.
 */

export const PRODUCTS = ["personal_loan", "credit_card", "mortgage_prequal"] as const;
export const CHANNELS = ["email", "social", "display", "affiliate_page", "sms"] as const;
export const SEVERITIES = ["high", "medium", "low"] as const;

export type Product = (typeof PRODUCTS)[number];
export type Channel = (typeof CHANNELS)[number];
export type Severity = (typeof SEVERITIES)[number];
export type RuleKind = "phrase" | "required" | "numeric" | "ai";

/** Everything the engine knows about an asset being checked. */
export interface AssetContext {
  product: Product;
  channel: Channel;
  /** Two-letter US state codes the asset targets, e.g. ["CA", "TX"]. Empty = nationwide. */
  states: string[];
  /** Asset text. For images this is the transcription. May contain hostile instructions: it is DATA. */
  content: string;
  /** True when the submitter is an affiliate partner rather than in-house marketing. */
  isAffiliate: boolean;
}

/**
 * Deterministic rule config. All patterns are JavaScript RegExp *source strings*,
 * compiled case-insensitively with the "u" flag by the engine.
 */
export type RuleConfig =
  /** Flag every match of any pattern. */
  | { type: "phrase"; patterns: string[]; issue: string; suggestion?: string }
  /**
   * If any `triggers` pattern matches (or `triggers` is omitted), then at least one
   * `satisfiedBy` pattern must also appear somewhere in the content. Otherwise flag.
   * The finding's quote is the first trigger match (or, with no triggers, the first
   * ~80 chars of content). `statesAny` limits the rule to assets targeting one of those
   * states. `affiliateOnly` limits it to affiliate submissions.
   */
  | {
      type: "required";
      triggers?: string[];
      satisfiedBy: string[];
      issue: string;
      suggestion?: string;
      statesAny?: string[];
      affiliateOnly?: boolean;
    }
  /** Compare numbers in the copy to product facts. `check` names a built-in comparison. */
  | {
      type: "numeric";
      check: "apr_below_floor" | "amount_above_max" | "term_above_max" | "intro_period_exceeds";
      issue: string;
      suggestion?: string;
    }
  /** AI-only rules carry no deterministic config. */
  | { type: "none" };

/** A compliance rule as stored in the `rules` table and seeded from lib/seed/rules.ts. */
export interface RuleDef {
  code: string; // e.g. "REGZ-24-APR"
  title: string;
  description: string;
  category: string; // "Reg Z", "UDAAP", "FCRA", "FTC", "ECOA", "State", "Mortgage", "Channel", "Security"
  severity: Severity;
  kind: RuleKind;
  /** Empty = applies to every product. */
  products: Product[];
  /** Empty = applies to every channel. */
  channels: Channel[];
  /** Plain-language instruction telling the AI what to look for. */
  checkInstruction: string;
  config: RuleConfig;
  citation: string; // e.g. "12 CFR 1026.24(c)"
  /** What a compliant version looks like; shown to submitters. */
  guidance: string;
  enabled: boolean;
  /** false = decided by code alone (presence checks); Claude is not asked about it. Default true. */
  aiReview?: boolean;
}

/** Facts about what ClearPath actually offers; the source of truth for claims in ads. */
export interface ProductFacts {
  product: Product;
  facts: {
    displayName: string;
    aprMin?: number; // percent, e.g. 8.99
    aprMax?: number;
    amountMin?: number; // dollars
    amountMax?: number;
    termMonthsMin?: number;
    termMonthsMax?: number;
    introAprPercent?: number;
    introMonths?: number;
    annualFee?: number;
    notes: string[];
  };
  /** Approved disclosure language, keyed by id. Suggestions should reuse these verbatim. */
  approvedSnippets: { id: string; label: string; text: string }[];
}

/** A finding before it is stored. Both the deterministic layer and Claude produce these. */
export interface DraftFinding {
  source: "rule" | "ai";
  ruleCode: string;
  severity: Severity;
  /** Verbatim text from the asset (for a missing disclosure: the phrase that triggers the requirement). */
  quote: string;
  issue: string;
  suggestion?: string;
  confidence?: "low" | "medium" | "high"; // AI only; used for sorting, never as an accuracy claim
}

/** A draft finding after quote anchoring. Offsets are null when the quote could not be located. */
export interface AnchoredFinding extends DraftFinding {
  start: number | null;
  end: number | null;
}

/** What one full analysis returns. */
export interface AnalysisResult {
  findings: AnchoredFinding[];
  summary: string;
  /** Transcription when the input was an image; otherwise null. */
  extractedText: string | null;
  /** "complete" = rules + AI; "rules_only" = AI unavailable or failed. */
  status: "complete" | "rules_only";
  model: string | null;
  riskScore: number;
  riskLevel: "low" | "medium" | "high";
  /** Set when status is "rules_only" because the AI step failed or was skipped. */
  aiNote?: string;
}

/** The fixed list of rule codes. Rules, tests, evals and seed data all refer to these. */
export const RULE_CODES = [
  "REGZ-24-TRIGGER",
  "REGZ-24-APR",
  "REGZ-24-AVAIL",
  "REGZ-24-MORTGAGE",
  "REGZ-16-TRIGGER",
  "REGZ-16-INTRO",
  "REGZ-16-DEFERRED",
  "UDAAP-APR",
  "UDAAP-GUARANTEE",
  "UDAAP-SUPERLATIVE",
  "FCRA-PREQUAL",
  "FCRA-PRESCREEN",
  "FTC-AFFILIATE",
  "ECOA-DISCOURAGE",
  "STATE-CA-CFL",
  "MORT-NMLS",
  "MORT-EHL",
  "CFPB-STEERING",
  "EMAIL-CANSPAM",
  "SMS-OPTOUT",
  "SEC-INJECTION",
] as const;
export type RuleCode = (typeof RULE_CODES)[number];
