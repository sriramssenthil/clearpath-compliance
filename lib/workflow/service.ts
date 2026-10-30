import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { anchorQuote } from "@/lib/compliance/anchor";
import type { AnchoredFinding, AssetContext } from "@/lib/compliance/types";
import { PRODUCTS, CHANNELS } from "@/lib/compliance/types";
import { db, tables } from "@/lib/db";
import { analyzeForSubmission, contentHash, ruleInfoFor } from "./analysis";
import { AUDIT } from "./audit-actions";
import { buildFeedbackDraft } from "./feedback";
import {
  approvalBlockers,
  canDecideFrom,
  canResubmitFrom,
  canReview,
  canWithdrawFrom,
  computeDueAt,
  type Outcome,
} from "./flow";
import { isSubmitterSide } from "./permissions";
import { WorkflowError, type Actor, type PrecheckInput, type PrecheckResult, type SubmissionInput } from "./types";

type Batch = Parameters<typeof db.batch>[0];
const runBatch = (queries: unknown[]) => db.batch(queries as unknown as Batch);

const submissionSchema = z.object({
  title: z.string().trim().min(3, "Give the submission a title (3+ characters).").max(120),
  product: z.enum(PRODUCTS),
  channel: z.enum(CHANNELS),
  states: z.array(z.string().regex(/^[A-Za-z]{2}$/, "States must be two-letter codes.")).max(51).default([]),
  content: z.string().trim().min(20, "Paste at least a sentence or two of the asset text.").max(30_000),
  sourceUrl: z.string().url().nullish(),
  launchDate: z.string().nullish(),
  priority: z.enum(["standard", "expedited"]).default("standard"),
  priorityReason: z.string().trim().max(500).nullish(),
  notes: z.string().trim().max(2000).nullish(),
});

function parse<T>(schema: z.ZodType<T>, raw: unknown): T {
  const r = schema.safeParse(raw);
  if (!r.success) throw new WorkflowError(r.error.issues[0]?.message ?? "Invalid input.", "invalid");
  return r.data;
}

function requireReviewer(actor: Actor) {
  if (!canReview(actor.role)) throw new WorkflowError("Only compliance reviewers can do this.", "forbidden");
}

async function loadSubmission(id: number) {
  const [sub] = await db.select().from(tables.submissions).where(eq(tables.submissions.id, id));
  if (!sub) throw new WorkflowError("Submission not found.", "not_found");
  return sub;
}

async function currentVersionOf(submissionId: number, number: number) {
  const [v] = await db
    .select()
    .from(tables.versions)
    .where(and(eq(tables.versions.submissionId, submissionId), eq(tables.versions.number, number)));
  if (!v) throw new WorkflowError("Version not found.", "not_found");
  return v;
}

const findingValues = (versionId: number, findings: AnchoredFinding[]) =>
  findings.map((f) => ({
    versionId,
    source: f.source,
    ruleCode: f.ruleCode,
    severity: f.severity,
    quote: f.quote,
    startOffset: f.start,
    endOffset: f.end,
    issue: f.issue,
    suggestion: f.suggestion ?? null,
    confidence: f.confidence ?? null,
  }));

async function allocateIds() {
  const res = (await db.execute(
    sql`select nextval(pg_get_serial_sequence('submissions','id')) as sid,
               nextval(pg_get_serial_sequence('versions','id')) as vid,
               (select coalesce(max(substring(code from 4)::int), 1000) + 1 from submissions) as n`,
  )) as unknown as { rows?: Record<string, unknown>[] } & Record<string, unknown>[];
  const row = (res.rows ?? res)[0];
  return { submissionId: Number(row.sid), versionId: Number(row.vid), codeNumber: Number(row.n) };
}

const ctxOf = (sub: { product: AssetContext["product"]; channel: AssetContext["channel"]; states: string[] }, content: string, isAffiliate: boolean): AssetContext => ({
  product: sub.product,
  channel: sub.channel,
  states: sub.states,
  content,
  isAffiliate,
});

/** Pre-flight check shown to the submitter before they send anything to compliance. Nothing is stored. */
export async function precheck(actor: Actor, raw: PrecheckInput): Promise<PrecheckResult> {
  const input = parse(submissionSchema.pick({ product: true, channel: true, states: true, content: true }), raw);
  const ctx: AssetContext = { ...input, states: input.states.map((s) => s.toUpperCase()), isAffiliate: actor.role === "affiliate" };
  const { analysis, ruleInfo } = await analyzeForSubmission(ctx, actor.partnerId, actor.id);
  return { analysis, ruleInfo };
}

