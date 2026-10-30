import { and, desc, eq, inArray } from "drizzle-orm";
import { classifyChanges } from "@/lib/compliance/change-scope";
import type { ChangeScope } from "@/lib/compliance/feature-types";
import { loadRules } from "@/lib/data/reference";
import { db, tables } from "@/lib/db";
import { approvalBlockers, canDecideFrom } from "./flow";
import { canView } from "./permissions";
import { decide } from "./service";
import { WorkflowError, type Actor } from "./types";

type Rules = Awaited<ReturnType<typeof loadRules>>;

/** The exact text a submission was approved on (its approved version), or null if never approved. */
async function approvedContent(submissionId: number): Promise<string | null> {
  const [row] = await db
    .select({ content: tables.versions.content })
    .from(tables.decisions)
    .innerJoin(tables.versions, eq(tables.decisions.versionId, tables.versions.id))
    .where(and(eq(tables.decisions.submissionId, submissionId), eq(tables.decisions.outcome, "approved")))
    .orderBy(desc(tables.decisions.createdAt))
    .limit(1);
  return row?.content ?? null;
}

async function spansOf(versionId: number) {
  const rows = await db
    .select({ start: tables.findings.startOffset, end: tables.findings.endOffset })
    .from(tables.findings)
    .where(eq(tables.findings.versionId, versionId));
  return rows.flatMap((r) => (r.start !== null && r.end !== null ? [{ start: r.start, end: r.end }] : []));
}

/**
 * What changed in a version: against the previous version, or, for the first version of a variant,
 * against the master's approved text. Null when there is nothing to compare with.
 */
export async function changeScopeForVersion(
  sub: { id: number; parentId: number | null },
  version: { id: number; number: number; content: string },
  rules?: Rules,
): Promise<ChangeScope | null> {
  const ruleSet = rules ?? (await loadRules());
  if (version.number > 1) {
    const [prev] = await db
      .select()
      .from(tables.versions)
      .where(and(eq(tables.versions.submissionId, sub.id), eq(tables.versions.number, version.number - 1)));
    if (!prev) return null;
    return classifyChanges(prev.content, version.content, {
      rules: ruleSet,
      flaggedSpans: await spansOf(prev.id),
      comparedTo: { kind: "previous_version", label: `version ${prev.number}` },
    });
  }
  if (sub.parentId) {
    const [master] = await db.select({ code: tables.submissions.code }).from(tables.submissions).where(eq(tables.submissions.id, sub.parentId));
    const base = await approvedContent(sub.parentId);
    if (!master || base === null) return null;
    return classifyChanges(base, version.content, { rules: ruleSet, comparedTo: { kind: "master", label: `approved master ${master.code}` } });
  }
  return null;
}

/** Fast-track flag for queue rows: latest version changed no regulated text. */
export async function fastTrackMap(subs: { id: number; parentId: number | null; currentVersion: number }[]): Promise<Map<number, boolean>> {
  const candidates = subs.filter((s) => s.currentVersion > 1 || s.parentId);
  const out = new Map<number, boolean>();
  if (candidates.length === 0) return out;
  const rules = await loadRules();
  const versions = await db
    .select()
    .from(tables.versions)
    .where(inArray(tables.versions.submissionId, candidates.map((s) => s.id)));
  await Promise.all(
    candidates.map(async (s) => {
      const v = versions.find((x) => x.submissionId === s.id && x.number === s.currentVersion);
      if (!v) return;
      const scope = await changeScopeForVersion(s, v, rules);
      out.set(s.id, Boolean(scope?.fastTrack));
    }),
  );
  return out;
}

export interface VariantRowData {
  id: number;
  code: string;
  title: string;
  status: string;
  scope: ChangeScope | null;
  openHighFindings: number;
  eligible: boolean;
}

/** Variants of a master, with whether each can be cleared in bulk. */
export async function variantsOf(actor: Actor, masterId: number): Promise<VariantRowData[]> {
  const children = (await db.select().from(tables.submissions).where(eq(tables.submissions.parentId, masterId))).filter((c) => canView(actor, c));
  if (children.length === 0) return [];
  const rules = await loadRules();
  const versions = await db.select().from(tables.versions).where(inArray(tables.versions.submissionId, children.map((c) => c.id)));
  return Promise.all(
    children.map(async (c) => {
      const v = versions.find((x) => x.submissionId === c.id && x.number === c.currentVersion)!;
      const findings = await db.select().from(tables.findings).where(eq(tables.findings.versionId, v.id));
      const scope = await changeScopeForVersion({ id: c.id, parentId: masterId }, { ...v, number: 1 }, rules);
      const blockers = approvalBlockers(findings);
      return {
        id: c.id,
        code: c.code,
        title: c.title,
        status: c.status,
        scope,
        openHighFindings: blockers,
        eligible: Boolean(scope?.fastTrack) && blockers === 0 && canDecideFrom(c.status),
      };
    }),
  );
}

/**
 * Bulk-approve variants whose only differences from the approved master are non-regulated. Each one is
 * re-checked here (never trusting the client's list) and approved through the normal decision path, so
 * every approval is a recorded reviewer decision with its own audit entry.
 */
export async function approveVariants(actor: Actor, masterId: number, ids: number[]) {
  const [master] = await db.select().from(tables.submissions).where(eq(tables.submissions.id, masterId));
  if (!master) throw new WorkflowError("Master asset not found.", "not_found");
  const rows = await variantsOf(actor, masterId);
  const eligible = rows.filter((r) => r.eligible && ids.includes(r.id));
  for (const r of eligible) {
    await decide(actor, r.id, {
      outcome: "approved",
      note: `Fast-tracked: the only differences from approved master ${master.code} are non-regulated (${r.scope?.summary ?? "no claim changed"}).`,
    });
  }
  return { approved: eligible.length, skipped: ids.length - eligible.length };
}
