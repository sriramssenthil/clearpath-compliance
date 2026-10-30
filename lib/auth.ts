import { cache } from "react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { PERSONAS, canManageRules, canReview, canViewAllSubmissions, type Role } from "@/lib/personas";

export { canManageRules, canReview, canViewAllSubmissions };

/*
 * DEMO AUTH, NOT REAL AUTH.
 * ClearPath Review is a demo with a persona switcher so a reviewer can try every role without accounts.
 * The session is just the chosen user id in an httpOnly cookie: there is no password and no signature,
 * so anyone can become any seeded user. Production would use SSO for employees and invite-only
 * accounts for partners. Every server-side check still goes through getCurrentUser()/requireRole(),
 * so swapping this file for real auth would not change callers.
 *
 * Role semantics other code relies on:
 *  - reviewer and lead can see every submission; only they can review (lead alone manages rules)
 *  - marketer sees their own submissions
 *  - affiliate sees only submissions belonging to their own partner
 */

const COOKIE_NAME = "cp_demo_user";
const THIRTY_DAYS = 60 * 60 * 24 * 30;

export interface CurrentUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  partnerId: number | null;
  partnerName: string | null;
}

// Imported lazily: lib/db throws at import time when DATABASE_URL is missing, and callers
// (the landing page especially) must be able to degrade instead of crashing.
async function loadDb() {
  return import("@/lib/db");
}

async function readUserId(): Promise<number | null> {
  const raw = (await cookies()).get(COOKIE_NAME)?.value;
  if (!raw || !/^\d+$/.test(raw)) return null;
  return Number(raw);
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
    })
    .from(tables.users)
    .leftJoin(tables.partners, eq(tables.users.partnerId, tables.partners.id))
    .where(eq(tables.users.id, id))
    .limit(1);
  return row ?? null;
}

/** The signed-in demo user (with partner name), or null. Deduplicated per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const id = await readUserId();
  if (id === null) return null;
  try {
    return await findUser(id);
  } catch (err) {
    console.error("getCurrentUser: database unavailable", err);
    return null;
  }
});

/** Redirects to the landing page when nobody is signed in. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/");
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

/** All demo users with partner names, for the persona switcher. */
export const listDemoUsers = cache(async (): Promise<CurrentUser[]> => {
  const { db, tables } = await loadDb();
  return db
    .select({
      id: tables.users.id,
      name: tables.users.name,
      email: tables.users.email,
      role: tables.users.role,
      partnerId: tables.users.partnerId,
      partnerName: tables.partners.name,
    })
    .from(tables.users)
    .leftJoin(tables.partners, eq(tables.users.partnerId, tables.partners.id))
    .orderBy(tables.users.id);
});

/** Look up a demo user by email (used by the landing page to find each persona's primary user). */
export async function findUserByEmail(email: string) {
  const { db, tables } = await loadDb();
  const [row] = await db.select({ id: tables.users.id, name: tables.users.name }).from(tables.users).where(eq(tables.users.email, email)).limit(1);
  return row ?? null;
}

/** Sign in as the given demo user and go to that persona's home route. */
export async function switchPersona(userId: number) {
  "use server";
  if (!Number.isInteger(userId)) throw new Error("Invalid user");
  const user = await findUser(userId);
  if (!user) throw new Error("Unknown demo user");
  (await cookies()).set(COOKIE_NAME, String(user.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: THIRTY_DAYS,
  });
  redirect(PERSONAS[user.role].defaultRoute);
}

export async function signOut() {
  "use server";
  (await cookies()).delete(COOKIE_NAME);
  redirect("/");
}
