"use server";

import { revalidatePath } from "next/cache";
import { currentActor, toResult, type ActionResult } from "@/lib/workflow/action-helpers";
import type { Outcome } from "@/lib/workflow/flow";
import * as service from "@/lib/workflow/service";
import type { FindingAction } from "@/lib/workflow/service";

function refresh(submissionId: number) {
  revalidatePath(`/submissions/${submissionId}`);
  revalidatePath("/submissions");
  revalidatePath("/queue");
  revalidatePath("/dashboard");
}

// Ids arrive from the browser: validate shape here, authorization is the service's job.
const validId = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n > 0;
const bad = (msg: string): ActionResult<never> => ({ ok: false, error: msg });

export async function findingAction(findingId: number, act: FindingAction, submissionId: number): Promise<ActionResult<void>> {
  if (!validId(findingId) || !validId(submissionId)) return bad("Invalid request.");
  const actor = await currentActor();
  const res = await toResult(() => service.actOnFinding(actor, findingId, act));
  refresh(submissionId);
  return res;
}

export async function addReviewerFindingAction(
  submissionId: number,
  input: { ruleCode: string; quote: string; issue: string; suggestion?: string | null },
): Promise<ActionResult<void>> {
  if (!validId(submissionId)) return bad("Invalid request.");
  const actor = await currentActor();
  const res = await toResult(() => service.addReviewerFinding(actor, submissionId, input));
  refresh(submissionId);
  return res;
}

export async function decideAction(
  submissionId: number,
  input: { outcome: Outcome; note?: string | null },
): Promise<ActionResult<{ feedbackDraft: string | null }>> {
  if (!validId(submissionId)) return bad("Invalid request.");
  const actor = await currentActor();
  const res = await toResult(() => service.decide(actor, submissionId, input));
  refresh(submissionId);
  return res;
}

export async function claimAction(submissionId: number): Promise<ActionResult<void>> {
  if (!validId(submissionId)) return bad("Invalid request.");
  const actor = await currentActor();
  const res = await toResult(() => service.claim(actor, submissionId));
  refresh(submissionId);
  return res;
}

export async function withdrawAction(submissionId: number): Promise<ActionResult<void>> {
  if (!validId(submissionId)) return bad("Invalid request.");
  const actor = await currentActor();
  const res = await toResult(() => service.withdraw(actor, submissionId));
  refresh(submissionId);
  return res;
}

/** Bulk-approve fast-track variants of an approved master. Eligibility is re-checked on the server. */
export async function approveVariantsAction(masterId: number, ids: number[]): Promise<{ ok: boolean; error?: string; approved?: number }> {
  if (!validId(masterId) || !Array.isArray(ids) || !ids.every(validId) || ids.length > 200) return { ok: false, error: "Invalid request." };
  const actor = await currentActor();
  const { approveVariants } = await import("@/lib/workflow/variants");
  const res = await toResult(() => approveVariants(actor, masterId, ids));
  refresh(masterId);
  for (const id of ids) revalidatePath(`/submissions/${id}`);
  if (!res.ok) return { ok: false, error: res.error };
  return res.data.skipped > 0
    ? { ok: true, approved: res.data.approved, error: `${res.data.skipped} could not be approved: no longer eligible.` }
    : { ok: true, approved: res.data.approved };
}
