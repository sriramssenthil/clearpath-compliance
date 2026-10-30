import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";
import { PASSWORD_MAX_LENGTH } from "./password-rules";

export { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, passwordProblem } from "./password-rules";

/*
 * Password hashing with scrypt (node:crypto, no dependency). Stored as
 * `scrypt$N$r$p$saltHex$hashHex` so the cost parameters can be raised later without breaking
 * existing hashes: verification always uses the parameters recorded in the hash itself.
 */

const PARAMS = { N: 16384, r: 8, p: 1 } as const;
const KEY_LENGTH = 64;
const SALT_BYTES = 16;

function scryptAsync(password: string, salt: Buffer, keylen: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // maxmem must cover 128 * N * r bytes, or larger future parameters would throw.
    scrypt(password, salt, keylen, { ...options, maxmem: 256 * options.N! * options.r! + 1024 * 1024 }, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await scryptAsync(password, salt, KEY_LENGTH, PARAMS);
  return ["scrypt", PARAMS.N, PARAMS.r, PARAMS.p, salt.toString("hex"), key.toString("hex")].join("$");
}

/** Timing-safe check of a password against a stored hash. Malformed hashes never match. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [N, r, p] = parts.slice(1, 4).map(Number);
  const [saltHex, hashHex] = parts.slice(4);
  if (![N, r, p].every((n) => Number.isInteger(n) && n > 0) || !/^[0-9a-f]+$/.test(saltHex) || !/^[0-9a-f]+$/.test(hashHex)) return false;
  // Guard against absurd parameters in a tampered row eating CPU and memory.
  if (N > 2 ** 20 || r > 32 || p > 16) return false;
  const expected = Buffer.from(hashHex, "hex");
  if (expected.length === 0 || password.length > PASSWORD_MAX_LENGTH) return false;
  const actual = await scryptAsync(password, Buffer.from(saltHex, "hex"), expected.length, { N, r, p });
  return timingSafeEqual(actual, expected);
}

// A real hash of a random string, verified against when the email is unknown so that response
// time does not reveal whether an account exists.
let dummyHash: Promise<string> | undefined;
export function dummyPasswordHash(): Promise<string> {
  dummyHash ??= hashPassword(randomBytes(16).toString("hex"));
  return dummyHash;
}
