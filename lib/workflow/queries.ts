import { and, asc, eq, inArray } from "drizzle-orm";
import { db, tables } from "@/lib/db";
import type { NetImpression } from "@/lib/compliance/feature-types";
import { ruleFromRow } from "@/lib/data/reference";
import { canReview, SLA_HOURS, slaState, WITH_COMPLIANCE, type Outcome, type Status } from "./flow";
import { canView, permissionsFor } from "./permissions";
import {
  WorkflowError,
  type Actor,
  type AuditView,
  type DecisionView,
  type FindingView,
  type QueueFilters,
  type SubmissionDetail,
  type SubmissionSummary,
  type VersionView,
} from "./types";

type SubmissionRow = typeof tables.submissions.$inferSelect;

async function nameMaps() {
  const [users, partners] = await Promise.all([db.select().from(tables.users), db.select().from(tables.partners)]);
  return {
    user: new Map(users.map((u) => [u.id, u.name])),
    partner: new Map(partners.map((p) => [p.id, p.name])),
  };
}

async function summarize(rows: SubmissionRow[], now = new Date()): Promise<SubmissionSummary[]> {
  if (rows.length === 0) return [];
  const names = await nameMaps();
  const current = await db
    .select({ submissionId: tables.versions.submissionId, severity: tables.findings.severity, status: tables.findings.status })
    .from(tables.findings)
    .innerJoin(tables.versions, eq(tables.findings.versionId, tables.versions.id))
    .innerJoin(
      tables.submissions,
      and(eq(tables.versions.submissionId, tables.submissions.id), eq(tables.versions.number, tables.submissions.currentVersion)),
    )
    .where(inArray(tables.submissions.id, rows.map((r) => r.id)));
  const open = new Map<number, { all: number; high: number }>();
  for (const f of current) {
    if (f.status !== "open") continue;
    const o = open.get(f.submissionId) ?? { all: 0, high: 0 };
    o.all += 1;
    if (f.severity === "high") o.high += 1;
    open.set(f.submissionId, o);
  }
  return rows.map((r) => ({
    id: r.id, code: r.code, title: r.title, product: r.product, channel: r.channel, status: r.status, priority: r.priority,
    riskLevel: r.riskLevel, riskScore: r.riskScore, currentVersion: r.currentVersion,
    openFindings: open.get(r.id)?.all ?? 0, highOpenFindings: open.get(r.id)?.high ?? 0,
    submitterName: names.user.get(r.submitterId) ?? "Unknown",
    partnerId: r.partnerId, partnerName: r.partnerId ? (names.partner.get(r.partnerId) ?? null) : null,
    assigneeId: r.assigneeId, assigneeName: r.assigneeId ? (names.user.get(r.assigneeId) ?? null) : null,
    submittedAt: r.submittedAt, updatedAt: r.updatedAt, dueAt: r.dueAt, decidedAt: r.decidedAt, launchDate: r.launchDate,
    parentId: r.parentId, sla: slaState(r.status, r.dueAt, now),
  }));
}

function visibleTo(actor: Actor, rows: SubmissionRow[]) {
  return rows.filter((r) => canView(actor, r));
}

/** Everything the actor is allowed to see, newest first. */
export async function listSubmissions(actor: Actor): Promise<SubmissionSummary[]> {
  const rows = await db.select().from(tables.submissions).orderBy(asc(tables.submissions.id));
  const summaries = await summarize(visibleTo(actor, rows));
  return summaries.sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
}

const SLA_RANK = { overdue: 0, due_soon: 1, on_track: 2, not_applicable: 3 } as const;

