import { describe, expect, it } from "vitest";
import { selectAiRules, selectRules } from "@/lib/compliance/applicable";
import type { AssetContext, RuleDef } from "@/lib/compliance/types";

const base = {
  title: "t", description: "d", category: "c", severity: "high" as const, products: [], channels: [],
  checkInstruction: "i", citation: "c", guidance: "g", enabled: true,
};
const ca: RuleDef = { ...base, code: "CA", kind: "required", aiReview: false,
  config: { type: "required", statesAny: ["CA"], satisfiedBy: ["license"], issue: "x" } };
const apr: RuleDef = { ...base, code: "APR", kind: "required",
  config: { type: "required", satisfiedBy: ["APR"], issue: "x" } };
const ctx = (over: Partial<AssetContext> = {}): AssetContext => ({
  product: "personal_loan", channel: "email", states: [], content: "Fast cash.", isAffiliate: false, ...over,
});

describe("selectRules", () => {
  it("skips state-limited rules unless the asset targets that state", () => {
    expect(selectRules(ctx(), [ca, apr]).map((r) => r.code)).toEqual(["APR"]);
    expect(selectRules(ctx({ states: ["CA"] }), [ca, apr]).map((r) => r.code)).toEqual(["CA", "APR"]);
    expect(selectRules(ctx({ content: "Fast cash, 400 Market St, San Francisco, CA 94111" }), [ca]).length).toBe(0);
  });
});

describe("selectAiRules", () => {
  it("leaves presence-only rules to code", () => {
    expect(selectAiRules(ctx({ states: ["CA"] }), [ca, apr]).map((r) => r.code)).toEqual(["APR"]);
  });
});
