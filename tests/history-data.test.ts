import { createHash } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { buildHistoryPlan, defaultPeopleIds, type HistoryPlan } from "@/lib/seed/history";
import { PARTNERS, PARTNER_PROFILE, USERS } from "@/lib/seed/people";
import { AUDIT } from "@/lib/workflow/audit-actions";
import { computeDueAt, slaState } from "@/lib/workflow/flow";

// A Wednesday afternoon (UTC), so the live queue is easy to reason about.
const NOW = new Date("2026-10-28T16:00:00Z");
const ids = defaultPeopleIds();
const userName = (id: number) => USERS.find((u) => ids.users[u.email] === id)?.name;
const partnerIdByName = (name: string) => ids.partners[name];

let plan: HistoryPlan;
beforeAll(async () => {
  plan = await buildHistoryPlan(NOW);
}, 60_000);

const versionsOf = (subId: number) => plan.versions.filter((v) => v.submissionId === subId).sort((a, b) => a.number - b.number);
const findingsOf = (versionId: number) => plan.findings.filter((f) => f.versionId === versionId);
const decisionsOf = (subId: number) => plan.decisions.filter((d) => d.submissionId === subId);
const count = (status: string) => plan.submissions.filter((s) => s.status === status).length;

describe("history plan: shape", () => {
  it("has roughly the volume and status mix of an 8-week history", () => {
    const n = plan.submissions.length;
    expect(n).toBeGreaterThanOrEqual(38);
    expect(n).toBeLessThanOrEqual(42);
    expect(plan.versions.length).toBeGreaterThanOrEqual(44);
    expect(plan.findings.length).toBeGreaterThanOrEqual(80);
    expect(plan.decisions.length).toBeGreaterThanOrEqual(30);
    expect(plan.auditEvents.length).toBeGreaterThanOrEqual(250);

    const share = (s: string) => count(s) / n;
    expect(share("approved")).toBeGreaterThan(0.38);
    expect(share("approved")).toBeLessThan(0.52);
    expect(share("rejected")).toBeGreaterThan(0.08);
    expect(share("rejected")).toBeLessThan(0.18);
    expect(share("changes_requested")).toBeGreaterThan(0.08);
    expect(share("changes_requested")).toBeLessThan(0.18);
    expect(share("in_review")).toBeGreaterThan(0.04);
    expect(share("in_review")).toBeLessThan(0.12);
    expect(share("submitted")).toBeGreaterThan(0.1);
    expect(share("submitted")).toBeLessThan(0.22);
    expect(share("withdrawn")).toBeGreaterThan(0.02);
    expect(share("withdrawn")).toBeLessThan(0.09);
  });

  it("covers every product and channel, and Maya Chen has about ten submissions", () => {
    expect(new Set(plan.submissions.map((s) => s.product))).toEqual(new Set(["personal_loan", "credit_card", "mortgage_prequal"]));
    expect(new Set(plan.submissions.map((s) => s.channel))).toEqual(new Set(["email", "social", "display", "affiliate_page", "sms"]));
    const maya = ids.users["maya.chen@clearpath-demo.example"];
    const mine = plan.submissions.filter((s) => s.submitterId === maya);
    expect(mine.length).toBeGreaterThanOrEqual(9);
    expect(mine.length).toBeLessThanOrEqual(11);
    expect(new Set(mine.map((s) => s.channel)).size).toBeGreaterThanOrEqual(4);
    expect(mine.every((s) => s.partnerId === null)).toBe(true);
  });

  it("uses unique ids and codes, with codes increasing in submission order", () => {
    for (const rows of [plan.submissions, plan.versions, plan.findings, plan.decisions, plan.auditEvents]) {
      const idList = rows.map((r) => r.id);
      expect(new Set(idList).size).toBe(idList.length);
      expect(idList.every((id) => Number.isInteger(id) && id > 0)).toBe(true);
    }
    const codes = plan.submissions.map((s) => s.code);
    expect(new Set(codes).size).toBe(codes.length);
    const byCode = [...plan.submissions].sort((a, b) => a.code.localeCompare(b.code));
    expect(byCode[0].code).toBe("CP-1001");
    for (let i = 1; i < byCode.length; i++) {
      expect(byCode[i].submittedAt.getTime()).toBeGreaterThanOrEqual(byCode[i - 1].submittedAt.getTime());
    }
  });

  it("resolves every foreign key inside the plan", () => {
    const subIds = new Set(plan.submissions.map((s) => s.id));
    const versionIds = new Set(plan.versions.map((v) => v.id));
    const userIds = new Set(Object.values(ids.users));
    const partnerIds = new Set(Object.values(ids.partners));
    for (const s of plan.submissions) {
      expect(userIds.has(s.submitterId)).toBe(true);
      if (s.partnerId !== null) expect(partnerIds.has(s.partnerId)).toBe(true);
      if (s.assigneeId !== null) expect(userIds.has(s.assigneeId)).toBe(true);
    }
    for (const v of plan.versions) {
      expect(subIds.has(v.submissionId)).toBe(true);
      expect(userIds.has(v.createdBy)).toBe(true);
    }
    for (const f of plan.findings) {
      expect(versionIds.has(f.versionId)).toBe(true);
      if (f.actedBy !== null) expect(userIds.has(f.actedBy)).toBe(true);
    }
    for (const d of plan.decisions) {
      expect(subIds.has(d.submissionId)).toBe(true);
      expect(versionIds.has(d.versionId)).toBe(true);
      expect(userIds.has(d.reviewerId)).toBe(true);
      expect(plan.versions.find((v) => v.id === d.versionId)!.submissionId).toBe(d.submissionId);
    }
    for (const e of plan.auditEvents) {
      expect(subIds.has(e.submissionId)).toBe(true);
      if (e.actorId !== null) expect(userIds.has(e.actorId)).toBe(true);
    }
  });

  it("numbers versions contiguously and keeps current_version, hashes and due dates consistent", () => {
    for (const s of plan.submissions) {
      const vs = versionsOf(s.id);
      expect(vs.map((v) => v.number)).toEqual(vs.map((_, i) => i + 1));
      expect(s.currentVersion).toBe(vs.length);
      expect(s.submittedAt.getTime()).toBe(vs[0].createdAt.getTime());
      const last = vs[vs.length - 1];
      expect(s.dueAt?.getTime()).toBe(computeDueAt(last.createdAt, s.priority, vs.length > 1).getTime());
      for (const v of vs) {
        expect(v.contentHash).toBe(createHash("sha256").update(v.content).digest("hex"));
        expect(v.model === null).toBe(v.analysisStatus === "rules_only");
        expect(v.analysisSummary.length).toBeGreaterThan(10);
        expect(v.createdBy).toBe(s.submitterId);
      }
    }
  });

  it("sets decidedAt, assignee and priority reasons consistently with status", () => {
    for (const s of plan.submissions) {
      const decided = s.status === "approved" || s.status === "rejected";
      expect(s.decidedAt !== null).toBe(decided);
      if (s.status === "submitted") expect(s.assigneeId).toBeNull();
      if (s.status === "in_review") expect(s.assigneeId).not.toBeNull();
      if (s.priority === "expedited") expect(s.priorityReason).toBeTruthy();
      expect(s.updatedAt.getTime()).toBeLessThan(NOW.getTime());
      expect(s.updatedAt.getTime()).toBeGreaterThanOrEqual(s.submittedAt.getTime());
    }
  });

  it("concentrates historical submissions on weekday daytime", () => {
    const settled = plan.submissions.filter((s) => s.status !== "submitted");
    const ok = settled.filter((s) => {
      const d = s.submittedAt.getUTCDay();
      const h = s.submittedAt.getUTCHours();
      return d >= 1 && d <= 5 && h >= 13 && h < 22;
    });
    expect(ok.length / settled.length).toBeGreaterThan(0.95);
  });
});

