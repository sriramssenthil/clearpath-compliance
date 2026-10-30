"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { db, tables } from "@/lib/db";
import { startSession } from "@/lib/auth";
import { dummyPasswordHash, hashPassword, passwordProblem, verifyPassword } from "@/lib/auth/password";
import { safeNextPath } from "@/lib/auth/session";
import { clientIp, isThrottled, normalizeEmail, recentFailures, recordAttempt } from "@/lib/auth/throttle";
import { claimInvite, findInviteByToken, inviteState, releaseInvite } from "@/lib/auth/invites";
import { PERSONAS } from "@/lib/personas";
import { COMPANY_TYPES, NEW_PARTNER, emailProblem, nameProblem, type AuthFormState } from "./form-state";

const GENERIC_SIGN_IN_ERROR = "That email and password do not match an account.";
const DUPLICATE_EMAIL = "An account with this email already exists. Sign in instead.";

function text(form: FormData, key: string, max = 1000): string {
  const v = form.get(key);
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

// Passwords are not trimmed: leading or trailing spaces are part of what the person typed.
function password(form: FormData): string {
  const v = form.get("password");
  return typeof v === "string" ? v.slice(0, 1000) : "";
}

function isUniqueViolation(err: unknown): boolean {
  for (let e: unknown = err, i = 0; e && i < 4; e = (e as { cause?: unknown }).cause, i++) {
    if ((e as { code?: string }).code === "23505") return true;
  }
  return false;
}

async function emailTaken(email: string): Promise<boolean> {
  const rows = await db.select({ id: tables.users.id }).from(tables.users).where(eq(tables.users.email, email)).limit(1);
  return rows.length > 0;
}

export async function signUpAction(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const name = text(form, "name", 200);
  const email = normalizeEmail(text(form, "email", 300));
  const pw = password(form);
  const accountType = text(form, "accountType");
  const partnerChoice = text(form, "partnerId");
  const companyName = text(form, "companyName", 200);
  const companyType = text(form, "companyType");
  const values = { name, email, accountType, partnerId: partnerChoice, companyName, companyType };

  const fieldErrors: Record<string, string> = {};
  const nameErr = nameProblem(name);
  if (nameErr) fieldErrors.name = nameErr;
  const emailErr = emailProblem(email);
  if (emailErr) fieldErrors.email = emailErr;
  const pwErr = passwordProblem(pw, email);
  if (pwErr) fieldErrors.password = pwErr;
  if (accountType !== "marketer" && accountType !== "affiliate") fieldErrors.accountType = "Choose who you are.";

  let partnerId: number | null = null;
  let newPartner: { name: string; type: string } | null = null;
  if (accountType === "affiliate") {
    if (partnerChoice === NEW_PARTNER) {
      if (companyName.length < 2 || companyName.length > 100) fieldErrors.companyName = "Enter your company name (2 to 100 characters).";
      if (!(COMPANY_TYPES as readonly string[]).includes(companyType)) fieldErrors.companyType = "Choose what kind of partner you are.";
      if (!fieldErrors.companyName) {
        const [dup] = await db
          .select({ id: tables.partners.id })
          .from(tables.partners)
          .where(sql`lower(${tables.partners.name}) = ${companyName.toLowerCase()}`)
          .limit(1);
        if (dup) fieldErrors.companyName = "That company is already listed. Choose it from the list above.";
      }
      newPartner = { name: companyName, type: companyType };
    } else if (/^\d{1,9}$/.test(partnerChoice)) {
      const [row] = await db.select({ id: tables.partners.id }).from(tables.partners).where(eq(tables.partners.id, Number(partnerChoice))).limit(1);
      if (row) partnerId = row.id;
      else fieldErrors.partnerId = "Choose your company from the list.";
    } else {
      fieldErrors.partnerId = "Choose your company, or pick “My company is not listed”.";
    }
  }

  if (!fieldErrors.email && (await emailTaken(email))) fieldErrors.email = DUPLICATE_EMAIL;
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors, values };

  const passwordHash = await hashPassword(pw);
  let createdPartnerId: number | null = null;
  let userId: number;
  try {
    if (newPartner) {
      const [p] = await db.insert(tables.partners).values(newPartner).returning({ id: tables.partners.id });
      createdPartnerId = partnerId = p.id;
    }
    const role = accountType as "marketer" | "affiliate";
    const [u] = await db
      .insert(tables.users)
      .values({ name, email, role, partnerId: role === "affiliate" ? partnerId : null, passwordHash, isDemo: false })
      .returning({ id: tables.users.id });
    userId = u.id;
  } catch (err) {
    // neon-http has no interactive transactions, so undo the partner row by hand.
    if (createdPartnerId !== null) await db.delete(tables.partners).where(eq(tables.partners.id, createdPartnerId)).catch(() => {});
    if (isUniqueViolation(err)) return { fieldErrors: { email: DUPLICATE_EMAIL }, values };
    console.error("signUp failed", err);
    return { error: "We could not create your account. Please try again.", values };
  }

  await startSession(userId);
  redirect("/submissions/new");
}

