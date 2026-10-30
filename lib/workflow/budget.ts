import { and, count, eq, gte } from "drizzle-orm";
import { db, tables } from "@/lib/db";

/**
 * Spend guard for the public demo. Every live model call is recorded; when a person (or the whole
 * deployment) exceeds its hourly allowance, analysis falls back to rules-only mode instead of failing.
 * Cached results never count. Limits are env-tunable; defaults cost at most a few dollars per hour.
 */
const num = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) ? Number(v) : d);
export const LIMITS = {
  perUserPerHour: () => num(process.env.AI_LIMIT_PER_USER_HOUR, 25),
  globalPerHour: () => num(process.env.AI_LIMIT_GLOBAL_HOUR, 250),
};

export async function reserveAiCall(userId: number | null): Promise<{ ok: true } | { ok: false; reason: string }> {
  const since = new Date(Date.now() - 3_600_000);
  const [[global], [mine]] = await Promise.all([
    db.select({ n: count() }).from(tables.aiUsage).where(gte(tables.aiUsage.createdAt, since)),
    userId === null
      ? Promise.resolve([{ n: 0 }])
      : db.select({ n: count() }).from(tables.aiUsage).where(and(eq(tables.aiUsage.userId, userId), gte(tables.aiUsage.createdAt, since))),
  ]);
  if (global.n >= LIMITS.globalPerHour()) {
    return { ok: false, reason: "AI review is paused: this demo reached its hourly usage limit. Rule-based findings are shown; try again later." };
  }
  if (mine.n >= LIMITS.perUserPerHour()) {
    return { ok: false, reason: "AI review is paused for you: hourly demo limit reached. Rule-based findings are shown; try again later." };
  }
  await db.insert(tables.aiUsage).values({ userId });
  return { ok: true };
}
