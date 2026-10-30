import type { EngineResult } from "@/lib/compliance/engine";
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
  dueAt: Date | null;
  decidedAt: Date | null;
  sla: SlaState;
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
}

export interface VersionView {
  id: number;
  number: number;
  content: string;
  sourceUrl: string | null;
  analysisStatus: "pending" | "complete" | "rules_only" | "failed";
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
