import { describe, expect, it } from "vitest";
import { diffWordsWithSpace } from "diff";
import { buildSegments, normalizeRange, selectionToRange, unlocatedIds } from "@/components/review/segments";
import { countWords, diffStats, diffSummary } from "@/components/review/diff-stats";
import { summarizeAuditDetails } from "@/components/review/audit-summary";
import { formatDateTime, plural, relativeTime, slaBadge } from "@/components/review/format";

const join = (segs: { text: string }[]) => segs.map((s) => s.text).join("");

describe("buildSegments", () => {
  it("returns no segments for empty content", () => {
    expect(buildSegments("", [{ id: 1, start: 0, end: 3 }])).toEqual([]);
  });

  it("returns one plain segment when there are no usable marks", () => {
    const segs = buildSegments("hello world", [{ id: 1, start: null, end: null }]);
    expect(segs).toEqual([{ text: "hello world", start: 0, end: 11, ids: [] }]);
  });

  it("splits around a single mark and reproduces the content", () => {
    const content = "Get approved today with no credit check.";
    const start = content.indexOf("no credit check");
    const segs = buildSegments(content, [{ id: 7, start, end: start + 15 }]);
    expect(join(segs)).toBe(content);
    expect(segs.map((s) => s.ids)).toEqual([[], [7], []]);
    expect(segs[1].text).toBe("no credit check");
  });

  it("handles partially overlapping marks", () => {
    const content = "0123456789";
    const segs = buildSegments(content, [
      { id: 1, start: 0, end: 6 },
      { id: 2, start: 4, end: 9 },
    ]);
    expect(join(segs)).toBe(content);
    expect(segs.map((s) => [s.text, s.ids])).toEqual([
      ["0123", [1]],
      ["45", [2, 1]],
      ["678", [2]],
      ["9", []],
    ]);
  });

  it("lists the innermost finding first for nested marks", () => {
    const segs = buildSegments("abcdefghij", [
      { id: 1, start: 0, end: 10 },
      { id: 2, start: 3, end: 6 },
    ]);
    const inner = segs.find((s) => s.text === "def");
    expect(inner?.ids).toEqual([2, 1]);
  });

  it("handles identical and adjacent ranges", () => {
    const segs = buildSegments("aaabbb", [
      { id: 1, start: 0, end: 3 },
      { id: 2, start: 0, end: 3 },
      { id: 3, start: 3, end: 6 },
    ]);
    expect(segs).toHaveLength(2);
    expect(segs[0].ids.sort()).toEqual([1, 2]);
    expect(segs[1].ids).toEqual([3]);
  });

  it("ignores null, inverted, empty and out-of-bounds offsets safely", () => {
    const content = "short";
    const marks = [
      { id: 1, start: null, end: 3 },
      { id: 2, start: 4, end: 2 },
      { id: 3, start: 2, end: 2 },
      { id: 4, start: 99, end: 120 },
      { id: 5, start: -5, end: 2 },
      { id: 6, start: 3, end: 500 },
    ];
    const segs = buildSegments(content, marks);
    expect(join(segs)).toBe(content);
    expect(unlocatedIds(content, marks)).toEqual([1, 2, 3, 4]);
    expect(segs[0].ids).toEqual([5]);
    expect(segs[segs.length - 1].ids).toEqual([6]);
  });

  it("preserves whitespace, newlines and keeps surrogate pairs whole", () => {
    const content = "Line one\n\n  Rate: 5% \u{1F600} fixed\tterm";
    const emoji = content.indexOf("\u{1F600}");
    // end offset lands in the middle of the surrogate pair
    const segs = buildSegments(content, [{ id: 1, start: emoji - 1, end: emoji + 1 }]);
    expect(join(segs)).toBe(content);
    for (const s of segs) expect(s.text).not.toMatch(/[\ud800-\udbff]$|^[\udc00-\udfff]/);
  });

  it("works with combining and non-latin characters", () => {
    const content = "Pré-approved — 低利率 offer";
    const start = content.indexOf("低");
    const segs = buildSegments(content, [{ id: 1, start, end: start + 3 }]);
    expect(segs.find((s) => s.ids.length)?.text).toBe("低利率");
  });
});

describe("normalizeRange / selectionToRange", () => {
  it("normalizes and rejects", () => {
    expect(normalizeRange("abcdef", 1, 3)).toEqual({ start: 1, end: 3 });
    expect(normalizeRange("abcdef", 3, 3)).toBeNull();
    expect(normalizeRange("abcdef", null, 3)).toBeNull();
    expect(normalizeRange("abcdef", NaN, 3)).toBeNull();
  });

  it("trims a selection and returns offsets of the trimmed text", () => {
    const content = "say  hello there";
    expect(selectionToRange(content, 3, 10)).toEqual({ start: 5, end: 10, text: "hello" });
    expect(selectionToRange(content, 10, 3)).toEqual({ start: 5, end: 10, text: "hello" });
    expect(selectionToRange(content, 3, 5)).toBeNull();
  });
});