export async function createSubmission(actor: Actor, raw: SubmissionInput): Promise<{ id: number; code: string }> {
  if (actor.role !== "marketer" && actor.role !== "affiliate") {
    throw new WorkflowError("Only marketers and affiliate partners submit assets for review.", "forbidden");
  }
  const input = parse(submissionSchema, raw);
  if (input.priority === "expedited" && !input.priorityReason) {
    throw new WorkflowError("Expedited reviews need a reason (for example a launch date).", "invalid");
  }
  const states = input.states.map((s) => s.toUpperCase());
  const ctx = ctxOf({ ...input, states }, input.content, actor.role === "affiliate");
  const { analysis } = await analyzeForSubmission(ctx, actor.partnerId, actor.id);

  const ids = await allocateIds();
  const now = new Date();
  const code = `CP-${ids.codeNumber}`;
  const findings = findingValues(ids.versionId, analysis.findings);

  await runBatch([
    db.insert(tables.submissions).values({
      id: ids.submissionId,
      code,
      title: input.title,
      product: input.product,
      channel: input.channel,
      states,
      launchDate: input.launchDate ? new Date(input.launchDate) : null,
      priority: input.priority,
      priorityReason: input.priorityReason ?? null,
      notes: input.notes ?? null,
      status: "submitted",
      submitterId: actor.id,
      partnerId: actor.partnerId,
      currentVersion: 1,
      riskScore: analysis.riskScore,
      riskLevel: analysis.riskLevel,
      submittedAt: now,
      dueAt: computeDueAt(now, input.priority, false),
      updatedAt: now,
    }),
    db.insert(tables.versions).values({
      id: ids.versionId,
      submissionId: ids.submissionId,
      number: 1,
      content: analysis.content,
      sourceUrl: input.sourceUrl ?? null,
      contentHash: contentHash(analysis.content),
      analysisStatus: analysis.status,
      analysisSummary: analysis.summary,
      model: analysis.model,
      createdBy: actor.id,
      createdAt: now,
    }),
    ...(findings.length ? [db.insert(tables.findings).values(findings)] : []),
    db.insert(tables.auditEvents).values([
      { submissionId: ids.submissionId, actorId: actor.id, action: AUDIT.created, details: { versionNumber: 1, priority: input.priority }, createdAt: now },
      {
        submissionId: ids.submissionId,
        actorId: null,
        action: AUDIT.analysisCompleted,
        details: { versionNumber: 1, findings: findings.length, status: analysis.status, model: analysis.model },
        createdAt: new Date(now.getTime() + 1),
      },
    ]),
  ]);
  return { id: ids.submissionId, code };
}