/** Reviewer queue: overdue first, then due soonest, higher risk breaking ties. */
export async function listQueue(actor: Actor, f: QueueFilters = {}): Promise<SubmissionSummary[]> {
  if (!canReview(actor.role)) throw new WorkflowError("The review queue is for compliance reviewers.", "forbidden");
  const rows = await db.select().from(tables.submissions);
  const statuses: Status[] = f.status?.length ? f.status : WITH_COMPLIANCE;
  const q = f.q?.trim().toLowerCase();
  const filtered = rows.filter(
    (r) =>
      statuses.includes(r.status) &&
      (!f.product || r.product === f.product) &&
      (!f.channel || r.channel === f.channel) &&
      (!f.partnerId || r.partnerId === f.partnerId) &&
      (!f.risk || r.riskLevel === f.risk) &&
      (f.assignee === undefined ||
        (f.assignee === "me" ? r.assigneeId === actor.id : f.assignee === "unassigned" ? r.assigneeId === null : r.assigneeId === f.assignee)) &&
      (!q || r.title.toLowerCase().includes(q) || r.code.toLowerCase().includes(q)),
  );
  const out = await summarize(filtered);
  const riskRank = { high: 0, medium: 1, low: 2 } as const;
  return out.sort(
    (a, b) =>
      SLA_RANK[a.sla] - SLA_RANK[b.sla] ||
      (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity) ||
      riskRank[a.riskLevel] - riskRank[b.riskLevel],
  );
}

export async function getDetail(actor: Actor, id: number): Promise<SubmissionDetail> {
  const [row] = await db.select().from(tables.submissions).where(eq(tables.submissions.id, id));
  // Same response for "missing" and "not yours" so ids cannot be probed.
  if (!row || !canView(actor, row)) throw new WorkflowError("Submission not found.", "not_found");
  const [summary] = await summarize([row]);
  const names = await nameMaps();

  const [versions, decisions, audit, ruleRows] = await Promise.all([
    db.select().from(tables.versions).where(eq(tables.versions.submissionId, id)).orderBy(asc(tables.versions.number)),
    db.select().from(tables.decisions).where(eq(tables.decisions.submissionId, id)).orderBy(asc(tables.decisions.createdAt)),
    db.select().from(tables.auditEvents).where(eq(tables.auditEvents.submissionId, id)).orderBy(asc(tables.auditEvents.createdAt), asc(tables.auditEvents.id)),
    db.select().from(tables.rules),
  ]);
  const findings = versions.length
    ? await db.select().from(tables.findings).where(inArray(tables.findings.versionId, versions.map((v) => v.id))).orderBy(asc(tables.findings.startOffset), asc(tables.findings.id))
    : [];
  const rules = new Map(ruleRows.map((r) => [r.code, ruleFromRow(r)]));
  const sevRank = { high: 0, medium: 1, low: 2 } as const;

  const findingView = (f: (typeof findings)[number]): FindingView => ({
    id: f.id, versionId: f.versionId, source: f.source, ruleCode: f.ruleCode,
    ruleTitle: rules.get(f.ruleCode)?.title ?? f.ruleCode, citation: rules.get(f.ruleCode)?.citation ?? "",
    guidance: rules.get(f.ruleCode)?.guidance ?? "", severity: f.severity, quote: f.quote, start: f.startOffset, end: f.endOffset,
    issue: f.issue, suggestion: f.suggestion, confidence: f.confidence, status: f.status, dismissReason: f.dismissReason,
    actedByName: f.actedBy ? (names.user.get(f.actedBy) ?? null) : null, actedAt: f.actedAt,
  });
  const assetRows = versions.some((v) => v.assetId)
    ? await db
        .select({ id: tables.assets.id, mediaType: tables.assets.mediaType, filename: tables.assets.filename, sizeBytes: tables.assets.sizeBytes })
        .from(tables.assets)
        .where(inArray(tables.assets.id, versions.flatMap((v) => (v.assetId ? [v.assetId] : []))))
    : [];
  const assetById = new Map(assetRows.map((a) => [a.id, a]));
  const versionViews: VersionView[] = versions.map((v) => ({
    id: v.id, number: v.number, content: v.content, sourceUrl: v.sourceUrl, analysisStatus: v.analysisStatus,
    asset: v.assetId ? (assetById.get(v.assetId) ?? null) : null, inputText: v.inputText,
    netImpression: (v.netImpression as NetImpression | null) ?? null,
    analysisSummary: v.analysisSummary, model: v.model, createdByName: names.user.get(v.createdBy) ?? "Unknown", createdAt: v.createdAt,
    findings: findings
      .filter((f) => f.versionId === v.id)
      .map(findingView)
      .sort((a, b) => (a.start ?? Infinity) - (b.start ?? Infinity) || sevRank[a.severity] - sevRank[b.severity]),
  }));
  const versionNumber = new Map(versions.map((v) => [v.id, v.number]));
  const decisionViews: DecisionView[] = decisions.map((d) => ({
    id: d.id, versionId: d.versionId, versionNumber: versionNumber.get(d.versionId) ?? 0,
    reviewerName: names.user.get(d.reviewerId) ?? "Unknown", outcome: d.outcome as Outcome, note: d.note,
    feedbackDraft: d.feedbackDraft, createdAt: d.createdAt,
  }));
  const auditViews: AuditView[] = audit.map((a) => ({
    id: a.id, action: a.action, actorName: a.actorId ? (names.user.get(a.actorId) ?? null) : null,
    details: (a.details ?? {}) as Record<string, unknown>, createdAt: a.createdAt,
  }));

  return {
    ...summary,
    states: row.states, launchDate: row.launchDate, priorityReason: row.priorityReason, notes: row.notes,
    versions: versionViews, decisions: decisionViews, audit: auditViews, permissions: permissionsFor(actor, row),
    parent: row.parentId
      ? await db
          .select({ id: tables.submissions.id, code: tables.submissions.code, title: tables.submissions.title })
          .from(tables.submissions)
          .where(eq(tables.submissions.id, row.parentId))
          .then((r) => r[0] ?? null)
      : null,
    variants: [],
  };
}

