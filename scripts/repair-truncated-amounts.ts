// One-off repair: findings whose quote stopped part-way through a dollar amount (e.g. "$1" of "$1,650"),
// caused by a trigger pattern that matched only the first digit. Extends the quote to the whole number.
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

async function main() {
  const { eq } = await import("drizzle-orm");
  const { db, tables } = await import("../lib/db");
  const rows = await db
    .select({ f: tables.findings, content: tables.versions.content })
    .from(tables.findings)
    .innerJoin(tables.versions, eq(tables.findings.versionId, tables.versions.id));
  let fixed = 0;
  for (const { f, content } of rows) {
    if (f.startOffset === null || f.endOffset === null || !/\$\s?\d[\d,]*$/.test(f.quote)) continue;
    let end = f.endOffset;
    while (end < content.length && /[\d,]/.test(content[end]) && !(content[end] === "," && !/\d/.test(content[end + 1] ?? ""))) end++;
    if (/\.\d{2}/.test(content.slice(end, end + 3))) end += 3;
    if (end === f.endOffset) continue;
    const quote = content.slice(f.startOffset, end);
    await db.update(tables.findings).set({ quote, endOffset: end }).where(eq(tables.findings.id, f.id));
    console.log(`finding ${f.id}: "${f.quote}" -> "${quote}"`);
    fixed++;
  }
  console.log(`${fixed} finding(s) repaired`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