describe("history plan: findings", () => {
  it("fills a dismiss reason for every dismissed finding and for no other", () => {
    for (const f of plan.findings) {
      if (f.status === "dismissed") expect((f.dismissReason ?? "").length).toBeGreaterThan(10);
      else expect(f.dismissReason).toBeNull();
    }
  });

  it("anchors every located quote to the version content", () => {
    for (const f of plan.findings) {
      const v = plan.versions.find((x) => x.id === f.versionId)!;
      if (f.startOffset !== null && f.endOffset !== null) expect(v.content.slice(f.startOffset, f.endOffset)).toBe(f.quote);
      else expect(f.endOffset).toBeNull();
      expect(f.issue.length).toBeGreaterThan(10);
    }
  });

  it("uses all three sources and low/medium/high confidence for model findings", () => {
    expect(new Set(plan.findings.map((f) => f.source))).toEqual(new Set(["rule", "ai", "reviewer"]));
    const ai = plan.findings.filter((f) => f.source === "ai");
    expect(ai.length).toBeGreaterThanOrEqual(15);
    expect(new Set(ai.map((f) => f.confidence))).toEqual(new Set(["low", "medium", "high"]));
    expect(ai.every((f) => f.suggestion)).toBe(true);
    for (const v of plan.versions) {
      expect(v.analysisStatus).toBe("complete"); // the demo story: the model reviewed every version
    }
  });

  it("never leaves an approved version with open or accepted findings", () => {
    const approved = plan.decisions.filter((d) => d.outcome === "approved");
    expect(approved.length).toBeGreaterThanOrEqual(15);
    for (const d of approved) {
      for (const f of findingsOf(d.versionId)) {
        expect(["dismissed", "resolved"]).toContain(f.status);
        expect(f.severity === "high" && (f.status === "open" || f.status === "accepted")).toBe(false);
      }
    }
  });

  it("gives decided versions at least one accepted finding when they asked for changes or rejected", () => {
    for (const d of plan.decisions.filter((x) => x.outcome !== "approved")) {
      const fs = findingsOf(d.versionId);
      expect(fs.filter((f) => f.status === "accepted" || f.status === "resolved").length).toBeGreaterThan(0);
    }
  });

  it("keeps submitted assets fully open and in-review assets partly worked", () => {
    for (const s of plan.submissions.filter((x) => x.status === "submitted")) {
      const last = versionsOf(s.id).at(-1)!;
      expect(findingsOf(last.id).every((f) => f.status === "open")).toBe(true);
    }
    for (const s of plan.submissions.filter((x) => x.status === "in_review")) {
      const fs = findingsOf(versionsOf(s.id).at(-1)!.id);
      expect(fs.some((f) => f.status === "open")).toBe(true);
      expect(fs.some((f) => f.status === "accepted" || f.status === "dismissed")).toBe(true);
    }
  });

  it("stamps acted findings with a reviewer and a time, and resolved ones with a time only", () => {
    const reviewers = new Set(USERS.filter((u) => u.role === "reviewer").map((u) => ids.users[u.email]));
    for (const f of plan.findings) {
      if (f.status === "accepted" || f.status === "dismissed") {
        expect(reviewers.has(f.actedBy!)).toBe(true);
        expect(f.actedAt).not.toBeNull();
      } else if (f.status === "resolved") {
        expect(f.actedBy).toBeNull();
        expect(f.actedAt).not.toBeNull();
      } else {
        expect(f.actedBy).toBeNull();
        expect(f.actedAt).toBeNull();
      }
    }
  });
});

