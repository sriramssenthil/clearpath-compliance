import { describe, expect, it } from "vitest";
import { hashPassword, passwordProblem, verifyPassword, PASSWORD_MIN_LENGTH } from "@/lib/auth/password";
import { SESSION_TTL_SECONDS, getAuthSecret, safeNextPath, signSession, verifySession } from "@/lib/auth/session";
import { MAX_EMAIL_FAILURES, MAX_IP_FAILURES, clientIp, isThrottled, normalizeEmail } from "@/lib/auth/throttle";
import { generateInviteToken, hashInviteToken, inviteState, looksLikeInviteToken } from "@/lib/auth/invites";

const SECRET = "test-secret-0123456789-abcdefghijklmnop";

describe("password hashing", () => {
  it("hashes in a self-describing scrypt format with a random salt", async () => {
    const a = await hashPassword("correct horse battery");
    const b = await hashPassword("correct horse battery");
    expect(a).toMatch(/^scrypt\$16384\$8\$1\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
    expect(a).not.toBe(b);
  });

  it("verifies the right password and rejects the wrong one", async () => {
    const h = await hashPassword("correct horse battery");
    expect(await verifyPassword("correct horse battery", h)).toBe(true);
    expect(await verifyPassword("correct horse batterY", h)).toBe(false);
    expect(await verifyPassword("", h)).toBe(false);
  });

  it("uses the parameters stored in the hash, so they can change later", async () => {
    const h = await hashPassword("correct horse battery");
    const [, , , , salt] = h.split("$");
    // Re-derive with different cost parameters by hand and confirm verify honours them.
    const { scryptSync } = await import("node:crypto");
    const key = scryptSync("correct horse battery", Buffer.from(salt, "hex"), 32, { N: 1024, r: 4, p: 1 });
    const other = `scrypt$1024$4$1$${salt}$${key.toString("hex")}`;
    expect(await verifyPassword("correct horse battery", other)).toBe(true);
  });

  it("never matches malformed or absurd hashes", async () => {
    for (const bad of ["", "salt:hash", "scrypt$x$8$1$aa$bb", "bcrypt$16384$8$1$aa$bb", "scrypt$16384$8$1$zz$bb", "scrypt$99999999$8$1$aa$bb"]) {
      expect(await verifyPassword("anything at all", bad)).toBe(false);
    }
  });

  it("enforces length and a denylist", () => {
    expect(passwordProblem("short")).toMatch(String(PASSWORD_MIN_LENGTH));
    expect(passwordProblem("Password123")).toMatch(/easy to guess/);
    expect(passwordProblem("zzzzzzzzzzzz")).toMatch(/easy to guess/);
    expect(passwordProblem("x".repeat(201))).toMatch(/at most/);
    expect(passwordProblem("me@example.com", " ME@example.com ")).toMatch(/email/);
    expect(passwordProblem("plum-ferry-41-orbit")).toBeNull();
  });
});

describe("session tokens", () => {
  const now = Date.UTC(2026, 9, 1);

  it("round-trips the user id with issued-at and a 7-day expiry", () => {
    const token = signSession(42, SECRET, now);
    const s = verifySession(token, SECRET, now + 1000);
    expect(s).toEqual({ uid: 42, iat: now / 1000, exp: now / 1000 + SESSION_TTL_SECONDS });
    expect(SESSION_TTL_SECONDS).toBe(7 * 24 * 3600);
  });

  it("rejects a token signed with another secret", () => {
    expect(verifySession(signSession(42, SECRET, now), "another-secret-0123456789-abcdefghijk", now)).toBeNull();
  });

  it("rejects tampered payloads and signatures", () => {
    const token = signSession(42, SECRET, now);
    const [body, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ uid: 1, iat: now / 1000, exp: now / 1000 + 999 })).toString("base64url");
    expect(verifySession(`${forged}.${sig}`, SECRET, now)).toBeNull();
    const flipped = (sig[5] === "A" ? "B" : "A");
    expect(verifySession(`${body}.${sig.slice(0, 5)}${flipped}${sig.slice(6)}`, SECRET, now)).toBeNull();
    // Same bytes, different spelling (spare bits in the last base64url character).
    const last = sig.at(-1)!;
    const alias = "AEIMQUYcgkosw048".includes(last) ? String.fromCharCode(last.charCodeAt(0) + 1) : null;
    if (alias) expect(verifySession(`${body}.${sig.slice(0, -1)}${alias}`, SECRET, now)).toBeNull();
    expect(verifySession(`${body}.`, SECRET, now)).toBeNull();
    expect(verifySession(body, SECRET, now)).toBeNull();
    expect(verifySession("", SECRET, now)).toBeNull();
    expect(verifySession(undefined, SECRET, now)).toBeNull();
  });

  it("rejects expired tokens", () => {
    const token = signSession(42, SECRET, now);
    expect(verifySession(token, SECRET, now + (SESSION_TTL_SECONDS - 1) * 1000)).not.toBeNull();
    expect(verifySession(token, SECRET, now + SESSION_TTL_SECONDS * 1000)).toBeNull();
  });

  it("requires AUTH_SECRET", () => {
    const saved = process.env.AUTH_SECRET;
    try {
      delete process.env.AUTH_SECRET;
      expect(() => getAuthSecret()).toThrow(/AUTH_SECRET/);
      process.env.AUTH_SECRET = "too-short";
      expect(() => getAuthSecret()).toThrow(/AUTH_SECRET/);
      process.env.AUTH_SECRET = SECRET;
      expect(getAuthSecret()).toBe(SECRET);
    } finally {
      if (saved === undefined) delete process.env.AUTH_SECRET;
      else process.env.AUTH_SECRET = saved;
    }
  });
});

