import { describe, expect, it } from "vitest";
import { comparePriority, computePriority, PRIORITY_WEIGHTS as W, type PriorityInput } from "@/lib/workflow/priority";
import { partnerStandings, prioritize } from "@/lib/workflow/queue";
import type { SubmissionSummary } from "@/lib/workflow/types";

const NOW = new Date("2026-10-28T16:00:00Z");
const H = 3_600_000;
const at = (hours: number) => new Date(NOW.getTime() + hours * H);
const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

// A personal loan, submitted minutes ago, on track, with nothing open: scores zero.
const base: PriorityInput = {
  status: "submitted",
  priority: "standard",
  product: "personal_loan",
  openFindings: 0,
  highOpenFindings: 0,
  dueAt: at(30),
  sla: "on_track",
  launchDate: null,
  submittedAt: at(-0.5),
};
const score = (over: Partial<PriorityInput>) => computePriority({ ...base, ...over }, NOW);

describe("computePriority factors", () => {
  it("scores a quiet item zero with no factor lines", () => {
    expect(score({})).toEqual({ score: 0, factors: [] });
  });

  it("weights open findings by severity", () => {
    const r = score({ openFindings: 3, highOpenFindings: 1 });
    expect(r.score).toBe(1 * W.highFinding + 2 * W.otherFinding);
    expect(r.factors).toEqual([
      { label: "1 high-severity finding open (5 each)", points: 5 },
      { label: "2 other findings open (2 each)", points: 4 },
    ]);
    expect(score({ openFindings: 2, highOpenFindings: 2 }).factors).toHaveLength(1);
  });

  it("adds SLA urgency only while compliance holds the clock", () => {
    expect(score({ dueAt: at(-1), sla: "overdue" }).score).toBe(W.slaOverdue);
    expect(score({ dueAt: at(11), sla: "due_soon" }).factors).toEqual([{ label: "SLA due within 12 hours", points: W.slaDueSoon }]);
    expect(score({ dueAt: at(13) }).score).toBe(0);
    expect(score({ dueAt: at(-5), sla: "not_applicable", status: "changes_requested" }).score).toBe(0);
  });

  it("adds a little for expedited requests", () => {
    expect(score({ priority: "expedited" }).factors).toEqual([{ label: "Expedited request", points: W.expedited }]);
  });

  it("scores launch dates by how close or late they are", () => {
    expect(score({ launchDate: day("2026-10-27") }).factors).toEqual([{ label: "Launch date passed, not yet approved", points: W.launchPassed }]);
    // Launching today has not passed yet: it is imminent.
    expect(score({ launchDate: day("2026-10-28") }).score).toBe(W.launchWithin48h);
    expect(score({ launchDate: day("2026-10-30") }).score).toBe(W.launchWithin48h);
    expect(score({ launchDate: day("2026-11-01") }).score).toBe(W.launchWithin7d);
    expect(score({ launchDate: day("2026-11-10") }).score).toBe(0);
    expect(score({ launchDate: day("2026-10-01"), status: "approved", sla: "not_applicable" }).score).toBe(0);
  });

  it("adds partner standing", () => {
    expect(score({ partnerStanding: "high_risk" }).score).toBe(W.partnerHighRisk);
    expect(score({ partnerStanding: "watch" }).score).toBe(W.partnerWatch);
    expect(score({ partnerStanding: "good" }).score).toBe(0);
  });

  it("adds product risk", () => {
    expect(score({ product: "mortgage_prequal" }).score).toBe(W.productMortgage);
    expect(score({ product: "credit_card" }).score).toBe(W.productCreditCard);
  });

  it("uses whole days of waiting as a capped tie-breaker", () => {
    expect(score({ submittedAt: at(-23) }).score).toBe(0);
    expect(score({ submittedAt: at(-49) }).factors).toEqual([{ label: "Waiting 2 days", points: 2 }]);
    expect(score({ submittedAt: at(-24 * 10) }).score).toBe(W.ageMax);
  });

  it("sums every factor and the lines add up to the score", () => {
    const r = score({
      openFindings: 2, highOpenFindings: 1, dueAt: at(-2), sla: "overdue", priority: "expedited",
      launchDate: day("2026-10-29"), partnerStanding: "high_risk", product: "mortgage_prequal", submittedAt: at(-30),
    });
    expect(r.factors).toHaveLength(8);
    expect(r.score).toBe(5 + 2 + 6 + 2 + 5 + 3 + 2 + 1);
    expect(r.factors.reduce((s, f) => s + f.points, 0)).toBe(r.score);
  });
});