describe("history plan: live queue", () => {
  const live = () => plan.submissions.filter((s) => s.status === "submitted" || s.status === "in_review");
  const states = () => live().map((s) => slaState(s.status, s.dueAt, NOW));

  it("has overdue, due-soon and on-track work", () => {
    expect(states().filter((x) => x === "overdue").length).toBeGreaterThanOrEqual(2);
    expect(states().filter((x) => x === "due_soon").length).toBeGreaterThanOrEqual(2);
    expect(states().filter((x) => x === "on_track").length).toBeGreaterThanOrEqual(3);
    for (const s of live().filter((x) => slaState(x.status, x.dueAt, NOW) === "due_soon")) {
      expect(s.dueAt!.getTime() - NOW.getTime()).toBeLessThanOrEqual(12 * 3_600_000);
    }
  });

  it("includes at least two expedited submissions waiting on compliance", () => {
    const exp = live().filter((s) => s.priority === "expedited");
    expect(exp.length).toBeGreaterThanOrEqual(2);
    expect(exp.every((s) => s.priorityReason)).toBe(true);
  });

  it("restarts the clock on a resubmitted version that is back in the queue", () => {
    const resub = plan.submissions.find((s) => s.status === "submitted" && s.currentVersion > 1);
    expect(resub).toBeDefined();
    const last = versionsOf(resub!.id).at(-1)!;
    expect(resub!.dueAt!.getTime() - last.createdAt.getTime()).toBe(24 * 3_600_000);
  });
});

