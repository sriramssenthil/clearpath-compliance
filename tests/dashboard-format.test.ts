import { describe, expect, it } from "vitest";
import {
  agreementRate, formatHours, formatPercent, formatWeekLabel, niceMax, niceTicks, NO_DATA, percentOf, stackSegments,
} from "@/components/dashboard/format";
import { deadlineCell, formatDurationShort, isFastLane, relativeTime, slaLabel } from "@/components/queue/sla-label";
import { activeFilterCount, parseQueueView, queueHref, queueStats, toQueueFilters } from "@/components/queue/params";

describe("formatHours", () => {
  it("handles null", () => expect(formatHours(null)).toBe(NO_DATA));
  it("uses minutes, hours then days", () => {
    expect(formatHours(0.25)).toBe("15 minutes");
    expect(formatHours(1)).toBe("1 hour");
    expect(formatHours(7)).toBe("7 hours");
    expect(formatHours(23.7)).toBe("1 day");
    expect(formatHours(38.4)).toBe("1.6 days");
    expect(formatHours(72)).toBe("3.0 days");
  });
});

describe("percent and agreement", () => {
  it("formats ratios and null", () => {
    expect(formatPercent(0.876)).toBe("88%");
    expect(formatPercent(0)).toBe("0%");
    expect(formatPercent(null)).toBe(NO_DATA);
    expect(formatPercent(null, "n/a")).toBe("n/a");
  });
  it("computes agreement as accepted over judged", () => {
    expect(agreementRate(3, 1)).toBe(0.75);
    expect(agreementRate(0, 0)).toBeNull();
    expect(agreementRate(0, 4)).toBe(0);
  });
  it("labels week starts", () => expect(formatWeekLabel("2026-09-08")).toBe("Sep 8"));
});

