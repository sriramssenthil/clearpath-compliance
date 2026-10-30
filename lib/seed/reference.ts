import { sql } from "drizzle-orm";
import { PRODUCT_FACTS } from "./product-facts";
import { RULES } from "./rules";

/** Restores the rules library and product facts to their shipped defaults (idempotent upsert). */
export async function seedReference(): Promise<{ rules: number; productFacts: number }> {
  const { db, tables } = await import("@/lib/db");
  for (const r of RULES) {
    const values = {
      code: r.code, title: r.title, description: r.description, category: r.category, severity: r.severity,
      kind: r.kind, products: r.products, channels: r.channels, checkInstruction: r.checkInstruction,
      config: r.config, citation: r.citation, guidance: r.guidance, enabled: r.enabled, aiReview: r.aiReview ?? true,
    };
    await db
      .insert(tables.rules)
      .values(values)
      .onConflictDoUpdate({ target: tables.rules.code, set: { ...values, version: sql`${tables.rules.version} + 1`, updatedAt: sql`now()` } });
  }
  for (const f of PRODUCT_FACTS) {
    const values = { product: f.product, facts: f.facts, approvedSnippets: f.approvedSnippets };
    await db
      .insert(tables.productFacts)
      .values(values)
      .onConflictDoUpdate({ target: tables.productFacts.product, set: { ...values, updatedAt: sql`now()` } });
  }
  return { rules: RULES.length, productFacts: PRODUCT_FACTS.length };
}