describe("history plan: hero stories", () => {
  const priya = ids.users["priya.raman@clearpath-demo.example"];

  it("has a two-version asset: Priya requests changes on v1, then approves v2 with nothing left open", () => {
    const hero = plan.submissions.find((s) => {
      const ds = decisionsOf(s.id);
      return (
        s.status === "approved" &&
        s.currentVersion === 2 &&
        ds.length === 2 &&
        ds[0].outcome === "changes_requested" &&
        ds[1].outcome === "approved" &&
        ds.every((d) => d.reviewerId === priya)
      );
    });
    expect(hero).toBeDefined();
    const [v1, v2] = versionsOf(hero!.id);
    expect(v1.content).not.toBe(v2.content);
    const f1 = findingsOf(v1.id);
    expect(f1.length).toBeGreaterThanOrEqual(3);
    expect(f1.every((f) => f.status === "resolved")).toBe(true);
    expect(findingsOf(v2.id).filter((f) => f.status === "open" || f.status === "accepted")).toHaveLength(0);
    expect(decisionsOf(hero!.id)[0].note).toBeTruthy();
  });

  it("has a clean in-house campaign approved on the first pass with no findings", () => {
    const maya = ids.users["maya.chen@clearpath-demo.example"];
    const clean = plan.submissions.filter((s) => {
      const vs = versionsOf(s.id);
      return s.submitterId === maya && s.status === "approved" && vs.length === 1 && findingsOf(vs[0].id).length === 0;
    });
    expect(clean.length).toBeGreaterThanOrEqual(3);
  });

  it("has a rejected asset from the bad-record partner with a reviewer note", () => {
    const bad = partnerIdByName("RateRover");
    const rejected = plan.submissions.filter((s) => s.partnerId === bad && s.status === "rejected");
    expect(rejected.length).toBeGreaterThanOrEqual(2);
    for (const s of rejected) {
      const d = decisionsOf(s.id).at(-1)!;
      expect(d.outcome).toBe("rejected");
      expect((d.note ?? "").length).toBeGreaterThan(60);
    }
  });

  it("has a three-version asset from a mixed partner that was sent back twice", () => {
    const three = plan.submissions.find((s) => s.currentVersion === 3);
    expect(three).toBeDefined();
    const partner = PARTNERS.find((p) => ids.partners[p.name] === three!.partnerId)!;
    expect(PARTNER_PROFILE[partner.name]).toBe("mixed");
    expect(decisionsOf(three!.id).map((d) => d.outcome)).toEqual(["changes_requested", "changes_requested", "approved"]);
    expect(new Set(versionsOf(three!.id).map((v) => v.content)).size).toBe(3);
  });

  it("has a finding dismissed as a quoted warning rather than a claim", () => {
    const f = plan.findings.find((x) => x.status === "dismissed" && /consumer warning, not a claim/i.test(x.dismissReason ?? ""));
    expect(f).toBeDefined();
    expect(f!.ruleCode).toBe("UDAAP-GUARANTEE");
  });
});

describe("history plan: partners and risk", () => {
  const rate = (name: string) => {
    const mine = plan.submissions.filter((s) => s.partnerId === partnerIdByName(name));
    return { total: mine.length, rate: mine.filter((s) => s.status === "rejected").length / mine.length };
  };

  it("gives RateRover a rejection rate above 30% and Cardwell Reviews none", () => {
    const bad = rate("RateRover");
    expect(bad.total).toBeGreaterThanOrEqual(7);
    expect(bad.total).toBeLessThanOrEqual(9);
    expect(bad.rate).toBeGreaterThan(0.3);
    const clean = rate("Cardwell Reviews");
    expect(clean.total).toBeGreaterThanOrEqual(4);
    expect(clean.rate).toBe(0);
  });

  it("keeps Cardwell Reviews almost entirely first-pass approvals with at most one low finding", () => {
    const decided = plan.submissions.filter((s) => s.partnerId === partnerIdByName("Cardwell Reviews") && s.status === "approved");
    expect(decided.length).toBeGreaterThanOrEqual(4);
    for (const s of decided) {
      expect(s.currentVersion).toBe(1);
      const fs = findingsOf(versionsOf(s.id)[0].id);
      expect(fs.length).toBeLessThanOrEqual(1);
      expect(fs.every((f) => f.severity === "low")).toBe(true);
    }
  });

  it("shows the violation themes for the bad-record partner", () => {
    const bad = plan.submissions.filter((s) => s.partnerId === partnerIdByName("RateRover")).map((s) => s.id);
    const codes = new Set(
      plan.findings.filter((f) => bad.includes(plan.versions.find((v) => v.id === f.versionId)!.submissionId)).map((f) => f.ruleCode),
    );
    for (const c of ["UDAAP-GUARANTEE", "REGZ-24-APR", "FTC-AFFILIATE", "REGZ-24-AVAIL"]) expect(codes.has(c)).toBe(true);
  });

  it("scores risky assets higher than clean ones", () => {
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const rejected = plan.submissions.filter((s) => s.status === "rejected").map((s) => s.riskScore);
    const approved = plan.submissions.filter((s) => s.status === "approved").map((s) => s.riskScore);
    expect(avg(rejected)).toBeGreaterThan(avg(approved) + 5);
    expect(plan.submissions.some((s) => s.riskLevel === "high")).toBe(true);
    expect(plan.submissions.some((s) => s.riskLevel === "low")).toBe(true);
    for (const s of plan.submissions) {
      expect(s.riskLevel).toBe(s.riskScore >= 10 ? "high" : s.riskScore >= 5 ? "medium" : "low");
    }
  });
});

