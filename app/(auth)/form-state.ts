/** Shared by the auth server actions and their forms (kept out of actions.ts, which may only export async functions). */
export interface AuthFormState {
  error?: string;
  fieldErrors?: Partial<Record<string, string>>;
  /** Echo of non-secret inputs so a failed submit does not clear the form. */
  values?: Record<string, string>;
}

export const EMPTY_FORM_STATE: AuthFormState = {};

export const COMPANY_TYPES = [
  "Comparison site",
  "Credit card review site",
  "Personal finance blogger",
  "Lead-gen network",
  "Social media influencer",
  "Newsletter publisher",
  "Other",
] as const;

export const NEW_PARTNER = "new";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emailProblem(email: string): string | null {
  if (!email) return "Enter your email address.";
  if (email.length > 254 || !EMAIL_RE.test(email)) return "Enter a valid email address, like name@company.com.";
  return null;
}

export function nameProblem(name: string): string | null {
  if (!name) return "Enter your name.";
  if (name.length > 100) return "Use at most 100 characters.";
  return null;
}