describe("chart scales", () => {
  it("rounds the axis up to a nice number", () => {
    expect(niceMax(0)).toBe(5);
    expect(niceMax(7)).toBe(10);
    expect(niceMax(13)).toBe(20);
    expect(niceMax(21)).toBe(50);
    expect(niceMax(120)).toBe(200);
  });
  it("builds whole-number ticks from zero to the max", () => {
    expect(niceTicks(0)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(niceTicks(7)).toEqual([0, 2, 4, 6, 8, 10]);
    for (const t of niceTicks(37)) expect(Number.isInteger(t)).toBe(true);
    expect(niceTicks(37).at(-1)).toBe(50);
  });
  it("clamps percentages", () => {
    expect(percentOf(5, 10)).toBe(50);
    expect(percentOf(20, 10)).toBe(100);
    expect(percentOf(1, 0)).toBe(0);
  });
  it("stacks segments from the baseline", () => {
    const s = stackSegments([{ key: "a", value: 2 }, { key: "b", value: 3 }, { key: "c", value: 0 }], 10);
    expect(s.map((x) => [x.heightPct, x.bottomPct])).toEqual([[20, 0], [30, 20], [0, 50]]);
  });
});

describe("SLA labels", () => {
  const now = new Date("2026-10-27T15:00:00Z"); // Tuesday 10am Central
  const at = (h: number) => new Date(now.getTime() + h * 3_600_000);

  it("shortens durations to the largest whole unit", () => {
    expect(formatDurationShort(10 * 60_000)).toBe("10m");
    expect(formatDurationShort(-6 * 3_600_000)).toBe("6h");
    expect(formatDurationShort(47 * 3_600_000)).toBe("47h");
    expect(formatDurationShort(72 * 3_600_000)).toBe("3d");
    expect(formatDurationShort(5_000)).toBe("1m");
  });
  it("labels overdue, due soon and later deadlines", () => {
    expect(slaLabel("overdue", at(-6), now)).toEqual({ text: "Overdue by 6h", tone: "danger" });
    expect(slaLabel("due_soon", at(5), now)).toEqual({ text: "Due in 5h", tone: "warning" });
    expect(slaLabel("on_track", at(30), now)).toEqual({ text: "Due Wed 4pm", tone: "neutral" });
    expect(slaLabel("on_track", at(29), now)?.text).toBe("Due Wed 3pm");
    expect(slaLabel("not_applicable", at(5), now)).toBeNull();
    expect(slaLabel("on_track", null, now)).toBeNull();
  });
  it("uses a date once the deadline is more than a few days out", () => {
    expect(slaLabel("on_track", at(24 * 9), now)?.text).toBe("Due Nov 5, 9am");
  });
  it("explains non-compliance statuses in the deadline cell", () => {
    const base = { sla: "not_applicable" as const, dueAt: null, decidedAt: null };
    expect(deadlineCell({ ...base, status: "changes_requested" }, now).text).toBe("Waiting on submitter");
    expect(deadlineCell({ ...base, status: "approved", decidedAt: at(-48) }, now).text).toBe("Approved 2 days ago");
    expect(deadlineCell({ ...base, status: "withdrawn" }, now).text).toBe("Withdrawn");
  });
  it("marks the fast lane only for low risk, nothing open, and compliance holding the item", () => {
    expect(isFastLane({ status: "submitted", riskLevel: "low", openFindings: 0 })).toBe(true);
    expect(isFastLane({ status: "submitted", riskLevel: "low", openFindings: 1 })).toBe(false);
    expect(isFastLane({ status: "in_review", riskLevel: "medium", openFindings: 0 })).toBe(false);
    expect(isFastLane({ status: "approved", riskLevel: "low", openFindings: 0 })).toBe(false);
  });
  it("renders relative time", () => {
    expect(relativeTime(at(-0.01), now)).toBe("just now");
    expect(relativeTime(at(-1), now)).toBe("1 hour ago");
    expect(relativeTime(at(-5), now)).toBe("5 hours ago");
    expect(relativeTime(at(-72), now)).toBe("3 days ago");
  });
});

describe("queue params", () => {
  it("defaults to needs review and ignores junk", () => {
    const v = parseQueueView({ status: "bogus", risk: "extreme", partner: "abc", product: "boat" });
    expect(v).toMatchObject({ status: "needs_review", assignee: "all", risk: "", product: "", partner: null });
    expect(toQueueFilters(v).status).toEqual(["submitted", "in_review"]);
  });
  it("round-trips a filtered view into a short URL", () => {
    const v = parseQueueView({ status: "all", partner: "4", assignee: "unassigned", q: " CP-10 " });
    expect(activeFilterCount(v)).toBe(3);
    expect(queueHref(v)).toBe("/queue?status=all&assignee=unassigned&partner=4&q=CP-10");
    expect(queueHref({})).toBe("/queue");
    expect(toQueueFilters(v)).toMatchObject({ partnerId: 4, assignee: "unassigned", q: "CP-10" });
  });
  it("counts the queue stats from open items only", () => {
    const s = queueStats([
      { status: "submitted", sla: "overdue", assigneeId: null },
      { status: "in_review", sla: "due_soon", assigneeId: 1 },
      { status: "approved", sla: "not_applicable", assigneeId: null },
    ]);
    expect(s).toEqual({ open: 2, overdue: 1, dueSoon: 1, unassigned: 1 });
  });
});

import { describeConfig, detectionLabel, usageText } from "@/components/rules/rule-meta";

describe("rule meta", () => {
  it("derives the detection label from kind and aiReview", () => {
    expect(detectionLabel("ai", true)).toBe("AI-assisted");
    expect(detectionLabel("phrase", false)).toBe("Pattern rule");
    expect(detectionLabel("required", true)).toBe("Pattern and AI");
  });
  it("summarises config without dumping patterns", () => {
    expect(describeConfig({ type: "phrase", patterns: ["a", "b"], issue: "x" })).toBe("Flags any of 2 phrase patterns.");
    expect(describeConfig({ type: "required", satisfiedBy: ["a"], issue: "x", statesAny: ["CA"] })).toBe(
      "One of 1 required-text pattern must appear. Applies only for ads targeting CA.",
    );
    expect(describeConfig({ type: "none" })).toMatch(/AI reviewer only/);
  });
  it("words usage honestly", () => {
    expect(usageText({ total: 0, accepted: 0, dismissed: 0 })).toEqual({ fired: "Never fired", agreed: "No reviewer decisions yet" });
    expect(usageText({ total: 1, accepted: 3, dismissed: 1 })).toEqual({ fired: "Fired 1 time", agreed: "Reviewers agreed 75%" });
  });
});
