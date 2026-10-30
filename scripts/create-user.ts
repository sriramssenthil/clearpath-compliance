// Operator tool: create a real (non-demo) account directly, e.g. the first reviewer or lead, which
// cannot self-register. Prints a generated password once.
// Usage: npx tsx scripts/create-user.ts <email> "<full name>" <marketer|affiliate|reviewer|lead> [partner name]
import { randomBytes } from "node:crypto";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

async function main() {
  const [emailRaw, name, role, partnerName] = process.argv.slice(2);
  if (!emailRaw || !name || !["marketer", "affiliate", "reviewer", "lead"].includes(role)) {
    throw new Error('Usage: npx tsx scripts/create-user.ts <email> "<full name>" <marketer|affiliate|reviewer|lead> [partner name]');
  }
  const { eq } = await import("drizzle-orm");
  const { db, tables } = await import("../lib/db");
  const { hashPassword } = await import("../lib/auth/password");
  const email = emailRaw.trim().toLowerCase();

  let partnerId: number | null = null;
  if (role === "affiliate") {
    const [p] = await db.select().from(tables.partners).where(eq(tables.partners.name, partnerName ?? ""));
    if (!p) throw new Error("Affiliates need an existing partner name as the fourth argument.");
    partnerId = p.id;
  }
  const [existing] = await db.select({ id: tables.users.id }).from(tables.users).where(eq(tables.users.email, email));
  if (existing) throw new Error(`An account for ${email} already exists.`);

  const password = randomBytes(12).toString("base64url");
  const [u] = await db
    .insert(tables.users)
    .values({ email, name, role: role as "marketer", partnerId, passwordHash: await hashPassword(password), isDemo: false })
    .returning({ id: tables.users.id });
  console.log(`Created ${role} #${u.id}: ${email}  password: ${password}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
