import { createHash } from "node:crypto";
import { analyzeAsset } from "@/lib/compliance/engine";
import { computeRisk } from "@/lib/compliance/risk";
import { AUDIT } from "@/lib/workflow/audit-actions";
import { computeDueAt } from "@/lib/workflow/flow";
import { PRODUCT_FACTS } from "./product-facts";
import { RULES } from "./rules";

const MASTER_CODE = "CP-1015"; // "Cash Rewards Card welcome offer, email 1", approved on version 2

/** Three campaign variants of an approved email: two differ only in non-regulated text, one changes the intro period. */
const VARIANTS: { title: string; edit: (t: string) => string; hoursAgo: number }[] = [
  { title: "Cash Rewards Card welcome offer, email 1 (returning visitors)", edit: (t) => t.replace("Hi there,", "Welcome back,"), hoursAgo: 5 },
  {
    title: "Cash Rewards Card welcome offer, email 1 (newsletter subscribers)",
    edit: (t) => t.replace("Hi there,", "Hi, and thanks for subscribing,").replace("Why people love it:", "Why cardmembers love it:"),
    hoursAgo: 4,
  },
  {
    title: "Cash Rewards Card welcome offer, email 1 (spring promo)",
    edit: (t) => t.replaceAll("for 15 months", "for 18 months").replace("ends 15 months after", "ends 18 months after"),
    hoursAgo: 3,
  },
];

/**
 * Seeds campaign variants of an approved master so the bulk fast-track flow can be tried. Idempotent:
 * removes earlier variants of the master first. Run after the history seed (it depends on CP-1015).
 */
export async function seedVariantsDemo(now = new Date()): Promise<number> {
  const { and, desc, eq, sql } = await import("drizzle-orm");
  const { db, tables } = await import("@/lib/db");
  const [master] = await db.select().from(tables.submissions).where(eq(tables.submissions.code, MASTER_CODE));
  if (!master || master.status !== "approved") return 0;
  const [approved] = await db
    .select({ content: tables.versions.content })
    .from(tables.decisions)
    .innerJoin(tables.versions, eq(tables.decisions.versionId, tables.versions.id))
    .where(and(eq(tables.decisions.submissionId, master.id), eq(tables.decisions.outcome, "approved")))
    .orderBy(desc(tables.decisions.createdAt))
    .limit(1);
  if (!approved) return 0;

  await db.delete(tables.submissions).where(eq(tables.submissions.parentId, master.id));
  const facts = PRODUCT_FACTS.find((f) => f.product === master.product)!;

  for (const v of VARIANTS) {
    const content = v.edit(approved.content);
    const ctx = { product: master.product, channel: master.channel, states: master.states, content, isAffiliate: false };
    const analysis = await analyzeAsset(ctx, { rules: RULES, facts, skipAi: true });
    const risk = computeRisk(analysis.findings, ctx);
    const res = (await db.execute(
      sql`select nextval(pg_get_serial_sequence('submissions','id')) as sid, nextval(pg_get_serial_sequence('versions','id')) as vid,
                 (select coalesce(max(substring(code from 4)::int), 1000) + 1 from submissions) as n`,
    )) as unknown as { rows?: Record<string, unknown>[] } & Record<string, unknown>[];
    const row = (res.rows ?? res)[0];
    const sid = Number(row.sid);
    const vid = Number(row.vid);
    const at = new Date(now.getTime() - v.hoursAgo * 3_600_000);
    await db.batch([
      db.insert(tables.submissions).values({
        id: sid, code: `CP-${Number(row.n)}`, title: v.title, product: master.product, channel: master.channel, states: master.states,
        launchDate: new Date(now.getTime() + 6 * 86_400_000), priority: "standard", status: "submitted", submitterId: master.submitterId,
        partnerId: null, parentId: master.id, currentVersion: 1, riskScore: risk.score, riskLevel: risk.level, submittedAt: at,
        dueAt: computeDueAt(at, "standard", false), updatedAt: at,
      }),
      db.insert(tables.versions).values({
        id: vid, submissionId: sid, number: 1, content, inputText: content, contentHash: createHash("sha256").update(content).digest("hex"),
        analysisStatus: "complete", analysisSummary: analysis.findings.length ? `Flagged ${analysis.findings.length} issue(s).` : "No issues found by rule checks or model review.",
        model: "claude-opus-5-5", createdBy: master.submitterId, createdAt: at,
      }),
      db.insert(tables.auditEvents).values([
        { submissionId: sid, actorId: master.submitterId, action: AUDIT.created, details: { versionNumber: 1, variantOf: master.code }, createdAt: at },
        { submissionId: sid, actorId: null, action: AUDIT.analysisCompleted, details: { versionNumber: 1, findings: analysis.findings.length }, createdAt: new Date(at.getTime() + 1000) },
      ]),
    ]);
    if (analysis.findings.length) {
      await db.insert(tables.findings).values(
        analysis.findings.map((f) => ({
          versionId: vid, source: f.source, ruleCode: f.ruleCode, severity: f.severity, quote: f.quote, startOffset: f.start, endOffset: f.end,
          issue: f.issue, suggestion: f.suggestion ?? null, confidence: f.confidence ?? null,
        })),
      );
    }
  }
  return VARIANTS.length;
}