describe("history plan: decisions", () => {
  it("writes specific notes and a polite feedback email for every non-approval", () => {
    for (const d of plan.decisions.filter((x) => x.outcome !== "approved")) {
      expect((d.note ?? "").length).toBeGreaterThan(40);
      const lines = (d.feedbackDraft ?? "").split("\n").filter((l) => l.trim());
      expect(lines.length).toBeGreaterThanOrEqual(4);
      expect(lines.length).toBeLessThanOrEqual(8);
      const reviewer = userName(d.reviewerId)!;
      expect(lines.at(-1)).toBe(reviewer.split(" ")[0]);
      expect(lines[0]).toMatch(/^Hi \w+,$/);
    }
    for (const d of plan.decisions.filter((x) => x.outcome === "approved")) expect(d.feedbackDraft).toBeNull();
  });

  it("alternates between Priya Raman and Daniel Okafor", () => {
    const names = plan.decisions.map((d) => userName(d.reviewerId));
    expect(new Set(names)).toEqual(new Set(["Priya Raman", "Daniel Okafor"]));
    const priya = names.filter((n) => n === "Priya Raman").length;
    expect(priya / names.length).toBeGreaterThan(0.3);
    expect(priya / names.length).toBeLessThan(0.7);
  });

  it("has one decision per reviewed version and varied, realistic first-pass turnaround", () => {
    const perVersion = new Set(plan.decisions.map((d) => d.versionId));
    expect(perVersion.size).toBe(plan.decisions.length);
    const hours: number[] = [];
    for (const d of plan.decisions) {
      const v = plan.versions.find((x) => x.id === d.versionId)!;
      expect(d.createdAt.getTime()).toBeGreaterThan(v.createdAt.getTime());
      if (v.number === 1) hours.push((d.createdAt.getTime() - v.createdAt.getTime()) / 3_600_000);
    }
    hours.sort((a, b) => a - b);
    const median = hours[Math.floor(hours.length / 2)];
    expect(median).toBeGreaterThan(24);
    expect(median).toBeLessThan(56);
    expect(hours.at(-1)!).toBeGreaterThan(96);
    expect(hours[0]).toBeLessThan(24);
    // Re-reviews are quicker than first reviews.
    const re = plan.decisions
      .filter((d) => plan.versions.find((x) => x.id === d.versionId)!.number > 1)
      .map((d) => d.createdAt.getTime() - plan.versions.find((x) => x.id === d.versionId)!.createdAt.getTime())
      .sort((a, b) => a - b);
    expect(re[Math.floor(re.length / 2)] / 3_600_000).toBeLessThan(median);
  });
});

