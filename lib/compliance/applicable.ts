import { stateApplies } from "./states";
import type { AssetContext, RuleDef } from "./types";

/**
 * Rules that apply to this asset: enabled, in scope for its product and channel, and, for rules
 * limited to particular states, only when the asset targets one of them. Shared by the
 * deterministic runner and the Claude prompt builder so both layers agree on scope.
 */
export function selectRules(ctx: AssetContext, rules: RuleDef[]): RuleDef[] {
  return rules.filter(
    (r) =>
      r.enabled &&
      (r.products.length === 0 || r.products.includes(ctx.product)) &&
      (r.channels.length === 0 || r.channels.includes(ctx.channel)) &&
      (r.config.type !== "required" || stateApplies(ctx, r.config.statesAny)),
  );
}

/**
 * The subset Claude also reviews. Pure "is the disclosure present" rules are decided by code alone:
 * a regex can verify presence exactly, and the model second-guessing it only adds false alarms.
 */
export function selectAiRules(ctx: AssetContext, rules: RuleDef[]): RuleDef[] {
  return selectRules(ctx, rules).filter((r) => r.aiReview !== false);
}
