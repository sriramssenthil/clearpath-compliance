import { count } from "drizzle-orm";
import { connection } from "next/server";
import { db, tables } from "@/lib/db";

/** Liveness check for the deployment: database reachable, data seeded, AI key configured (never its value). */
export async function GET() {
  await connection();
  try {
    const [[rules], [subs]] = await Promise.all([
      db.select({ n: count() }).from(tables.rules),
      db.select({ n: count() }).from(tables.submissions),
    ]);
    return Response.json({
      ok: true,
      database: "reachable",
      rules: rules.n,
      submissions: subs.n,
      ai: process.env.ANTHROPIC_API_KEY ? "configured" : "missing",
      model: process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5",
    });
  } catch {
    return Response.json({ ok: false, database: "unreachable" }, { status: 503 });
  }
}
