import { eq } from "drizzle-orm";
import { db, tables } from "@/lib/db";
import type { Product, ProductFacts, RuleConfig, RuleDef } from "@/lib/compliance/types";

type RuleRow = typeof tables.rules.$inferSelect;

export const ruleFromRow = (r: RuleRow): RuleDef & { version: number } => ({
  code: r.code,
  title: r.title,
  description: r.description,
  category: r.category,
  severity: r.severity,
  kind: r.kind,
  products: r.products,
  channels: r.channels,
  checkInstruction: r.checkInstruction,
  config: r.config as RuleConfig,
  citation: r.citation,
  guidance: r.guidance,
  enabled: r.enabled,
  aiReview: r.aiReview,
  version: r.version,
});

export async function loadRules(): Promise<(RuleDef & { version: number })[]> {
  const rows = await db.select().from(tables.rules).orderBy(tables.rules.code);
  return rows.map(ruleFromRow);
}

export async function loadFacts(product: Product): Promise<ProductFacts> {
  const [row] = await db.select().from(tables.productFacts).where(eq(tables.productFacts.product, product));
  if (!row) throw new Error(`No product facts for ${product}; run \`npm run seed:reference\`.`);
  return { product: row.product, facts: row.facts as ProductFacts["facts"], approvedSnippets: row.approvedSnippets as ProductFacts["approvedSnippets"] };
}
