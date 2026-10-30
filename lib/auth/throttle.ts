/*
 * Sign-in throttling backed by the auth_attempts table. Every attempt is recorded; when an email or
 * an IP has too many recent failures, further attempts are refused before the password is checked.
 */

export const THROTTLE_WINDOW_MS = 15 * 60 * 1000;
/** Failures allowed per email in the window; the next attempt is refused. */
export const MAX_EMAIL_FAILURES = 8;
/** Failures allowed per IP in the window (several people can share an office IP). */
export const MAX_IP_FAILURES = 30;

export function isThrottled(recent: { emailFailures: number; ipFailures: number }): boolean {
  return recent.emailFailures >= MAX_EMAIL_FAILURES || recent.ipFailures >= MAX_IP_FAILURES;
}

/** Trimmed, lowercased email: the single form used for lookups, storage and throttling. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** First address in x-forwarded-for (set by the hosting proxy), else x-real-ip, else null. */
export function clientIp(h: { get(name: string): string | null }): string | null {
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || h.get("x-real-ip")?.trim() || null;
  return ip ? ip.slice(0, 64) : null;
}

export async function recentFailures(email: string, ip: string | null, nowMs = Date.now()) {
  const { db, tables } = await import("@/lib/db");
  const { and, count, eq, gt } = await import("drizzle-orm");
  const since = new Date(nowMs - THROTTLE_WINDOW_MS);
  const t = tables.authAttempts;
  const [byEmail, byIp] = await Promise.all([
    db.select({ n: count() }).from(t).where(and(eq(t.email, email), eq(t.success, false), gt(t.createdAt, since))),
    ip ? db.select({ n: count() }).from(t).where(and(eq(t.ip, ip), eq(t.success, false), gt(t.createdAt, since))) : Promise.resolve([{ n: 0 }]),
  ]);
  return { emailFailures: byEmail[0]?.n ?? 0, ipFailures: byIp[0]?.n ?? 0 };
}

export async function recordAttempt(email: string, ip: string | null, success: boolean) {
  const { db, tables } = await import("@/lib/db");
  await db.insert(tables.authAttempts).values({ email: email.slice(0, 254), ip, success });
}
