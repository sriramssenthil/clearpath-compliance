import { createHash, randomBytes } from "node:crypto";
import type { Role } from "@/lib/personas";

/*
 * One-time invite links. The raw token is shown to the inviting lead exactly once; only its sha256
 * is stored, so a database read does not reveal usable links.
 */

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const INVITE_ROLES: readonly Role[] = ["reviewer", "lead", "marketer", "affiliate"];

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateInviteToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashInviteToken(token) };
}

export function looksLikeInviteToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

export type InviteState = "valid" | "expired" | "used";

export function inviteState(invite: { expiresAt: Date; usedAt: Date | null }, nowMs = Date.now()): InviteState {
  if (invite.usedAt) return "used";
  if (invite.expiresAt.getTime() <= nowMs) return "expired";
  return "valid";
}

async function loadDb() {
  const [{ db, tables }, orm] = await Promise.all([import("@/lib/db"), import("drizzle-orm")]);
  return { db, tables, ...orm };
}

export interface InviteView {
  id: number;
  email: string;
  role: Role;
  partnerId: number | null;
  partnerName: string | null;
  inviterName: string | null;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

// Takes the loaded module rather than awaiting it: drizzle query builders are thenables, so
// returning one from an async function would execute it.
function selectInvites({ db, tables, eq }: Awaited<ReturnType<typeof loadDb>>) {
  const { invites, partners, users } = tables;
  return db
    .select({
      id: invites.id,
      email: invites.email,
      role: invites.role,
      partnerId: invites.partnerId,
      partnerName: partners.name,
      inviterName: users.name,
      expiresAt: invites.expiresAt,
      usedAt: invites.usedAt,
      createdAt: invites.createdAt,
    })
    .from(invites)
    .leftJoin(partners, eq(invites.partnerId, partners.id))
    .leftJoin(users, eq(invites.createdBy, users.id))
    .$dynamic();
}

export async function createInvite(input: { email: string; role: Role; partnerId: number | null; createdBy: number }, nowMs = Date.now()) {
  const { db, tables } = await loadDb();
  const { token, tokenHash } = generateInviteToken();
  const expiresAt = new Date(nowMs + INVITE_TTL_MS);
  const [row] = await db
    .insert(tables.invites)
    .values({ tokenHash, email: input.email, role: input.role, partnerId: input.partnerId, createdBy: input.createdBy, expiresAt })
    .returning({ id: tables.invites.id });
  return { id: row.id, token, expiresAt };
}

/** Unused, unexpired invites, newest first. */
export async function listPendingInvites(nowMs = Date.now()): Promise<InviteView[]> {
  const m = await loadDb();
  const { tables, and, isNull, gt, desc } = m;
  return selectInvites(m).where(and(isNull(tables.invites.usedAt), gt(tables.invites.expiresAt, new Date(nowMs)))).orderBy(desc(tables.invites.createdAt));
}

export async function hasPendingInvite(email: string, nowMs = Date.now()): Promise<boolean> {
  const { db, tables, and, eq, isNull, gt } = await loadDb();
  const t = tables.invites;
  const rows = await db
    .select({ id: t.id })
    .from(t)
    .where(and(eq(t.email, email), isNull(t.usedAt), gt(t.expiresAt, new Date(nowMs))))
    .limit(1);
  return rows.length > 0;
}

/** Deletes a pending invite. Used invites are kept as the record of how an account was created. */
export async function revokeInvite(id: number): Promise<boolean> {
  const { db, tables, and, eq, isNull } = await loadDb();
  const rows = await db
    .delete(tables.invites)
    .where(and(eq(tables.invites.id, id), isNull(tables.invites.usedAt)))
    .returning({ id: tables.invites.id });
  return rows.length > 0;
}

export async function findInviteByToken(token: string): Promise<InviteView | null> {
  if (!looksLikeInviteToken(token)) return null;
  const m = await loadDb();
  const [row] = await selectInvites(m).where(m.eq(m.tables.invites.tokenHash, hashInviteToken(token))).limit(1);
  return row ?? null;
}

/**
 * Marks the invite used if it is still valid, in one conditional UPDATE so two people opening the
 * same link cannot both claim it. Returns the claimed invite, or null.
 */
export async function claimInvite(token: string, nowMs = Date.now()) {
  if (!looksLikeInviteToken(token)) return null;
  const { db, tables, and, eq, isNull, gt } = await loadDb();
  const t = tables.invites;
  const [row] = await db
    .update(t)
    .set({ usedAt: new Date(nowMs) })
    .where(and(eq(t.tokenHash, hashInviteToken(token)), isNull(t.usedAt), gt(t.expiresAt, new Date(nowMs))))
    .returning({ id: t.id, email: t.email, role: t.role, partnerId: t.partnerId });
  return row ?? null;
}

/** Undo a claim when creating the account failed afterwards, so the link still works. */
export async function releaseInvite(id: number) {
  const { db, tables, eq } = await loadDb();
  await db.update(tables.invites).set({ usedAt: null }).where(eq(tables.invites.id, id));
}

export interface TeamMember {
  id: number;
  name: string;
  email: string;
  role: Role;
  partnerName: string | null;
  isDemo: boolean;
  createdAt: Date;
}

export async function listTeamMembers(): Promise<TeamMember[]> {
  const { db, tables, eq, asc } = await loadDb();
  const { users, partners } = tables;
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      partnerName: partners.name,
      isDemo: users.isDemo,
      createdAt: users.createdAt,
    })
    .from(users)
    .leftJoin(partners, eq(users.partnerId, partners.id))
    .orderBy(asc(users.id));
}