const summary = (id: number, over: Partial<SubmissionSummary> = {}): SubmissionSummary => ({
  id, code: `CP-${id}`, title: `Item ${id}`, product: "personal_loan", channel: "email", status: "submitted", priority: "standard",
  riskLevel: "low", riskScore: 0, currentVersion: 1, openFindings: 0, highOpenFindings: 0, submitterName: "A", partnerId: null,
  partnerName: null, assigneeId: null, assigneeName: null, submittedAt: at(-1), updatedAt: at(-1), dueAt: at(30), decidedAt: null,
  launchDate: null, parentId: null, sla: "on_track", ...over,
});

describe("ordering", () => {
  it("sorts by score, then earlier due date, then id", () => {
    const rows = [
      summary(1),
      summary(2, { openFindings: 1, highOpenFindings: 1 }),
      summary(3, { dueAt: at(20) }),
      summary(4, { dueAt: null, sla: "not_applicable" }),
      summary(5, { openFindings: 1, highOpenFindings: 1, dueAt: at(14) }),
      summary(6, { dueAt: at(20) }),
    ];
    const out = prioritize(rows, new Map(), "priority", NOW);
    expect(out.map((r) => r.id)).toEqual([5, 2, 3, 6, 1, 4]);
    expect(out.every((r) => r.priorityScore)).toBe(true);
  });

  it("keeps the incoming deadline order when asked to, still attaching scores", () => {
    const rows = [summary(1), summary(2, { openFindings: 4, highOpenFindings: 4 })];
    const out = prioritize(rows, new Map(), "deadline", NOW);
    expect(out.map((r) => r.id)).toEqual([1, 2]);
    expect(out[1].priorityScore?.score).toBe(20);
  });

  it("applies the partner's standing", () => {
    const out = prioritize([summary(1, { partnerId: 7 }), summary(2)], new Map([[7, "high_risk" as const]]), "priority", NOW);
    expect(out[0].id).toBe(1);
    expect(out[0].priorityScore?.factors).toEqual([{ label: "Partner on high-risk standing", points: 3 }]);
  });

  it("compares a missing score as zero", () => {
    expect(comparePriority({ id: 1, dueAt: null }, { id: 2, dueAt: null })).toBeLessThan(0);
  });
});

describe("partnerStandings", () => {
  const rows = (pid: number, approved: number, rejected: number, other = 0) => [
    ...Array.from({ length: approved }, () => ({ partnerId: pid, status: "approved" })),
    ...Array.from({ length: rejected }, () => ({ partnerId: pid, status: "rejected" })),
    ...Array.from({ length: other }, () => ({ partnerId: pid, status: "in_review" })),
  ];
  it("matches the dashboard thresholds and needs three decided", () => {
    const m = partnerStandings([...rows(1, 2, 1), ...rows(2, 5, 1), ...rows(3, 9, 1), ...rows(4, 0, 2, 5), { partnerId: null, status: "rejected" }]);
    expect(m.get(1)).toBe("high_risk"); // 33%
    expect(m.get(2)).toBe("watch"); // 17%
    expect(m.get(3)).toBe("good"); // 10%
    expect(m.get(4)).toBe("good"); // only 2 decided
  });
});
