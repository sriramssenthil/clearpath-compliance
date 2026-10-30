"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, tables } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { INVITE_ROLES, createInvite, hasPendingInvite, revokeInvite } from "@/lib/auth/invites";
import { normalizeEmail } from "@/lib/auth/throttle";
import type { Role } from "@/lib/personas";
import { emailProblem } from "../../(auth)/form-state";

export type CreateInviteResult =
  | { ok: true; token: string; email: string; role: Role; expiresAt: Date }
  | { ok: false; error?: string; fieldErrors?: Partial<Record<"email" | "role" | "partnerId", string>> };

async function requireLead() {
  const user = await getCurrentUser();
  return user?.role === "lead" ? user : null;
}

export async function createInviteAction(_prev: CreateInviteResult | null, form: FormData): Promise<CreateInviteResult> {
  const lead = await requireLead();
  if (!lead) return { ok: false, error: "Only a compliance lead can invite people." };

  const email = normalizeEmail(String(form.get("email") ?? "").slice(0, 300));
  const role = String(form.get("role") ?? "") as Role;
  const partnerRaw = String(form.get("partnerId") ?? "");

  const fieldErrors: Partial<Record<"email" | "role" | "partnerId", string>> = {};
  const emailErr = emailProblem(email);
  if (emailErr) fieldErrors.email = emailErr;
  if (!INVITE_ROLES.includes(role)) fieldErrors.role = "Choose a role.";
  // A demo persona is shared by every visitor, so it must not mint real staff accounts.
  if (lead.isDemo && (role === "reviewer" || role === "lead")) {
    return { ok: false, error: "Demo personas cannot invite reviewers or leads: anyone can use a demo persona, so this would let anyone create a real staff account. Sign in with a real lead account to do this." };
  }

  let partnerId: number | null = null;
  if (role === "affiliate") {
    if (/^\d{1,9}$/.test(partnerRaw)) {
      const [p] = await db.select({ id: tables.partners.id }).from(tables.partners).where(eq(tables.partners.id, Number(partnerRaw))).limit(1);
      if (p) partnerId = p.id;
    }
    if (partnerId === null) fieldErrors.partnerId = "Choose the partner this person works for.";
  }

  if (!fieldErrors.email) {
    const [existing] = await db.select({ id: tables.users.id }).from(tables.users).where(eq(tables.users.email, email)).limit(1);
    if (existing) fieldErrors.email = "This person already has an account.";
    else if (await hasPendingInvite(email)) fieldErrors.email = "An invite for this email is already pending. Revoke it below to send a new one.";
  }
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const invite = await createInvite({ email, role, partnerId, createdBy: lead.id });
  revalidatePath("/team");
  return { ok: true, token: invite.token, email, role, expiresAt: invite.expiresAt };
}

export async function revokeInviteAction(inviteId: number): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await requireLead())) return { ok: false, error: "Only a compliance lead can revoke invites." };
  if (!Number.isInteger(inviteId)) return { ok: false, error: "Unknown invite." };
  const removed = await revokeInvite(inviteId);
  revalidatePath("/team");
  return removed ? { ok: true } : { ok: false, error: "That invite was already used or revoked." };
}
