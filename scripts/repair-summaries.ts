// One-off repair: rewrite stored analysis summaries so their verdict agrees with each version's findings
// (the model's summary used to state its own verdict, which could contradict rule findings).
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

async function main() {
  const { eq, inArray } = await import("drizzle-orm");
  const { db, tables } = await import("../lib/db");
  const { composeSummary } = await import("../lib/compliance/summary");
  const versions = await db.select().from(tables.versions);
  const findings = await db
    .select({ versionId: tables.findings.versionId, severity: tables.findings.severity, source: tables.findings.source })
    .from(tables.findings)
    .where(inArray(tables.findings.source, ["rule", "ai"]));
  let changed = 0;
  for (const v of versions) {
    const mine = findings.filter((f) => f.versionId === v.id);
    const next = composeSummary(mine, v.analysisSummary);
    if (next !== v.analysisSummary) {
      await db.update(tables.versions).set({ analysisSummary: next }).where(eq(tables.versions.id, v.id));
      changed++;
    }
  }
  console.log(`${changed} of ${versions.length} summaries rewritten`);
}
main().catch((e) => { console.error(e); process.exit(1); });
