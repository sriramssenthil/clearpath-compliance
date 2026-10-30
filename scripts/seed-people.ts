import { config } from "dotenv";
import { eq } from "drizzle-orm";

// lib/db reads DATABASE_URL when it is imported, so env must be loaded first.
config({ path: ".env.local" });

async function main() {
  const { db, tables } = await import("../lib/db");
  const { PARTNERS, USERS } = await import("../lib/seed/people");

  const partnerIds = new Map<string, number>();
  for (const p of PARTNERS) {
    const [existing] = await db.select({ id: tables.partners.id }).from(tables.partners).where(eq(tables.partners.name, p.name)).limit(1);
    if (existing) {
      await db.update(tables.partners).set({ type: p.type }).where(eq(tables.partners.id, existing.id));
      partnerIds.set(p.name, existing.id);
    } else {
      const [row] = await db.insert(tables.partners).values({ name: p.name, type: p.type }).returning({ id: tables.partners.id });
      partnerIds.set(p.name, row.id);
    }
  }

  for (const u of USERS) {
    const partnerId = u.partnerName ? (partnerIds.get(u.partnerName) ?? null) : null;
    await db
      .insert(tables.users)
      .values({ name: u.name, email: u.email, role: u.role, partnerId })
      .onConflictDoUpdate({ target: tables.users.email, set: { name: u.name, role: u.role, partnerId } });
  }

  const partnerRows = await db.select({ id: tables.partners.id }).from(tables.partners);
  const userRows = await db.select({ id: tables.users.id }).from(tables.users);
  console.log({ partners: partnerRows.length, users: userRows.length, expectedPartners: PARTNERS.length, expectedUsers: USERS.length });
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
