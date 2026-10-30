"use server";

import { revalidatePath } from "next/cache";
import { currentActor, toResult, type ActionResult } from "@/lib/workflow/action-helpers";
import { sizeProblem } from "@/lib/workflow/assets";
import { getDetail } from "@/lib/workflow/queries";
import * as service from "@/lib/workflow/service";
import { WorkflowError, type PrecheckInput, type PrecheckResult, type SubmissionInput } from "@/lib/workflow/types";

// Token usage and discarded AI proposals are server-side diagnostics; the browser does not need them.
const forBrowser = (r: PrecheckResult): PrecheckResult => ({ ...r, analysis: { ...r.analysis, droppedAi: [], usage: null } });

/** What to do with the file when submitting a new version. "keep" reuses the current version's file. */
export type FileMode = "keep" | "none" | "new";

/**
 * Files arrive as binary in a FormData field named "file" (base64 would add a third to the request
 * body). Returns null when there is no file. Size is checked before the bytes are read.
 */
async function readUpload(data: FormData | null | undefined): Promise<service.UploadInput | null> {
  const f = data?.get("file");
  if (!f || typeof f === "string") return null;
  const problem = sizeProblem(f.size, f.type);
  if (problem) throw new WorkflowError(problem, "invalid");
  return { bytes: new Uint8Array(await f.arrayBuffer()), filename: "name" in f && typeof f.name === "string" ? f.name : "upload" };
}

/** Pre-flight check for a draft. Stores nothing. */
export async function precheckAction(input: PrecheckInput, fileData: FormData | null = null): Promise<ActionResult<PrecheckResult>> {
  const actor = await currentActor();
  return toResult(async () => forBrowser(await service.precheck(actor, input, await readUpload(fileData))));
}

/** Pre-check for a new version of an existing submission: product, channel and states come from the record. */
export async function precheckForSubmissionAction(
  submissionId: number,
  content: string,
  fileMode: FileMode = "keep",
  fileData: FormData | null = null,
): Promise<ActionResult<PrecheckResult>> {
  const actor = await currentActor();
  return toResult(async () => {
    if (!Number.isInteger(submissionId)) throw new WorkflowError("Submission not found.", "not_found");
    const d = await getDetail(actor, submissionId);
    const current = d.versions.find((v) => v.number === d.currentVersion);
    const file =
      fileMode === "new" ? await readUpload(fileData) : fileMode === "keep" && current?.asset ? { assetId: current.asset.id } : null;
    return forBrowser(await service.precheck(actor, { product: d.product, channel: d.channel, states: d.states, content }, file));
  });
}

export async function createSubmissionAction(input: SubmissionInput, fileData: FormData | null = null): Promise<ActionResult<{ id: number; code: string }>> {
  const actor = await currentActor();
  const result = await toResult(async () => service.createSubmission(actor, input, await readUpload(fileData)));
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
  fileMode: FileMode = "keep",
  fileData: FormData | null = null,
): Promise<ActionResult<{ versionNumber: number; resolved: number }>> {
  const actor = await currentActor();
  const result = await toResult(async () => {
    if (!Number.isInteger(submissionId)) throw new WorkflowError("Submission not found.", "not_found");
    let choice: service.FileChoice = { kind: fileMode === "none" ? "none" : "keep" };
    if (fileMode === "new") {
      const upload = await readUpload(fileData);
      if (!upload) throw new WorkflowError("Attach the new file, or keep the previous one.", "invalid");
      choice = { kind: "new", upload };
    }
    return service.resubmit(actor, submissionId, { content }, choice);
  });
  if (result.ok) {
    revalidatePath("/submissions");
    revalidatePath(`/submissions/${submissionId}`);
    revalidatePath("/queue");
    revalidatePath("/dashboard");
  }
  return result;
}
