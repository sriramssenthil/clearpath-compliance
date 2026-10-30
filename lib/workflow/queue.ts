import { fastTrackMap } from "./variants";
import { db, tables } from "@/lib/db";
import { comparePriority, computePriority, type PartnerStanding } from "./priority";
import { listQueue } from "./queries";
import type { Actor, QueueFilters, SubmissionSummary } from "./types";

export type QueueSort = "priority" | "deadline";

/** Same rule as the dashboard scorecards: at least 3 decided, above 30% rejected is high risk, above 15% watch. */
export function partnerStandings(rows: { partnerId: number | null; status: string }[]): Map<number, PartnerStanding> {
  const tally = new Map<number, { approved: number; rejected: number }>();
  for (const r of rows) {
    if (!r.partnerId || (r.status !== "approved" && r.status !== "rejected")) continue;
    const t = tally.get(r.partnerId) ?? { approved: 0, rejected: 0 };
    t[r.status] += 1;
    tally.set(r.partnerId, t);
  }
  const out = new Map<number, PartnerStanding>();
  for (const [pid, t] of tally) {
    const decided = t.approved + t.rejected;
    const rate = decided >= 3 ? t.rejected / decided : null;
    out.set(pid, rate === null ? "good" : rate > 0.3 ? "high_risk" : rate > 0.15 ? "watch" : "good");
  }
  return out;
}

/** Attaches a priority breakdown to every row; sorts by it unless the deadline order is asked for. */
export function prioritize(rows: SubmissionSummary[], standings: Map<number, PartnerStanding>, sort: QueueSort, now: Date) {
  const scored = rows.map((s) => ({
    ...s,
    priorityScore: computePriority({ ...s, partnerStanding: s.partnerId ? standings.get(s.partnerId) : undefined }, now),
  }));
  return sort === "priority" ? scored.sort(comparePriority) : scored;
}

/** The reviewer queue with a priority score per item. "deadline" keeps listQueue's SLA-then-risk order. */
export async function listPrioritizedQueue(
  actor: Actor,
  filters: QueueFilters = {},
  sort: QueueSort = "priority",
  now = new Date(),
): Promise<SubmissionSummary[]> {
  const [rows, all] = await Promise.all([
    listQueue(actor, filters),
    db.select({ partnerId: tables.submissions.partnerId, status: tables.submissions.status }).from(tables.submissions),
  ]);
  const fast = await fastTrackMap(rows);
  const withFast = rows.map((r) => (fast.has(r.id) ? { ...r, fastTrack: fast.get(r.id) } : r));
  return prioritize(withFast, partnerStandings(all), sort, now);
}
