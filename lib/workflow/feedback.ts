import type { Outcome } from "./flow";

interface FeedbackInput {
  submissionCode: string;
  title: string;
  submitterFirstName: string;
  reviewerFirstName: string;
  outcome: Outcome;
  note: string | null;
  required: { ruleCode: string; ruleTitle: string; quote: string; issue: string; suggestion: string | null }[];
}

/** Plain-template feedback email. Deliberately not model-written: it only restates reviewer-confirmed findings. */
export function buildFeedbackDraft(i: FeedbackInput): string {
  const lines: string[] = [`Hi ${i.submitterFirstName},`, ""];
  if (i.outcome === "rejected") {
    lines.push(`We are not able to approve "${i.title}" (${i.submissionCode}).`);
  } else {
    lines.push(`Thanks for submitting "${i.title}" (${i.submissionCode}). Before it can run, please address the following:`);
  }
  if (i.note) lines.push("", i.note);
  if (i.required.length > 0) {
    lines.push("", i.outcome === "rejected" ? "What we found:" : "Required changes:");
    i.required.forEach((f, n) => {
      lines.push(`${n + 1}. ${f.ruleTitle} (${f.ruleCode})`, `   Text: "${f.quote}"`, `   Issue: ${f.issue}`);
      if (f.suggestion) lines.push(`   Suggested fix: ${f.suggestion}`);
    });
  }
  if (i.outcome === "changes_requested") lines.push("", "Submit a new version when ready and it will come back to me.");
  lines.push("", `Thanks,`, i.reviewerFirstName);
  return lines.join("\n");
}