describe("safe next paths", () => {
  it("keeps same-origin relative paths", () => {
    expect(safeNextPath("/queue")).toBe("/queue");
    expect(safeNextPath("/submissions/12?tab=diff#f3")).toBe("/submissions/12?tab=diff#f3");
  });

  it("rejects anything that could leave the site or loop", () => {
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "\\\\evil", "evil", "javascript:alert(1)", "/login", "/signup?x=1", "/invite/abc", null, undefined, 3]) {
      expect(safeNextPath(bad)).toBeNull();
    }
    expect(safeNextPath("/\tqueue")).toBeNull();
  });
});

describe("throttling helpers", () => {
  it("blocks at the email or IP failure limit", () => {
    expect(isThrottled({ emailFailures: MAX_EMAIL_FAILURES - 1, ipFailures: 0 })).toBe(false);
    expect(isThrottled({ emailFailures: MAX_EMAIL_FAILURES, ipFailures: 0 })).toBe(true);
    expect(isThrottled({ emailFailures: 0, ipFailures: MAX_IP_FAILURES - 1 })).toBe(false);
    expect(isThrottled({ emailFailures: 0, ipFailures: MAX_IP_FAILURES })).toBe(true);
  });

  it("normalizes emails and reads the client IP", () => {
    expect(normalizeEmail("  Jane.Doe@Example.COM ")).toBe("jane.doe@example.com");
    const h = (m: Record<string, string>) => ({ get: (k: string) => m[k] ?? null });
    expect(clientIp(h({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
    expect(clientIp(h({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientIp(h({}))).toBeNull();
  });
});

describe("invite tokens", () => {
  it("are 32 random bytes in base64url, stored only as sha256", () => {
    const a = generateInviteToken();
    const b = generateInviteToken();
    expect(a.token).not.toBe(b.token);
    expect(Buffer.from(a.token, "base64url")).toHaveLength(32);
    expect(looksLikeInviteToken(a.token)).toBe(true);
    expect(a.tokenHash).toBe(hashInviteToken(a.token));
    expect(a.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(looksLikeInviteToken("short")).toBe(false);
  });

  it("report used, expired and valid states", () => {
    const now = Date.now();
    expect(inviteState({ expiresAt: new Date(now + 1000), usedAt: null }, now)).toBe("valid");
    expect(inviteState({ expiresAt: new Date(now - 1), usedAt: null }, now)).toBe("expired");
    expect(inviteState({ expiresAt: new Date(now + 1000), usedAt: new Date(now) }, now)).toBe("used");
  });
});
