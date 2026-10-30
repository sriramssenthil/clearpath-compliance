import type { EngineResult } from "@/lib/compliance/engine";
import type { AssetInfo, ChangeScope, NetImpression, PrecedentMatch, PriorityBreakdown } from "@/lib/compliance/feature-types";
import type { Channel, Product, Severity } from "@/lib/compliance/types";
import type { Outcome, Role, SlaState, Status } from "./flow";

/** The signed-in person, as the service layer needs to know them. */
export interface Actor {
  id: number;
  name: string;
  role: Role;
  partnerId: number | null;
}

export class WorkflowError extends Error {
  constructor(
    message: string,
    public readonly code: "forbidden" | "not_found" | "invalid" | "conflict" = "invalid",
  ) {
    super(message);
    this.name = "WorkflowError";
  }
}

export interface RuleInfo {
  code: string;
  title: string;
  category: string;
  citation: string;
  guidance: string;
}

export interface PrecheckInput {
  product: Product;
  channel: Channel;
  states: string[];
  content: string;
}

export interface PrecheckResult {
  analysis: EngineResult;
  ruleInfo: Record<string, RuleInfo>;
  /** Advisory "reasonable consumer" read; null when it could not be produced. */
  netImpression: NetImpression | null;
  /** The real terms, for showing next to the consumer read. */
  facts: { label: string; value: string }[];
  /** Similar past decisions per finding, index-aligned with `analysis.findings`. */
  precedents: PrecedentMatch[][];
}

export interface SubmissionInput {
  title: string;
  product: Product;
  channel: Channel;
  states: string[];
  content: string;
  sourceUrl?: string | null;
  launchDate?: string | null; // ISO date
  priority: "standard" | "expedited";
  priorityReason?: string | null;
  notes?: string | null;
  /** Id of an approved submission this asset is a variant of (campaign variants). */
  parentId?: number | null;
}

export interface SubmissionSummary {
  id: number;
  code: string;
  title: string;
  product: Product;
  channel: Channel;
  status: Status;
  priority: "standard" | "expedited";
  riskLevel: "low" | "medium" | "high";
  riskScore: number;
  currentVersion: number;
  openFindings: number;
  highOpenFindings: number;
  submitterName: string;
  partnerId: number | null;
  partnerName: string | null;
  assigneeId: number | null;
  assigneeName: string | null;
  submittedAt: Date;
  updatedAt: Date;
  dueAt: Date | null;
  decidedAt: Date | null;
  launchDate: Date | null;
  parentId: number | null;
  sla: SlaState;
  /** Filled by the queue (see lib/workflow/priority.ts). */
  priorityScore?: PriorityBreakdown;
  /** Latest version changed no regulated text versus the previous version or its approved master. */
  fastTrack?: boolean;
}

export interface FindingView {
  id: number;
  versionId: number;
  source: "rule" | "ai" | "reviewer";
  ruleCode: string;
  ruleTitle: string;
  citation: string;
  guidance: string;
  severity: Severity;
  quote: string;
  start: number | null;
  end: number | null;
  issue: string;
  suggestion: string | null;
  confidence: string | null;
  status: "open" | "accepted" | "dismissed" | "resolved";
  dismissReason: string | null;
  actedByName: string | null;
  actedAt: Date | null;
  /** Most similar past decisions (reviewers only). */
  precedents?: PrecedentMatch[];
}

export interface VersionView {
  id: number;
  number: number;
  content: string;
  sourceUrl: string | null;
  analysisStatus: "pending" | "complete" | "rules_only" | "failed";
  asset: AssetInfo | null;
  inputText: string | null;
  netImpression: NetImpression | null;
  /** What changed versus the previous version (or the master, for v1 of a variant). */
  changeScope?: ChangeScope | null;
  analysisSummary: string | null;
  model: string | null;
  createdByName: string;
  createdAt: Date;
  findings: FindingView[];
}

export interface DecisionView {
  id: number;
  versionId: number;
  versionNumber: number;
  reviewerName: string;
  outcome: Outcome;
  note: string | null;
  feedbackDraft: string | null;
  createdAt: Date;
}

export interface AuditView {
  id: number;
  action: string;
  actorName: string | null; // null = automated
  details: Record<string, unknown>;
  createdAt: Date;
}

export interface Permissions {
  canClaim: boolean;
  canActOnFindings: boolean;
  canDecide: boolean;
  canResubmit: boolean;
  canWithdraw: boolean;
}

export interface SubmissionDetail extends SubmissionSummary {
  states: string[];
  launchDate: Date | null;
  priorityReason: string | null;
  notes: string | null;
  versions: VersionView[];
  decisions: DecisionView[];
  audit: AuditView[];
  permissions: Permissions;
  parent: { id: number; code: string; title: string } | null;
  variants: SubmissionSummary[];
}

export interface QueueFilters {
  status?: Status[];
  product?: Product;
  channel?: Channel;
  partnerId?: number;
  assignee?: "me" | "unassigned" | number;
  risk?: "low" | "medium" | "high";
  q?: string;
}