export async function resubmit(actor: Actor, submissionId: number, raw: { content: string; sourceUrl?: string | null }) {
  const sub = await loadSubmission(submissionId);
  if (!isSubmitterSide(actor, sub)) throw new WorkflowError("You can only resubmit your own submissions.", "forbidden");
  if (!canResubmitFrom(sub.status)) throw new WorkflowError("This submission is not waiting for changes.", "conflict");
  const { content, sourceUrl } = parse(submissionSchema.pick({ content: true, sourceUrl: true }), raw);

  const prev = await currentVersionOf(sub.id, sub.currentVersion);
  if (contentHash(content) === prev.contentHash) {
    throw new WorkflowError("The text is identical to the previous version. Make your changes before resubmitting.", "invalid");
  }
  const isAffiliate = sub.partnerId !== null;
  const { analysis } = await analyzeForSubmission(ctxOf(sub, content, isAffiliate), sub.partnerId, actor.id);

  // A previous finding is resolved when the fresh analysis no longer raises that rule. Reviewer-added
  // findings are not re-derivable, so they carry over only while their quote is still in the text.
  const prevFindings = await db
    .select()
    .from(tables.findings)
    .where(and(eq(tables.findings.versionId, prev.id), inArray(tables.findings.status, ["open", "accepted"])));
  const stillRaised = new Set(analysis.findings.map((f) => f.ruleCode));
  const resolved = prevFindings.filter((f) =>
    f.source === "reviewer" ? anchorQuote(analysis.content, f.quote) === null : !stillRaised.has(f.ruleCode),
  );
  const carried = prevFindings.filter((f) => f.source === "reviewer" && !resolved.includes(f));

  const ids = await allocateIds();
  const now = new Date();
  const number = sub.currentVersion + 1;
  const rows = findingValues(ids.versionId, analysis.findings);
  const carriedRows = carried.map((f) => {
    const a = anchorQuote(analysis.content, f.quote)!;
    return {
      versionId: ids.versionId, source: "reviewer" as const, ruleCode: f.ruleCode, severity: f.severity, quote: f.quote,
      startOffset: a.start, endOffset: a.end, issue: f.issue, suggestion: f.suggestion, confidence: f.confidence,
      status: "accepted" as const, actedBy: f.actedBy, actedAt: f.actedAt,
    };
  });

  await runBatch([
    ...(resolved.length
      ? [db.update(tables.findings).set({ status: "resolved", actedBy: null, actedAt: now }).where(inArray(tables.findings.id, resolved.map((f) => f.id)))]
      : []),
    db.insert(tables.versions).values({
      id: ids.versionId, submissionId: sub.id, number, content: analysis.content, sourceUrl: sourceUrl ?? null,
      contentHash: contentHash(analysis.content), analysisStatus: analysis.status, analysisSummary: analysis.summary,
      model: analysis.model, createdBy: actor.id, createdAt: now,
    }),
    ...(rows.length || carriedRows.length ? [db.insert(tables.findings).values([...rows, ...carriedRows])] : []),
    db.update(tables.submissions).set({
      status: "submitted", currentVersion: number, riskScore: analysis.riskScore, riskLevel: analysis.riskLevel,
      dueAt: computeDueAt(now, sub.priority, true), updatedAt: now,
    }).where(eq(tables.submissions.id, sub.id)),
    db.insert(tables.auditEvents).values([
      { submissionId: sub.id, actorId: actor.id, action: AUDIT.resubmitted, details: { versionNumber: number, resolvedFindings: resolved.length }, createdAt: now },
      { submissionId: sub.id, actorId: null, action: AUDIT.analysisCompleted, details: { versionNumber: number, findings: rows.length, status: analysis.status, model: analysis.model }, createdAt: new Date(now.getTime() + 1) },
      ...resolved.map((f, i) => ({
        submissionId: sub.id, actorId: null, action: AUDIT.findingResolved,
        details: { ruleCode: f.ruleCode, fromVersion: sub.currentVersion, toVersion: number }, createdAt: new Date(now.getTime() + 2 + i),
      })),
    ]),
  ]);
  return { versionNumber: number, resolved: resolved.length };
}

export async function claim(actor: Actor, submissionId: number) {
  requireReviewer(actor);
  const sub = await loadSubmission(submissionId);
  if (sub.status !== "submitted") throw new WorkflowError("This submission has already been picked up.", "conflict");
  const now = new Date();
  await runBatch([
    db.update(tables.submissions).set({ status: "in_review", assigneeId: actor.id, updatedAt: now }).where(eq(tables.submissions.id, sub.id)),
    db.insert(tables.auditEvents).values({ submissionId: sub.id, actorId: actor.id, action: AUDIT.claimed, details: {}, createdAt: now }),
  ]);
}

export type FindingAction = { action: "accept" } | { action: "dismiss"; reason: string } | { action: "reopen" };

