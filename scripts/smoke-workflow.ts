// End-to-end check of the review lifecycle against the real database. Makes at most two live model
// calls, then deletes the submission it created. Usage: npx tsx scripts/smoke-workflow.ts
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};
async function expectError(name: string, code: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    check(name, false, "no error thrown");
  } catch (e) {
    const got = (e as { code?: string }).code;
    check(name, got === code, `${got ?? "unexpected"}: ${(e as Error).message.slice(0, 80)}`);
  }
}

async function main() {
  const { eq } = await import("drizzle-orm");
  const { db, tables } = await import("../lib/db");
  const svc = await import("../lib/workflow/service");
  const q = await import("../lib/workflow/queries");
  const { EXAMPLE_ASSETS } = await import("../lib/seed/examples");
  const { PRODUCT_FACTS } = await import("../lib/seed/product-facts");

  const users = await db.select().from(tables.users);
  const actorOf = (email: string) => {
    const u = users.find((x) => x.email.startsWith(email));
    if (!u) throw new Error(`demo user ${email} missing; run the seed scripts`);
    return { id: u.id, name: u.name, role: u.role, partnerId: u.partnerId };
  };
  const jordan = actorOf("jordan.ellis");
  const maya = actorOf("maya.chen");
  const priya = actorOf("priya.raman");
  const sofia = actorOf("sofia.alvarez");
  const otherAffiliate = users.find((u) => u.role === "affiliate" && u.partnerId !== jordan.partnerId)!;
  const amara = { id: otherAffiliate.id, name: otherAffiliate.name, role: otherAffiliate.role, partnerId: otherAffiliate.partnerId };

  const example = EXAMPLE_ASSETS.find((e) => e.id === "risky-affiliate-blog")!;
  let createdId: number | null = null;
  try {
    // 1. Affiliate submits the risky example
    const { id, code } = await svc.createSubmission(jordan, {
      title: "Smoke test: risky affiliate blog", product: example.product, channel: example.channel,
      states: example.states, content: example.content, priority: "standard",
    });
    createdId = id;
    let d = await q.getDetail(jordan, id);
    const v1 = d.versions[0];
    check("create: submission is awaiting review", d.status === "submitted", code);
    check("create: findings recorded with real quotes", v1.findings.length >= 4 && v1.findings.every((f) => f.start === null || v1.content.slice(f.start, f.end!) === f.quote), `${v1.findings.length} findings`);
    check("create: due date set ~72h out", !!d.dueAt && Math.abs(d.dueAt.getTime() - Date.now() - 72 * 3_600_000) < 120_000);
    check("create: audit has created + analysis", d.audit.map((a) => a.action).join() === "submission.created,analysis.completed");

    // 2. Access control
    await expectError("access: marketer cannot see an affiliate's submission", "not_found", () => q.getDetail(maya, id));
    await expectError("access: other partner's affiliate cannot see it", "not_found", () => q.getDetail(amara, id));
    await expectError("access: submitter cannot claim", "forbidden", () => svc.claim(jordan, id));
    await expectError("access: reviewer cannot submit", "forbidden", () => svc.createSubmission(priya, { title: "x y z", product: "personal_loan", channel: "email", states: [], content: "x".repeat(40), priority: "standard" }));
    await expectError("access: only lead edits rules", "forbidden", () => svc.updateRule(priya, "UDAAP-GUARANTEE", { enabled: true }));
    await expectError("access: queue is staff only", "forbidden", () => q.listQueue(jordan));

    // 3. Reviewer works the findings
    const high = v1.findings.filter((f) => f.severity === "high");
    const other = v1.findings.find((f) => f.severity !== "high") ?? high[1];
    await expectError("approve is blocked while high findings are open", "conflict", () => svc.decide(priya, id, { outcome: "approved" }));
    await expectError("dismiss needs a reason", "invalid", () => svc.actOnFinding(priya, other.id, { action: "dismiss", reason: " " }));
    await svc.actOnFinding(priya, high[0].id, { action: "accept" });
    d = await q.getDetail(priya, id);
    check("reviewing a finding claims the submission", d.status === "in_review" && d.assigneeId === priya.id);
    await svc.actOnFinding(priya, other.id, { action: "dismiss", reason: "Smoke test: judged acceptable" });
    await svc.addReviewerFinding(priya, id, { ruleCode: "UDAAP-SUPERLATIVE", quote: example.content.slice(10, 40), issue: "Reviewer-added test finding." });
    const { feedbackDraft } = await svc.decide(priya, id, { outcome: "changes_requested", note: "Please fix the flagged claims and add the required disclosures." });
    check("changes requested: feedback email drafted from accepted findings", !!feedbackDraft && feedbackDraft.includes("Required changes") && feedbackDraft.includes(high[0].quote.slice(0, 20)));
    d = await q.getDetail(jordan, id);
    check("status is changes_requested and submitter may resubmit", d.status === "changes_requested" && d.permissions.canResubmit);
    await expectError("reviewer cannot act after the decision", "conflict", () => svc.actOnFinding(priya, high[0].id, { action: "reopen" }));

    // 4. Submitter fixes and resubmits
    const snip = (id2: string) => PRODUCT_FACTS.find((f) => f.product === "personal_loan")!.approvedSnippets.find((s) => s.id === id2)?.text ?? "";
    const fixed = [
      snip("affiliate_disclosure") || "Disclosure: we earn a commission if you apply through links on this page.",
      "",
      "Thinking about consolidating high-interest debt? ClearPath Personal Loans may help you simplify your payments.",
      "",
      snip("apr_disclosure"),
      snip("representative_example"),
      snip("soft_pull_notice"),
      "Terms apply.",
    ].filter((x) => x !== undefined).join("\n");
    await expectError("resubmit: identical text is rejected", "invalid", () => svc.resubmit(jordan, id, { content: v1.content }));
    await expectError("resubmit: only the owning side may resubmit", "forbidden", () => svc.resubmit(amara, id, { content: fixed }));
    const res = await svc.resubmit(jordan, id, { content: fixed });
    d = await q.getDetail(jordan, id);
    const v2 = d.versions[1];
    check("resubmit: version 2 created and back with compliance", d.currentVersion === 2 && d.status === "submitted" && res.versionNumber === 2);
    check("resubmit: earlier findings auto-resolved", res.resolved >= 2, `${res.resolved} resolved`);
    check("resubmit: 24h re-review clock", !!d.dueAt && Math.abs(d.dueAt.getTime() - Date.now() - 24 * 3_600_000) < 120_000);
    check("resubmit: v1 findings marked resolved", d.versions[0].findings.filter((f) => f.status === "resolved").length === res.resolved);
    check("resubmit: same reviewer still assigned", d.assigneeId === priya.id);

    // 5. Reviewer clears whatever remains and approves
    for (const f of v2.findings.filter((x) => x.status === "open")) {
      await svc.actOnFinding(priya, f.id, { action: "dismiss", reason: "Smoke test: remaining flag judged acceptable" });
    }
    // every v2 finding is dismissed now, so nothing is accepted and no note is given
    await expectError("request changes needs an accepted finding or a note", "invalid", () => svc.decide(priya, id, { outcome: "changes_requested" }));
    await expectError("rejection needs a note", "invalid", () => svc.decide(priya, id, { outcome: "rejected" }));
    await svc.decide(priya, id, { outcome: "approved", note: "Smoke test approval." });
    d = await q.getDetail(sofia, id);
    check("approved: status, decidedAt and two decisions recorded", d.status === "approved" && !!d.decidedAt && d.decisions.length === 2);
    const actions = d.audit.map((a) => a.action);
    check("audit trail covers the whole lifecycle", ["submission.created", "submission.claimed", "finding.accepted", "finding.dismissed", "finding.added", "decision.changes_requested", "submission.resubmitted", "finding.resolved", "decision.approved"].every((a) => actions.includes(a)), `${actions.length} events`);
    check("audit timestamps never go backwards", d.audit.every((a, i) => i === 0 || a.createdAt >= d.audit[i - 1].createdAt));
    await expectError("closed submissions cannot be withdrawn", "conflict", () => svc.withdraw(jordan, id));

    // 6. Dashboard and queue include real data without throwing
    const stats = await q.dashboardStats(sofia);
    check("dashboard computes", stats.partners.length > 0 && stats.weekly.length === 8, `${stats.queue.open} open, ${stats.kpis.decisionsLast30Days} decisions/30d`);
    const queue = await q.listQueue(priya);
    check("queue is sorted overdue-first", queue.every((s, i) => i === 0 || ["overdue", "due_soon", "on_track", "not_applicable"].indexOf(queue[i - 1].sla) <= ["overdue", "due_soon", "on_track", "not_applicable"].indexOf(s.sla)));
  } finally {
    if (createdId !== null) {
      await db.delete(tables.submissions).where(eq(tables.submissions.id, createdId));
      console.log(`cleaned up test submission ${createdId}`);
    }
  }
  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack : e);
  process.exit(1);
});
