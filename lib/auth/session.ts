import { createHmac, timingSafeEqual } from "node:crypto";

/*
 * Stateless session token: base64url(JSON payload) + "." + base64url(HMAC-SHA256(payload)), keyed by
 * AUTH_SECRET. Nothing is stored server-side, so signing out clears the cookie but cannot revoke a
 * copied token before it expires; rotate AUTH_SECRET to invalidate every session at once.
 */

export const SESSION_COOKIE = "cp_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export interface SessionPayload {
  /** User id. */
  uid: number;
  /** Issued at, seconds since the epoch. */
  iat: number;
  /** Expires at, seconds since the epoch. */
  exp: number;
}

/** AUTH_SECRET from the environment. Missing or short secrets are a configuration error everywhere. */
export function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SECRET is missing or shorter than 32 characters. Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64url'))\"",
    );
  }
  return secret;
}

function mac(data: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(data).digest();
}

export function signSession(userId: number, secret: string, nowMs = Date.now()): string {
  const iat = Math.floor(nowMs / 1000);
  const payload: SessionPayload = { uid: userId, iat, exp: iat + SESSION_TTL_SECONDS };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${mac(body, secret).toString("base64url")}`;
}

/** The payload of a valid, unexpired token signed with `secret`, else null. */
export function verifySession(token: string | undefined | null, secret: string, nowMs = Date.now()): SessionPayload | null {
  if (!token || token.length > 512) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const given = Buffer.from(sig, "base64url");
  const expected = mac(body, secret);
  // Non-canonical base64url (spare low bits set) decodes to the same bytes; reject it so each token has one spelling.
  if (given.toString("base64url") !== sig) return null;
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof payload !== "object" || payload === null) return null;
  const { uid, iat, exp } = payload as Record<string, unknown>;
  if (!Number.isInteger(uid) || typeof iat !== "number" || typeof exp !== "number") return null;
  const now = Math.floor(nowMs / 1000);
  if (exp <= now || iat > now + 60) return null;
  return { uid: uid as number, iat, exp };
}

/**
 * A `next` redirect target that is safe to follow: a same-origin relative path only. Anything
 * else (absolute URLs, protocol-relative `//host`, backslash tricks, auth pages) yields null.
 */
export function safeNextPath(next: unknown): string | null {
  if (typeof next !== "string" || next.length > 512) return null;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\") || /[\u0000-\u001f]/.test(next)) return null;
  try {
    const base = "http://clearpath.invalid";
    const url = new URL(next, base);
    if (url.origin !== base) return null;
    if (/^\/(login|signup|invite)(\/|$)/.test(url.pathname)) return null;
    return url.pathname + url.search + url.hash;
  } catch {
    return null;
  }
}
