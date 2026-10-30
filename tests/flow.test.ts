import { describe, expect, it } from "vitest";
import { approvalBlockers, computeDueAt, slaState } from "@/lib/workflow/flow";

const t0 = new Date("2026-10-01T12:00:00Z");

describe("SLA", () => {
  it("gives 72h standard, 24h expedited, and the shorter window on resubmission", () => {
    expect(computeDueAt(t0, "standard", false).toISOString()).toBe("2026-10-04T12:00:00.000Z");
    expect(computeDueAt(t0, "expedited", false).toISOString()).toBe("2026-10-02T12:00:00.000Z");
    expect(computeDueAt(t0, "standard", true).toISOString()).toBe("2026-10-02T12:00:00.000Z");
  });
  it("only runs while compliance holds the item", () => {
    const due = new Date(t0.getTime() + 10 * 3_600_000);
    expect(slaState("submitted", due, t0)).toBe("due_soon");
    expect(slaState("in_review", due, new Date(t0.getTime() - 20 * 3_600_000))).toBe("on_track");
    expect(slaState("in_review", due, new Date(t0.getTime() + 11 * 3_600_000))).toBe("overdue");
    expect(slaState("changes_requested", due, t0)).toBe("not_applicable");
    expect(slaState("approved", due, t0)).toBe("not_applicable");
  });
});

describe("approvalBlockers", () => {
  it("counts open and accepted high-severity findings only", () => {
    expect(
      approvalBlockers([
        { severity: "high", status: "open" },
        { severity: "high", status: "dismissed" },
        { severity: "medium", status: "open" },
        { severity: "high", status: "accepted" },
      ]),
    ).toBe(2);
  });
});