describe("diff stats", () => {
  it("counts words added, removed and unchanged", () => {
    const parts = diffWordsWithSpace("Get a loan today with guaranteed approval", "Get a loan today. Rates vary.");
    const s = diffStats(parts);
    expect(s.added).toBeGreaterThan(0);
    expect(s.removed).toBeGreaterThan(0);
    expect(s.unchanged).toBeGreaterThanOrEqual(3);
  });

  it("counts words ignoring whitespace runs", () => {
    expect(countWords("  one   two\nthree ")).toBe(3);
    expect(countWords("   ")).toBe(0);
  });

  it("describes the change with correct pluralization", () => {
    expect(diffSummary({ added: 23, removed: 41, unchanged: 5 }, 3)).toBe("23 words added, 41 removed; 3 earlier findings resolved");
    expect(diffSummary({ added: 1, removed: 0, unchanged: 5 }, 1)).toBe("1 word added, 0 removed; 1 earlier finding resolved");
    expect(diffSummary({ added: 0, removed: 0, unchanged: 5 }, 0)).toBe("No text changes between these versions.");
  });
});

describe("summarizeAuditDetails", () => {
  it("summarizes finding events with rule, version and dismissal reason", () => {
    expect(summarizeAuditDetails("finding.dismissed", { ruleCode: "UDAAP-GUARANTEE", versionNumber: 2, reason: "Quoted in a warning" })).toBe(
      "UDAAP-GUARANTEE, version 2, reason: Quoted in a warning",
    );
    expect(summarizeAuditDetails("finding.accepted", { ruleCode: "REGZ-24-APR", versionNumber: 1, reason: null })).toBe("REGZ-24-APR, version 1");
  });

  it("summarizes decisions with the note", () => {
    expect(summarizeAuditDetails("decision.changes_requested", { versionNumber: 1, acceptedFindings: 2, note: "Add APR" })).toBe(
      "Version 1, 2 confirmed findings, note: Add APR",
    );
    expect(summarizeAuditDetails("decision.approved", { versionNumber: 2, acceptedFindings: 0, note: null })).toBe("Version 2, 0 confirmed findings");
  });

  it("summarizes analysis, resubmission and resolution", () => {
    expect(summarizeAuditDetails("analysis.completed", { versionNumber: 1, findings: 1, status: "rules_only", model: null })).toBe(
      "Version 1, 1 finding, rules only, AI unavailable",
    );
    expect(summarizeAuditDetails("submission.resubmitted", { versionNumber: 2, resolvedFindings: 3 })).toBe("Version 2, 3 earlier findings resolved");
    expect(summarizeAuditDetails("finding.resolved", { ruleCode: "FCRA-PREQUAL", fromVersion: 1, toVersion: 2 })).toBe(
      "FCRA-PREQUAL, no longer raised in version 2, was open in version 1",
    );
  });

  it("describes claims and tolerates empty or unexpected details", () => {
    expect(summarizeAuditDetails("submission.claimed", { automatic: true })).toBe("Claimed automatically when a finding was actioned");
    expect(summarizeAuditDetails("submission.withdrawn", {})).toBe("");
    expect(summarizeAuditDetails("something.new", { ruleCode: "X-1", note: "hi" })).toBe("X-1, note: hi");
    expect(summarizeAuditDetails("finding.added", null)).toBe("");
    expect(summarizeAuditDetails("finding.accepted", { ruleCode: 5, versionNumber: "2" })).toBe("");
  });
});

describe("format helpers", () => {
  const now = new Date("2026-10-29T12:00:00Z");
  it("formats relative time", () => {
    expect(relativeTime(new Date("2026-10-29T11:59:50Z"), now)).toBe("just now");
    expect(relativeTime(new Date("2026-10-29T10:00:00Z"), now)).toBe("2 hours ago");
    expect(relativeTime(new Date("2026-10-27T12:00:00Z"), now)).toBe("2 days ago");
    expect(relativeTime(new Date("2026-10-30T12:00:00Z"), now)).toBe("tomorrow");
  });
  it("formats absolute time in UTC", () => {
    expect(formatDateTime(new Date("2026-10-29T15:04:00Z"))).toBe("Oct 29, 2026, 3:04 PM UTC");
  });
  it("builds SLA badges only while compliance holds the ball", () => {
    expect(slaBadge("not_applicable", null, now)).toBeNull();
    expect(slaBadge("overdue", new Date("2026-10-29T08:00:00Z"), now)?.label).toBe("Overdue");
    expect(slaBadge("due_soon", new Date("2026-10-29T14:30:00Z"), now)?.label).toBe("Due in 3h");
    expect(slaBadge("on_track", new Date("2026-11-01T12:00:00Z"), now)?.tone).toBe("success");
  });
  it("pluralizes", () => {
    expect(plural(1, "finding")).toBe("1 finding");
    expect(plural(2, "finding")).toBe("2 findings");
  });
});