// ---------------------------------------------------------------------------------- dashboard

export interface DashboardStats {
  generatedAt: Date;
  queue: { open: number; overdue: number; dueSoon: number; unassigned: number; aging: { label: string; count: number }[] };
  kpis: {
    medianTurnaroundHours: number | null;
    slaAttainment: number | null; // 0..1
    firstPassApprovalRate: number | null; // 0..1
    avgRoundsToApproval: number | null;
    decisionsLast30Days: number;
  };
  weekly: { weekStart: string; approved: number; changesRequested: number; rejected: number }[];
  topRules: { ruleCode: string; title: string; count: number; accepted: number; dismissed: number }[];
  acceptance: { source: "rule" | "ai" | "reviewer"; accepted: number; dismissed: number }[];
  partners: {
    partnerId: number; name: string; type: string; submissions: number; approved: number; rejected: number;
    rejectionRate: number | null; avgFindings: number; topRule: string | null; standing: "good" | "watch" | "high_risk";
  }[];
}

const HOUR = 3_600_000;
const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const mondayOf = (d: Date) => {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
  return x;
};

export async function dashboardStats(actor: Actor, now = new Date()): Promise<DashboardStats> {
  if (!canReview(actor.role)) throw new WorkflowError("The dashboard is for compliance staff.", "forbidden");
  const [subs, decisions, versions, findings, partnerRows, ruleRows] = await Promise.all([
    db.select().from(tables.submissions),
    db.select().from(tables.decisions),
    db.select().from(tables.versions),
    db.select().from(tables.findings),
    db.select().from(tables.partners),
    db.select().from(tables.rules),
  ]);
  const subById = new Map(subs.map((s) => [s.id, s]));
  const versionById = new Map(versions.map((v) => [v.id, v]));

  // Queue health
  const open = subs.filter((s) => WITH_COMPLIANCE.includes(s.status));
  const states = open.map((s) => slaState(s.status, s.dueAt, now));
  const ageDays = (s: SubmissionRow) => (now.getTime() - s.submittedAt.getTime()) / (24 * HOUR);
  const aging = [
    { label: "Under 1 day", count: open.filter((s) => ageDays(s) < 1).length },
    { label: "1-2 days", count: open.filter((s) => ageDays(s) >= 1 && ageDays(s) < 2).length },
    { label: "2-3 days", count: open.filter((s) => ageDays(s) >= 2 && ageDays(s) < 3).length },
    { label: "Over 3 days", count: open.filter((s) => ageDays(s) >= 3).length },
  ];

  // Turnaround and SLA over the last 30 days of decisions
  const recent = decisions.filter((d) => now.getTime() - d.createdAt.getTime() <= 30 * 24 * HOUR);
  const turnarounds = recent.flatMap((d) => {
    const v = versionById.get(d.versionId);
    const s = subById.get(d.submissionId);
    if (!v || !s) return [];
    const hours = (d.createdAt.getTime() - v.createdAt.getTime()) / HOUR;
    const limit = v.number > 1 ? SLA_HOURS.resubmission : SLA_HOURS[s.priority];
    return [{ hours, met: hours <= limit }];
  });

  // First-pass approval and rounds
  const firstDecisionBySub = new Map<number, Outcome>();
  for (const d of [...decisions].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
    if (!firstDecisionBySub.has(d.submissionId)) firstDecisionBySub.set(d.submissionId, d.outcome as Outcome);
  }
  const firstOutcomes = [...firstDecisionBySub.values()];
  const approvedSubs = subs.filter((s) => s.status === "approved");

  // Weekly throughput, last 8 weeks
  const thisMonday = mondayOf(now);
  const weekly = Array.from({ length: 8 }, (_, i) => {
    const start = new Date(thisMonday.getTime() - (7 - i) * 7 * 24 * HOUR);
    const end = new Date(start.getTime() + 7 * 24 * HOUR);
    const inWeek = decisions.filter((d) => d.createdAt >= start && d.createdAt < end);
    return {
      weekStart: start.toISOString().slice(0, 10),
      approved: inWeek.filter((d) => d.outcome === "approved").length,
      changesRequested: inWeek.filter((d) => d.outcome === "changes_requested").length,
      rejected: inWeek.filter((d) => d.outcome === "rejected").length,
    };
  });

  // Rule frequency and reviewer agreement
  const ruleTitle = new Map(ruleRows.map((r) => [r.code, r.title]));
  const byRule = new Map<string, { count: number; accepted: number; dismissed: number }>();
  const byPartnerRule = new Map<number, Map<string, number>>();
  for (const f of findings) {
    const v = versionById.get(f.versionId);
    if (!v || now.getTime() - v.createdAt.getTime() > 56 * 24 * HOUR) continue;
    const r = byRule.get(f.ruleCode) ?? { count: 0, accepted: 0, dismissed: 0 };
    r.count += 1;
    if (f.status === "accepted" || f.status === "resolved") r.accepted += 1;
    if (f.status === "dismissed") r.dismissed += 1;
    byRule.set(f.ruleCode, r);
    const pid = subById.get(v.submissionId)?.partnerId;
    if (pid) {
      const m = byPartnerRule.get(pid) ?? new Map<string, number>();
      m.set(f.ruleCode, (m.get(f.ruleCode) ?? 0) + 1);
      byPartnerRule.set(pid, m);
    }
  }
  const acceptance = (["rule", "ai", "reviewer"] as const).map((source) => ({
    source,
    accepted: findings.filter((f) => f.source === source && (f.status === "accepted" || f.status === "resolved")).length,
    dismissed: findings.filter((f) => f.source === source && f.status === "dismissed").length,
  }));

  // Partner scorecards
  const partners = partnerRows.map((p) => {
    const mine = subs.filter((s) => s.partnerId === p.id);
    const approved = mine.filter((s) => s.status === "approved").length;
    const rejected = mine.filter((s) => s.status === "rejected").length;
    const decided = approved + rejected;
    const rate = decided >= 3 ? rejected / decided : null;
    const currentFindings = findings.filter((f) => {
      const v = versionById.get(f.versionId);
      const s = v && subById.get(v.submissionId);
      return s && s.partnerId === p.id && v.number === s.currentVersion;
    }).length;
    const top = [...(byPartnerRule.get(p.id) ?? new Map<string, number>()).entries()].sort((a, b) => b[1] - a[1])[0];
    return {
      partnerId: p.id, name: p.name, type: p.type, submissions: mine.length, approved, rejected, rejectionRate: rate,
      avgFindings: mine.length ? Math.round((currentFindings / mine.length) * 10) / 10 : 0,
      topRule: top ? top[0] : null,
      standing: (rate === null ? "good" : rate > 0.3 ? "high_risk" : rate > 0.15 ? "watch" : "good") as "good" | "watch" | "high_risk",
    };
  }).sort((a, b) => (b.rejectionRate ?? -1) - (a.rejectionRate ?? -1) || b.submissions - a.submissions);

  return {
    generatedAt: now,
    queue: {
      open: open.length,
      overdue: states.filter((s) => s === "overdue").length,
      dueSoon: states.filter((s) => s === "due_soon").length,
      unassigned: open.filter((s) => s.assigneeId === null).length,
      aging,
    },
    kpis: {
      medianTurnaroundHours: median(turnarounds.map((t) => t.hours)),
      slaAttainment: turnarounds.length ? turnarounds.filter((t) => t.met).length / turnarounds.length : null,
      firstPassApprovalRate: firstOutcomes.length ? firstOutcomes.filter((o) => o === "approved").length / firstOutcomes.length : null,
      avgRoundsToApproval: approvedSubs.length ? approvedSubs.reduce((n, s) => n + s.currentVersion, 0) / approvedSubs.length : null,
      decisionsLast30Days: recent.length,
    },
    weekly,
    topRules: [...byRule.entries()]
      .map(([ruleCode, v]) => ({ ruleCode, title: ruleTitle.get(ruleCode) ?? ruleCode, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    acceptance,
    partners,
  };
}

export interface RuleWithUsage {
  code: string; title: string; description: string; category: string; severity: "high" | "medium" | "low";
  kind: string; products: string[]; channels: string[]; citation: string; guidance: string; checkInstruction: string;
  enabled: boolean; aiReview: boolean; version: number; updatedAt: Date;
  usage: { total: number; accepted: number; dismissed: number };
}

/** The rules library with how often each rule fires and how often reviewers agree. */
export async function listRulesWithUsage(): Promise<RuleWithUsage[]> {
  const [rules, findings] = await Promise.all([db.select().from(tables.rules).orderBy(asc(tables.rules.code)), db.select().from(tables.findings)]);
  return rules.map((r) => {
    const mine = findings.filter((f) => f.ruleCode === r.code);
    return {
      code: r.code, title: r.title, description: r.description, category: r.category, severity: r.severity, kind: r.kind,
      products: r.products, channels: r.channels, citation: r.citation, guidance: r.guidance, checkInstruction: r.checkInstruction,
      enabled: r.enabled, aiReview: r.aiReview, version: r.version, updatedAt: r.updatedAt,
      usage: {
        total: mine.length,
        accepted: mine.filter((f) => f.status === "accepted" || f.status === "resolved").length,
        dismissed: mine.filter((f) => f.status === "dismissed").length,
      },
    };
  });
}

/**
 * An uploaded file with its bytes, only when the actor may view at least one submission whose
 * version uses it. Unlinked or foreign assets return null, the same as a missing id.
 */
export async function getViewableAsset(actor: Actor, assetId: number) {
  const links = await db
    .select({ submitterId: tables.submissions.submitterId, partnerId: tables.submissions.partnerId })
    .from(tables.versions)
    .innerJoin(tables.submissions, eq(tables.versions.submissionId, tables.submissions.id))
    .where(eq(tables.versions.assetId, assetId));
  if (!links.some((s) => canView(actor, s))) return null;
  const [asset] = await db.select().from(tables.assets).where(eq(tables.assets.id, assetId));
  return asset ?? null;
}