describe("history plan: audit trail", () => {
  const known = new Set<string>(Object.values(AUDIT));

  it("uses only known actions with strictly increasing timestamps per submission", () => {
    for (const s of plan.submissions) {
      const evs = plan.auditEvents.filter((e) => e.submissionId === s.id);
      expect(evs.length).toBeGreaterThanOrEqual(2);
      expect(evs[0].action).toBe(AUDIT.created);
      expect(evs[0].createdAt.getTime()).toBe(s.submittedAt.getTime());
      for (let i = 0; i < evs.length; i++) {
        expect(known.has(evs[i].action)).toBe(true);
        expect(evs[i].createdAt.getTime()).toBeLessThan(NOW.getTime());
        if (i > 0) {
          expect(evs[i].createdAt.getTime()).toBeGreaterThan(evs[i - 1].createdAt.getTime());
          expect(evs[i].id).toBeGreaterThan(evs[i - 1].id);
        }
      }
      expect(evs.at(-1)!.createdAt.getTime()).toBe(s.updatedAt.getTime());
    }
  });

  it("logs the automated check without an actor and human actions with one", () => {
    for (const e of plan.auditEvents) {
      if (e.action === AUDIT.analysisCompleted || e.action === AUDIT.findingResolved) expect(e.actorId).toBeNull();
      else expect(e.actorId).not.toBeNull();
      expect(typeof e.details).toBe("object");
    }
  });

  it("records a coherent lifecycle for each submission", () => {
    for (const s of plan.submissions) {
      const actions = plan.auditEvents.filter((e) => e.submissionId === s.id).map((e) => e.action);
      const count = (a: string) => actions.filter((x) => x === a).length;
      expect(count(AUDIT.created)).toBe(1);
      expect(count(AUDIT.analysisCompleted)).toBe(s.currentVersion);
      expect(count(AUDIT.resubmitted)).toBe(s.currentVersion - 1);
      const decisions = decisionsOf(s.id);
      expect(count(AUDIT.approved)).toBe(decisions.filter((d) => d.outcome === "approved").length);
      expect(count(AUDIT.rejected)).toBe(decisions.filter((d) => d.outcome === "rejected").length);
      expect(count(AUDIT.changesRequested)).toBe(decisions.filter((d) => d.outcome === "changes_requested").length);
      expect(count(AUDIT.withdrawn)).toBe(s.status === "withdrawn" ? 1 : 0);
      if (s.status === "submitted") expect(count(AUDIT.claimed)).toBe(s.currentVersion - 1);
      const fs = versionsOf(s.id).flatMap((v) => findingsOf(v.id));
      expect(count(AUDIT.findingResolved)).toBe(fs.filter((f) => f.status === "resolved").length);
      expect(count(AUDIT.findingAdded)).toBe(fs.filter((f) => f.source === "reviewer").length);
    }
  });

  it("references real findings and decisions in event details", () => {
    const findingIds = new Set(plan.findings.map((f) => f.id));
    const decisionIds = new Set(plan.decisions.map((d) => d.id));
    for (const e of plan.auditEvents) {
      const d = e.details as { findingId?: number; decisionId?: number; reason?: string };
      if (d.findingId !== undefined) expect(findingIds.has(d.findingId)).toBe(true);
      if (e.action === AUDIT.findingDismissed) expect((d.reason ?? "").length).toBeGreaterThan(10);
      if ([AUDIT.approved, AUDIT.rejected, AUDIT.changesRequested].includes(e.action as never)) expect(decisionIds.has(d.decisionId!)).toBe(true);
    }
  });
});

describe("history plan: determinism and robustness", () => {
  it("returns identical plans for the same now", async () => {
    const again = await buildHistoryPlan(NOW);
    expect(again).toEqual(plan);
  }, 60_000);

  it("shifts every timestamp with now but keeps the same content", async () => {
    const later = new Date(NOW.getTime() + 7 * 24 * 3_600_000);
    const shifted = await buildHistoryPlan(later);
    expect(shifted.submissions.map((s) => s.title)).toEqual(plan.submissions.map((s) => s.title));
    expect(shifted.versions.map((v) => v.contentHash)).toEqual(plan.versions.map((v) => v.contentHash));
    expect(shifted.submissions.map((s) => s.status)).toEqual(plan.submissions.map((s) => s.status));
    const delta = shifted.submissions[0].submittedAt.getTime() - plan.submissions[0].submittedAt.getTime();
    expect(delta).toBe(7 * 24 * 3_600_000);
  }, 60_000);

  it.each([
    ["Monday morning", "2026-11-02T14:05:00Z"],
    ["Friday evening", "2026-10-30T21:40:00Z"],
    ["Sunday", "2026-11-01T12:00:00Z"],
  ])("builds a valid plan on a %s", async (_label, iso) => {
    const now = new Date(iso);
    const p = await buildHistoryPlan(now);
    expect(p.submissions).toHaveLength(plan.submissions.length);
    for (const e of p.auditEvents) expect(e.createdAt.getTime()).toBeLessThan(now.getTime());
    for (const s of p.submissions) expect(s.submittedAt.getTime()).toBeLessThan(now.getTime());
    const states = p.submissions
      .filter((s) => s.status === "submitted" || s.status === "in_review")
      .map((s) => slaState(s.status, s.dueAt, now));
    expect(states.filter((x) => x === "overdue").length).toBeGreaterThanOrEqual(2);
    expect(states.filter((x) => x === "due_soon").length).toBeGreaterThanOrEqual(2);
  }, 60_000);
});
