"use server";

import { revalidatePath } from "next/cache";
import { currentActor, toResult } from "@/lib/workflow/action-helpers";
import { WorkflowError } from "@/lib/workflow/types";
import { seedReference } from "@/lib/seed/reference";
import { resetDemoData } from "@/lib/seed/history";

/** Lead-only. Restores reference data (rules, product facts) and regenerates the sample history. */
export async function resetDemoAction() {
  const actor = await currentActor();
  const result = await toResult(async () => {
    if (actor.role !== "lead") throw new WorkflowError("Only the compliance lead can reset the demo data.", "forbidden");
    await seedReference();
    return resetDemoData();
  });
  if (result.ok) revalidatePath("/", "layout");
  return result;
}