export async function signInAction(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const email = normalizeEmail(text(form, "email", 300));
  const pw = password(form);
  const next = safeNextPath(text(form, "next", 600));
  const values = { email };

  const fieldErrors: Record<string, string> = {};
  if (!email) fieldErrors.email = "Enter your email address.";
  if (!pw) fieldErrors.password = "Enter your password.";
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors, values };

  const ip = clientIp(await headers());
  if (isThrottled(await recentFailures(email, ip))) {
    await recordAttempt(email, ip, false);
    return { error: "Too many sign-in attempts. Try again in a few minutes.", values };
  }

  const [user] = await db
    .select({ id: tables.users.id, role: tables.users.role, passwordHash: tables.users.passwordHash, isDemo: tables.users.isDemo })
    .from(tables.users)
    .where(eq(tables.users.email, email))
    .limit(1);

  if (user?.isDemo) {
    await recordAttempt(email, ip, false);
    return {
      error: "This is a demo persona and has no password. Use the demo persona buttons on the home page to explore as this person.",
      values,
    };
  }

  // Always run one scrypt verification so the response time does not reveal whether the email exists.
  const ok = await verifyPassword(pw, user?.passwordHash ?? (await dummyPasswordHash()));
  if (!user || !user.passwordHash || !ok) {
    await recordAttempt(email, ip, false);
    return { error: GENERIC_SIGN_IN_ERROR, values };
  }

  await recordAttempt(email, ip, true);
  await startSession(user.id);
  redirect(next ?? PERSONAS[user.role].defaultRoute);
}

export async function acceptInviteAction(token: string, _prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const name = text(form, "name", 200);
  const pw = password(form);
  const values = { name };

  const invite = await findInviteByToken(token);
  if (!invite || inviteState(invite) !== "valid") {
    return { error: "This invite link is no longer valid. Ask the person who invited you for a new one." };
  }

  const fieldErrors: Record<string, string> = {};
  const nameErr = nameProblem(name);
  if (nameErr) fieldErrors.name = nameErr;
  const pwErr = passwordProblem(pw, invite.email);
  if (pwErr) fieldErrors.password = pwErr;
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors, values };
  if (await emailTaken(invite.email)) return { error: `An account for ${invite.email} already exists. Sign in instead.`, values };

  const passwordHash = await hashPassword(pw);
  const claimed = await claimInvite(token);
  if (!claimed) return { error: "This invite link has just been used or has expired. Ask for a new one." };

  let userId: number;
  try {
    const [u] = await db
      .insert(tables.users)
      .values({
        name,
        email: claimed.email,
        role: claimed.role,
        partnerId: claimed.role === "affiliate" ? claimed.partnerId : null,
        passwordHash,
        isDemo: false,
      })
      .returning({ id: tables.users.id });
    userId = u.id;
  } catch (err) {
    await releaseInvite(claimed.id).catch(() => {});
    if (isUniqueViolation(err)) return { error: DUPLICATE_EMAIL, values };
    console.error("acceptInvite failed", err);
    return { error: "We could not create your account. Please try again.", values };
  }

  await startSession(userId);
  redirect(PERSONAS[claimed.role].defaultRoute);
}
