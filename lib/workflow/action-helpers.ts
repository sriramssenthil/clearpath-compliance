import { requireUser } from "@/lib/auth";
import { WorkflowError, type Actor } from "./types";

/** The signed-in demo user as the service layer's Actor. Redirects to the landing page when signed out. */
export async function currentActor(): Promise<Actor> {
  const u = await requireUser();
  return { id: u.id, name: u.name, role: u.role, partnerId: u.partnerId };
}

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Wraps a service call for use inside a server action: expected failures (validation, permissions,
 * stale state) become `{ ok: false, error }` for the UI to show; anything unexpected is logged and
 * reported generically so internals never leak to the browser.
 */
export async function toResult<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    if (err instanceof WorkflowError) return { ok: false, error: err.message };
    console.error("Unexpected workflow error:", err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
