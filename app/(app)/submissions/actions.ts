"use server";

import { revalidatePath } from "next/cache";
import { currentActor, toResult, type ActionResult } from "@/lib/workflow/action-helpers";
import { getDetail } from "@/lib/workflow/queries";
import * as service from "@/lib/workflow/service";
import { WorkflowError, type PrecheckInput, type PrecheckResult, type SubmissionInput } from "@/lib/workflow/types";

// Token usage and discarded AI proposals are server-side diagnostics; the browser does not need them.
const forBrowser = (r: PrecheckResult): PrecheckResult => ({ ...r, analysis: { ...r.analysis, droppedAi: [], usage: null } });

/** Pre-flight check for a draft. Stores nothing. */
export async function precheckAction(input: PrecheckInput): Promise<ActionResult<PrecheckResult>> {
  const actor = await currentActor();
  return toResult(async () => forBrowser(await service.precheck(actor, input)));
}

/** Pre-check for a new version of an existing submission: product, channel and states come from the record. */
export async function precheckForSubmissionAction(submissionId: number, content: string): Promise<ActionResult<PrecheckResult>> {
  const actor = await currentActor();
  return toResult(async () => {
    if (!Number.isInteger(submissionId)) throw new WorkflowError("Submission not found.", "not_found");
    const d = await getDetail(actor, submissionId);
    return forBrowser(await service.precheck(actor, { product: d.product, channel: d.channel, states: d.states, content }));
  });
}

export async function createSubmissionAction(input: SubmissionInput): Promise<ActionResult<{ id: number; code: string }>> {
  const actor = await currentActor();
  const result = await toResult(() => service.createSubmission(actor, input));
  if (result.ok) {
    revalidatePath("/submissions");
    revalidatePath("/queue");
    revalidatePath("/dashboard");
  }
  return result;
}

export async function resubmitAction(
  submissionId: number,
  content: string,
): Promise<ActionResult<{ versionNumber: number; resolved: number }>> {
  const actor = await currentActor();
  const result = await toResult(async () => {
    if (!Number.isInteger(submissionId)) throw new WorkflowError("Submission not found.", "not_found");
    return service.resubmit(actor, submissionId, { content });
  });
  if (result.ok) {
    revalidatePath("/submissions");
    revalidatePath(`/submissions/${submissionId}`);
    revalidatePath("/queue");
    revalidatePath("/dashboard");
  }
  return result;
}
