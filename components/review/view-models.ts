import type { FindingView } from "@/lib/workflow/types";
import { formatDateTime, relativeTime } from "./format";

/** A finding plus pre-rendered time labels, so client components never format "now" themselves (no hydration drift). */
export type FindingVM = FindingView & {
  actedRel: string | null;
  actedAbs: string | null;
  /** Submission code to id, so live precedents can link to their source. */
  precedentIds?: Record<string, number>;
};

export function toFindingVM(f: FindingView, now: Date, precedentIds?: Record<string, number>): FindingVM {
  return {
    ...f,
    precedentIds,
    actedRel: f.actedAt ? relativeTime(f.actedAt, now) : null,
    actedAbs: f.actedAt ? formatDateTime(f.actedAt) : null,
  };
}

export type FindingFilter = "open" | "accepted" | "dismissed" | "resolved" | "all";

export const FILTER_LABEL: Record<FindingFilter, string> = {
  open: "Open",
  accepted: "Accepted",
  dismissed: "Dismissed",
  resolved: "Resolved",
  all: "All",
};

export const QUICK_DISMISS_REASONS = [
  "Quoted in a warning, not a claim",
  "Required disclosure is present elsewhere",
  "Does not apply to this product or channel",
  "Judgement call: acceptable",
  "Other",
] as const;

export interface RuleOption {
  code: string;
  title: string;
  severity: "high" | "medium" | "low";
  category: string;
}

export const SOURCE_LABEL = { rule: "Rule check", ai: "AI review", reviewer: "Reviewer" } as const;