export async function actOnFinding(actor: Actor, findingId: number, act: FindingAction) {
  requireReviewer(actor);
  const [row] = await db
    .select({ finding: tables.findings, version: tables.versions })
    .from(tables.findings)
    .innerJoin(tables.versions, eq(tables.findings.versionId, tables.versions.id))
    .where(eq(tables.findings.id, findingId));
  if (!row) throw new WorkflowError("Finding not found.", "not_found");
  const sub = await loadSubmission(row.version.submissionId);
  if (!canDecideFrom(sub.status)) throw new WorkflowError("This submission is no longer under review.", "conflict");
  if (row.version.number !== sub.currentVersion) throw new WorkflowError("Only findings on the latest version can be changed.", "conflict");
  if (row.finding.status === "resolved") throw new WorkflowError("This finding was already resolved.", "conflict");

  const reason = act.action === "dismiss" ? act.reason.trim() : null;
  if (act.action === "dismiss" && (!reason || reason.length < 3)) {
    throw new WorkflowError("Say why you are dismissing this finding. The reason is kept in the audit trail.", "invalid");
  }
  const now = new Date();
  const status = act.action === "accept" ? "accepted" : act.action === "dismiss" ? "dismissed" : "open";
  const audit = act.action === "accept" ? AUDIT.findingAccepted : act.action === "dismiss" ? AUDIT.findingDismissed : AUDIT.findingReopened;

  await runBatch([
    // Touching a finding on an unclaimed item claims it, so work is never done anonymously.
    ...(sub.status === "submitted"
      ? [
          db.update(tables.submissions).set({ status: "in_review", assigneeId: actor.id, updatedAt: now }).where(eq(tables.submissions.id, sub.id)),
          db.insert(tables.auditEvents).values({ submissionId: sub.id, actorId: actor.id, action: AUDIT.claimed, details: { automatic: true }, createdAt: now }),
        ]
      : []),
    db.update(tables.findings).set({
      status, dismissReason: reason, actedBy: act.action === "reopen" ? null : actor.id, actedAt: act.action === "reopen" ? null : now,
    }).where(eq(tables.findings.id, findingId)),
    db.insert(tables.auditEvents).values({
      submissionId: sub.id, actorId: actor.id, action: audit,
      details: { findingId, ruleCode: row.finding.ruleCode, reason, versionNumber: row.version.number }, createdAt: new Date(now.getTime() + 1),
    }),
  ]);
}

export async function addReviewerFinding(
  actor: Actor,
  submissionId: number,
  raw: { ruleCode: string; quote: string; issue: string; suggestion?: string | null },
) {
  requireReviewer(actor);
  const sub = await loadSubmission(submissionId);
  if (!canDecideFrom(sub.status)) throw new WorkflowError("This submission is no longer under review.", "conflict");
  const version = await currentVersionOf(sub.id, sub.currentVersion);
  const [rule] = await db.select().from(tables.rules).where(eq(tables.rules.code, raw.ruleCode));
  if (!rule) throw new WorkflowError("Choose a rule from the library.", "invalid");
  const quote = raw.quote.trim();
  const anchor = quote ? anchorQuote(version.content, quote) : null;
  if (!anchor) throw new WorkflowError("Select text that appears in the asset to attach the finding to.", "invalid");
  const issue = raw.issue.trim();
  if (issue.length < 5) throw new WorkflowError("Describe the issue in a sentence.", "invalid");
  const now = new Date();
  await runBatch([
    ...(sub.status === "submitted"
      ? [
          db.update(tables.submissions).set({ status: "in_review", assigneeId: actor.id, updatedAt: now }).where(eq(tables.submissions.id, sub.id)),
          db.insert(tables.auditEvents).values({ submissionId: sub.id, actorId: actor.id, action: AUDIT.claimed, details: { automatic: true }, createdAt: now }),
        ]
      : []),
    db.insert(tables.findings).values({
      versionId: version.id, source: "reviewer", ruleCode: rule.code, severity: rule.severity,
      quote: version.content.slice(anchor.start, anchor.end), startOffset: anchor.start, endOffset: anchor.end,
      issue, suggestion: raw.suggestion?.trim() || null, status: "accepted", actedBy: actor.id, actedAt: now,
    }),
    db.insert(tables.auditEvents).values({
      submissionId: sub.id, actorId: actor.id, action: AUDIT.findingAdded,
      details: { ruleCode: rule.code, versionNumber: version.number }, createdAt: new Date(now.getTime() + 1),
    }),
  ]);
}

