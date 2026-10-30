/** Password policy. No server imports, so client forms can show the same limits. */

export const PASSWORD_MIN_LENGTH = 10;
// Long inputs make every scrypt call more expensive; nobody needs more than this.
export const PASSWORD_MAX_LENGTH = 200;

const DENYLIST = new Set([
  "password",
  "password1",
  "password12",
  "password123",
  "password1234",
  "passw0rd123",
  "1234567890",
  "12345678910",
  "0123456789",
  "qwertyuiop",
  "qwerty12345",
  "1q2w3e4r5t",
  "letmein123",
  "iloveyou123",
  "welcome123",
  "welcome1234",
  "admin12345",
  "changeme123",
  "abc1234567",
  "aaaaaaaaaa",
  "clearpath123",
  "clearpath1",
  "compliance1",
  "compliance123",
]);

/** A human-readable reason the password is not acceptable, or null when it is. */
export function passwordProblem(password: string, email?: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (password.length > PASSWORD_MAX_LENGTH) return `Use at most ${PASSWORD_MAX_LENGTH} characters.`;
  const lower = password.toLowerCase();
  if (DENYLIST.has(lower) || /^(.)\1+$/.test(password)) return "That password is too easy to guess. Choose something less common.";
  if (email && lower === email.trim().toLowerCase()) return "Do not use your email address as your password.";
  return null;
}
