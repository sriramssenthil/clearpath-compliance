"use server";

import { getCurrentUser } from "@/lib/auth";
import { seedVariantsDemo } from "@/lib/seed/variants-demo";
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
    // The reset wipes every submission, including real users'. A demo persona is shared by anyone, so it may not.
    const me = await getCurrentUser();
    if (!me || me.isDemo) throw new WorkflowError("Resetting wipes all submissions, so it needs a real (non-demo) lead account.", "forbidden");
    await seedReference();
    const counts = await resetDemoData();
    await seedVariantsDemo();
    return counts;
  });
  if (result.ok) revalidatePath("/", "layout");
  return result;
}