export async function decide(actor: Actor, submissionId: number, input: { outcome: Outcome; note?: string | null }) {
  requireReviewer(actor);
  const sub = await loadSubmission(submissionId);
  if (!canDecideFrom(sub.status)) throw new WorkflowError("This submission is no longer under review.", "conflict");
  const version = await currentVersionOf(sub.id, sub.currentVersion);
  const findings = await db.select().from(tables.findings).where(eq(tables.findings.versionId, version.id));
  const note = input.note?.trim() || null;

  if (input.outcome === "approved") {
    const blockers = approvalBlockers(findings);
    if (blockers > 0) {
      throw new WorkflowError(
        `${blockers} high-severity finding${blockers === 1 ? " is" : "s are"} still open or accepted. Dismiss ${blockers === 1 ? "it" : "them"} with a reason, or request changes instead of approving.`,
        "conflict",
      );
    }
  }
  const accepted = findings.filter((f) => f.status === "accepted");
  if (input.outcome === "changes_requested" && accepted.length === 0 && !note) {
    throw new WorkflowError("Accept at least one finding or add a note saying what needs to change.", "invalid");
  }
  if (input.outcome === "rejected" && !note) throw new WorkflowError("Add a note explaining the rejection.", "invalid");

  const [submitter] = await db.select().from(tables.users).where(eq(tables.users.id, sub.submitterId));
  const info = await ruleInfoFor(accepted.map((f) => f.ruleCode));
  const feedbackDraft =
    input.outcome === "approved"
      ? null
      : buildFeedbackDraft({
          submissionCode: sub.code, title: sub.title,
          submitterFirstName: submitter?.name.split(" ")[0] ?? "there",
          reviewerFirstName: actor.name.split(" ")[0], outcome: input.outcome, note,
          required: accepted.map((f) => ({ ruleCode: f.ruleCode, ruleTitle: info[f.ruleCode]?.title ?? f.ruleCode, quote: f.quote, issue: f.issue, suggestion: f.suggestion })),
        });

  const now = new Date();
  const audit = input.outcome === "approved" ? AUDIT.approved : input.outcome === "rejected" ? AUDIT.rejected : AUDIT.changesRequested;
  await runBatch([
    db.insert(tables.decisions).values({ submissionId: sub.id, versionId: version.id, reviewerId: actor.id, outcome: input.outcome, note, feedbackDraft, createdAt: now }),
    db.update(tables.submissions).set({
      status: input.outcome, assigneeId: sub.assigneeId ?? actor.id, updatedAt: now,
      decidedAt: input.outcome === "changes_requested" ? null : now,
    }).where(eq(tables.submissions.id, sub.id)),
    db.insert(tables.auditEvents).values({
      submissionId: sub.id, actorId: actor.id, action: audit,
      details: { versionNumber: version.number, acceptedFindings: accepted.length, note }, createdAt: now,
    }),
  ]);
  return { feedbackDraft };
}

export async function withdraw(actor: Actor, submissionId: number) {
  const sub = await loadSubmission(submissionId);
  if (!(isSubmitterSide(actor, sub) || actor.role === "lead")) throw new WorkflowError("You cannot withdraw this submission.", "forbidden");
  if (!canWithdrawFrom(sub.status)) throw new WorkflowError("This submission is already closed.", "conflict");
  const now = new Date();
  await runBatch([
    db.update(tables.submissions).set({ status: "withdrawn", updatedAt: now, decidedAt: now }).where(eq(tables.submissions.id, sub.id)),
    db.insert(tables.auditEvents).values({ submissionId: sub.id, actorId: actor.id, action: AUDIT.withdrawn, details: {}, createdAt: now }),
  ]);
}

const rulePatchSchema = z.object({
  enabled: z.boolean().optional(),
  severity: z.enum(["high", "medium", "low"]).optional(),
  description: z.string().trim().min(10).max(2000).optional(),
  guidance: z.string().trim().min(10).max(2000).optional(),
  checkInstruction: z.string().trim().min(10).max(4000).optional(),
});

/** Rules are data: the compliance lead edits them here and every later analysis uses the new version. */
export async function updateRule(actor: Actor, code: string, raw: z.input<typeof rulePatchSchema>) {
  if (actor.role !== "lead") throw new WorkflowError("Only the compliance lead can edit rules.", "forbidden");
  const patch = parse(rulePatchSchema, raw);
  if (Object.keys(patch).length === 0) throw new WorkflowError("Nothing to change.", "invalid");
  const [rule] = await db.select().from(tables.rules).where(eq(tables.rules.code, code));
  if (!rule) throw new WorkflowError("Rule not found.", "not_found");
  const now = new Date();
  await runBatch([
    db.update(tables.rules).set({ ...patch, version: rule.version + 1, updatedAt: now }).where(eq(tables.rules.code, code)),
    db.insert(tables.auditEvents).values({
      submissionId: null, actorId: actor.id, action: AUDIT.ruleUpdated,
      details: { ruleCode: code, fromVersion: rule.version, toVersion: rule.version + 1, changed: Object.keys(patch) }, createdAt: now,
    }),
  ]);
}
