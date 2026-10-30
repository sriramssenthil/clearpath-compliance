import { describe, expect, it } from "vitest";
import { RISK_THRESHOLDS, computeRisk, recommend } from "@/lib/compliance/risk";

const base = { product: "personal_loan", channel: "email", isAffiliate: false } as const;

describe("computeRisk", () => {
  it("scores findings 5/2/1 plus product", () => {
    expect(computeRisk([], base)).toEqual({ score: 1, level: "low" });
    expect(computeRisk([{ severity: "high" }], base)).toEqual({ score: 6, level: "medium" });
    expect(computeRisk([{ severity: "medium" }, { severity: "low" }], base).score).toBe(4);
  });

  it("adds product points", () => {
    expect(computeRisk([], { ...base, product: "credit_card" }).score).toBe(2);
    expect(computeRisk([], { ...base, product: "mortgage_prequal" }).score).toBe(3);
  });

  it("stacks affiliate and channel adders", () => {
    expect(computeRisk([], { ...base, isAffiliate: true }).score).toBe(3);
    expect(computeRisk([], { ...base, channel: "social" }).score).toBe(3);
    expect(computeRisk([], { ...base, channel: "sms" }).score).toBe(3);
    expect(computeRisk([], { ...base, channel: "affiliate_page" }).score).toBe(1);
    expect(computeRisk([], { ...base, isAffiliate: true, channel: "social" }).score).toBe(5);
  });

  it("adds partner rejection only above 0.30", () => {
    expect(computeRisk([], base, 0.3).score).toBe(1);
    expect(computeRisk([], base, 0.31).score).toBe(3);
    expect(computeRisk([], base, undefined).score).toBe(1);
  });

  it("applies level boundaries", () => {
    expect(RISK_THRESHOLDS).toEqual({ medium: 5, high: 10 });
    const at = (n: number) => computeRisk(Array(n).fill({ severity: "low" }), { ...base, product: "personal_loan" });
    expect(at(3)).toEqual({ score: 4, level: "low" });
    expect(at(4)).toEqual({ score: 5, level: "medium" });
    expect(at(8)).toEqual({ score: 9, level: "medium" });
    expect(at(9)).toEqual({ score: 10, level: "high" });
  });
});

describe("recommend", () => {
  it("is ready with no, one or two non-high findings", () => {
    expect(recommend([])).toBe("ready");
    expect(recommend([{ severity: "low" }, { severity: "medium" }])).toBe("ready");
  });
  it("needs changes for any high finding or 3+ findings", () => {
    expect(recommend([{ severity: "high" }])).toBe("needs_changes");
    expect(recommend([{ severity: "low" }, { severity: "low" }, { severity: "low" }])).toBe("needs_changes");
  });
});
