import { cache } from "react";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { PERSONAS, canManageRules, canReview, canViewAllSubmissions, type Role } from "@/lib/personas";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, getAuthSecret, signSession, verifySession } from "@/lib/auth/session";

export { canManageRules, canReview, canViewAllSubmissions };

/*
 * Authentication.
 *  - Real accounts sign up or accept an invite, and sign in with an email and password (scrypt hashes,
 *    lib/auth/password.ts). The session is a stateless HMAC-signed token in the `cp_session` cookie
 *    (lib/auth/session.ts), valid for 7 days.
 *  - Demo personas (users.is_demo, no password) can be entered with one click from the landing page
 *    while DEMO_MODE is on, so strangers can explore every role. switchPersona() refuses anyone else.
 *
 * Every server-side check goes through getCurrentUser()/requireRole(); proxy.ts only redirects
 * visitors without any session cookie and never decides who someone is.
 *
 * Role semantics other code relies on:
 *  - reviewer and lead can see every submission; only they can review (lead alone manages rules and the team)
 *  - marketer sees their own submissions
 *  - affiliate sees only submissions belonging to their own partner
 */

/**
 * LEGACY DEVELOPMENT COOKIE. Before real sessions existed, `cp_demo_user=<user id>` (unsigned) was the
 * whole session. It is still accepted in development and tests so scripts and other tooling can sign in
 * with a plain cookie, and it is IGNORED in production, where only a signed `cp_session` counts.
 */
export const LEGACY_DEMO_COOKIE = "cp_demo_user";
const legacyCookieAllowed = () => process.env.NODE_ENV !== "production";

/** Demo personas are on unless DEMO_MODE is exactly "false". */
export function isDemoMode(): boolean {
  return process.env.DEMO_MODE !== "false";
}

export interface CurrentUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  partnerId: number | null;
  partnerName: string | null;
  /** Seeded, passwordless demo persona. */
  isDemo: boolean;
}

// Imported lazily: lib/db throws at first use when DATABASE_URL is missing, and callers
// (the landing page especially) must be able to degrade instead of crashing.
async function loadDb() {
  return import("@/lib/db");
}

async function readUserId(): Promise<number | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    // Expiry is checked against the clock, which must be read at request time, never while prerendering.
    await connection();
    const session = verifySession(token, getAuthSecret());
    if (session) return session.uid;
  }
  if (legacyCookieAllowed()) {
    const raw = jar.get(LEGACY_DEMO_COOKIE)?.value;
    if (raw && /^\d{1,9}$/.test(raw)) return Number(raw);
  }
  return null;
}

async function findUser(id: number): Promise<CurrentUser | null> {
  const { db, tables } = await loadDb();
  const [row] = await db
    .select({
      id: tables.users.id,
      name: tables.users.name,
      email: tables.users.email,
      role: tables.users.role,
      partnerId: tables.users.partnerId,
      partnerName: tables.partners.name,
      isDemo: tables.users.isDemo,
    })
    .from(tables.users)
    .leftJoin(tables.partners, eq(tables.users.partnerId, tables.partners.id))
    .where(eq(tables.users.id, id))
    .limit(1);
  return row ?? null;
}

/** The signed-in user (with partner name), or null. Deduplicated per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  // Outside the try: a missing AUTH_SECRET is a configuration error and must surface, not look signed out.
  const id = await readUserId();
  if (id === null) return null;
  try {
    const user = await findUser(id);
    // With demo mode off, a leftover demo-persona session no longer counts.
    if (user?.isDemo && !isDemoMode()) return null;
    return user;
  } catch (err) {
    console.error("getCurrentUser: database unavailable", err);
    return null;
  }
});

/** Redirects to the sign-in page when nobody is signed in. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Requires one of the given roles. Signed-in users with another role are sent to their own home route. */
export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect(PERSONAS[user.role].defaultRoute);
  return user;
}

/** Like requireRole but responds 404, for resources that should not reveal they exist. */
export async function requireRoleOrNotFound(...roles: Role[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) notFound();
  return user;
}

/** Demo personas with partner names, for the persona switcher. Empty when demo mode is off. */
export const listDemoUsers = cache(async (): Promise<CurrentUser[]> => {
  if (!isDemoMode()) return [];
  const { db, tables } = await loadDb();
  return db
    .select({
      id: tables.users.id,
      name: tables.users.name,
      email: tables.users.email,
      role: tables.users.role,
      partnerId: tables.users.partnerId,
      partnerName: tables.partners.name,
      isDemo: tables.users.isDemo,
    })
    .from(tables.users)
    .leftJoin(tables.partners, eq(tables.users.partnerId, tables.partners.id))
    .where(eq(tables.users.isDemo, true))
    .orderBy(tables.users.id);
});

/** Look up a demo persona by email (the landing page uses it to find each role's primary persona). */
export async function findUserByEmail(email: string) {
  const { db, tables } = await loadDb();
  const [row] = await db
    .select({ id: tables.users.id, name: tables.users.name })
    .from(tables.users)
    .where(and(eq(tables.users.email, email.trim().toLowerCase()), eq(tables.users.isDemo, true)))
    .limit(1);
  return row ?? null;
}

/** Sets the signed session cookie for a user. Call only after the user has been authenticated. */
export async function startSession(userId: number) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, signSession(userId, getAuthSecret()), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  jar.delete(LEGACY_DEMO_COOKIE);
}

/** Sign in as a demo persona and go to that persona's home route. Refuses real accounts. */
export async function switchPersona(userId: number) {
  "use server";
  if (!isDemoMode()) throw new Error("Demo personas are turned off on this site.");
  if (!Number.isInteger(userId)) throw new Error("Invalid user");
  const user = await findUser(userId);
  if (!user || !user.isDemo) throw new Error("Only demo personas can be entered without a password.");
  await startSession(user.id);
  redirect(PERSONAS[user.role].defaultRoute);
}

export async function signOut() {
  "use server";
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(LEGACY_DEMO_COOKIE);
  redirect("/");
}
