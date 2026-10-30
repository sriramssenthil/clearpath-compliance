import { describe, expect, it } from "vitest";
import { buildFeedbackDraft } from "@/lib/workflow/feedback";

const base = {
  submissionCode: "CP-1042",
  title: "Spring loan blog",
  submitterFirstName: "Jordan",
  reviewerFirstName: "Priya",
  note: null,
  required: [
    { ruleCode: "UDAAP-GUARANTEE", ruleTitle: "Guaranteed approval claims", quote: "Guaranteed approval", issue: "Absolute claim.", suggestion: "Say 'See if you qualify'." },
  ],
};

describe("buildFeedbackDraft", () => {
  it("lists reviewer-confirmed findings with quotes and fixes, addressed to the submitter", () => {
    const text = buildFeedbackDraft({ ...base, outcome: "changes_requested" });
    expect(text).toContain("Hi Jordan,");
    expect(text).toContain('Text: "Guaranteed approval"');
    expect(text).toContain("Suggested fix: Say 'See if you qualify'.");
    expect(text.trim().endsWith("Priya")).toBe(true);
    expect(text).toContain("Submit a new version");
  });
  it("uses rejection wording and omits the resubmit line", () => {
    const text = buildFeedbackDraft({ ...base, outcome: "rejected", note: "Repeated violations." });
    expect(text).toContain("not able to approve");
    expect(text).toContain("Repeated violations.");
    expect(text).not.toContain("Submit a new version");
  });
});
