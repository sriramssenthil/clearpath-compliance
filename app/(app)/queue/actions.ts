"use server";

import { revalidatePath } from "next/cache";
import { claim } from "@/lib/workflow/service";
import { currentActor, toResult } from "@/lib/workflow/action-helpers";

export async function claimAction(submissionId: number) {
  const actor = await currentActor();
  const result = await toResult(() => claim(actor, submissionId));
  // Also on failure: a stale list is the usual reason a claim fails.
  revalidatePath("/queue");
  revalidatePath("/submissions");
  revalidatePath(`/submissions/${submissionId}`);
  return result;
}
