"use server";

import { revalidatePath } from "next/cache";
import { updateRule } from "@/lib/workflow/service";
import { currentActor, toResult } from "@/lib/workflow/action-helpers";

export interface RulePatch {
  enabled?: boolean;
  severity?: "high" | "medium" | "low";
  description?: string;
  guidance?: string;
  checkInstruction?: string;
}

/** Lead-only (enforced by the service). Every edit bumps the rule's version and writes an audit event. */
export async function updateRuleAction(code: string, patch: RulePatch) {
  const actor = await currentActor();
  const result = await toResult(() => updateRule(actor, code, patch));
  revalidatePath("/rules");
  return result;
}
