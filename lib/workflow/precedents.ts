import { desc, eq, inArray } from "drizzle-orm";
import { db, tables } from "@/lib/db";
import type { Precedent } from "@/lib/compliance/feature-types";
import { findPrecedents } from "@/lib/compliance/precedents";
import type { Channel, Product } from "@/lib/compliance/types";
import type { FindingView } from "./types";

export interface PrecedentData {
  corpus: Precedent[];
  /** Submission code to id, for linking live precedents to `/submissions/<id>`. */
  submissionIds: Record<string, number>;
}

const OUTCOMES = new Set<Precedent["outcome"]>(["fixed", "dismissed", "rejected"]);

/**
 * The precedent library plus decisions taken in the app: dismissed findings (the reason is the comment) and
 * accepted findings on submissions that reached a final decision (fixed if eventually approved, else rejected).
 */
export async function loadPrecedentData(): Promise<PrecedentData> {
  const [library, users, acted] = await Promise.all([
    db.select().from(tables.precedents),
    db.select({ id: tables.users.id, name: tables.users.name }).from(tables.users),
    db
      .select({
        id: tables.findings.id, ruleCode: tables.findings.ruleCode, quote: tables.findings.quote, issue: tables.findings.issue,
        status: tables.findings.status, dismissReason: tables.findings.dismissReason, actedBy: tables.findings.actedBy,
        actedAt: tables.findings.actedAt, submissionId: tables.submissions.id, code: tables.submissions.code,
        product: tables.submissions.product, channel: tables.submissions.channel, subStatus: tables.submissions.status,
        decidedAt: tables.submissions.decidedAt,
      })
      .from(tables.findings)
      .innerJoin(tables.versions, eq(tables.findings.versionId, tables.versions.id))
      .innerJoin(tables.submissions, eq(tables.versions.submissionId, tables.submissions.id))
      .where(inArray(tables.findings.status, ["dismissed", "accepted"])),
  ]);
  const userName = new Map(users.map((u) => [u.id, u.name]));

  const finalIds = [...new Set(acted.filter((f) => isFinal(f.subStatus)).map((f) => f.submissionId))];
  const finalDecision = new Map<number, { note: string | null; reviewerId: number; createdAt: Date }>();
  if (finalIds.length > 0) {
    const rows = await db
      .select()
      .from(tables.decisions)
      .where(inArray(tables.decisions.submissionId, finalIds))
      .orderBy(desc(tables.decisions.createdAt));
    for (const d of rows) if (!finalDecision.has(d.submissionId)) finalDecision.set(d.submissionId, d);
  }

  const corpus: Precedent[] = library.map((r) => ({
    id: `lib-${r.id}`, source: "library", ruleCode: r.ruleCode, product: r.product, channel: r.channel,
    originalText: r.originalText, issue: r.issue, reviewerName: r.reviewerName, reviewerComment: r.reviewerComment,
    outcome: OUTCOMES.has(r.outcome as Precedent["outcome"]) ? (r.outcome as Precedent["outcome"]) : "fixed",
    approvedText: r.approvedText, decidedAt: r.decidedAt, submissionCode: r.submissionCode,
  }));
  const submissionIds: Record<string, number> = {};

  for (const f of acted) {
    let outcome: Precedent["outcome"];
    let comment: string;
    let reviewerId = f.actedBy;
    let decidedAt = f.actedAt;
    if (f.status === "dismissed") {
      if (!f.dismissReason) continue;
      outcome = "dismissed";
      comment = f.dismissReason;
    } else {
      const d = finalDecision.get(f.submissionId);
      if (!d || !isFinal(f.subStatus)) continue;
      outcome = f.subStatus === "approved" ? "fixed" : "rejected";
      comment = d.note?.trim() || "Accepted as a required change";
      reviewerId ??= d.reviewerId;
      decidedAt = f.decidedAt ?? d.createdAt;
    }
    corpus.push({
      id: `live-${f.id}`, source: "live", ruleCode: f.ruleCode, product: f.product, channel: f.channel,
      originalText: f.quote, issue: f.issue, reviewerName: (reviewerId && userName.get(reviewerId)) || "Compliance reviewer",
      reviewerComment: comment, outcome, approvedText: null, decidedAt: decidedAt ?? new Date(0), submissionCode: f.code,
    });
    submissionIds[f.code] = f.submissionId;
  }
  return { corpus, submissionIds };
}

export async function loadPrecedentCorpus(): Promise<Precedent[]> {
  return (await loadPrecedentData()).corpus;
}

function isFinal(status: string): status is "approved" | "rejected" {
  return status === "approved" || status === "rejected";
}

/**
 * Fills `precedents` on each finding. Live precedents from the submission being reviewed are excluded so a
 * finding never "recalls" itself or a sibling version of the same asset.
 */
export function attachPrecedents(
  findings: FindingView[],
  ctx: { product: Product; channel: Channel; excludeSubmissionCode?: string },
  corpus: Precedent[],
): FindingView[] {
  const pool = ctx.excludeSubmissionCode
    ? corpus.filter((p) => !(p.source === "live" && p.submissionCode === ctx.excludeSubmissionCode))
    : corpus;
  return findings.map((f) => ({
    ...f,
    precedents: findPrecedents({ ruleCode: f.ruleCode, quote: f.quote, issue: f.issue, product: ctx.product, channel: ctx.channel }, pool),
  }));
}
