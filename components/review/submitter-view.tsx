import { Badge } from "@/components/ui/badge";
import { AssetViewer } from "./asset-viewer";
import type { SubmissionDetail } from "@/lib/workflow/types";
import { FeedbackEmail } from "./feedback-email";
import { feedbackSubject } from "./format";
import { StatusBanner } from "./status-banner";
import { SubmitterText } from "./submitter-text";
import type { FindingVM } from "./view-models";
import type { ReactNode } from "react";

/** What a marketer or affiliate sees: plain-language status, required changes, their text. No reviewer controls, no dismissed findings. */
export function SubmitterView({ detail, now, viewedNumber, findings, latestFindings, diffSlot }: {
  detail: SubmissionDetail;
  now: Date;
  viewedNumber: number;
  /** Findings of the viewed version, dismissed already removed. */
  findings: FindingVM[];
  latestFindings: FindingVM[];
  diffSlot: ReactNode | null;
}) {
  const viewed = detail.versions.find((v) => v.number === viewedNumber)!;
  const feedbackDecision = detail.status === "changes_requested" || detail.status === "rejected" ? detail.decisions.findLast((d) => d.feedbackDraft) : undefined;
  const required = detail.status === "changes_requested" ? latestFindings.filter((f) => f.status === "accepted") : [];

  return (
    <div className="space-y-6">
      <StatusBanner detail={detail} audience="submitter" now={now} />

      {detail.status === "changes_requested" ? (
        <section aria-labelledby="required-heading" className="rounded-lg border border-border bg-surface shadow-card">
          <div className="border-b border-border px-5 py-4">
            <h2 id="required-heading" className="text-base font-medium tracking-tight text-foreground">Required changes ({required.length})</h2>
            <p className="mt-0.5 text-sm text-muted">Each item was confirmed by the reviewer. Fix them all, then resubmit.</p>
          </div>
          {required.length === 0 ? (
            <p className="px-5 py-5 text-sm text-muted">The reviewer did not confirm individual findings. Follow the note above.</p>
          ) : (
            <ul role="list" className="divide-y divide-border">
              {required.map((f) => (
                <li key={f.id} className="px-5 py-4 text-sm">
                  <label className="flex gap-3">
                    <input type="checkbox" className="mt-1 size-4 shrink-0 accent-[var(--accent)]" aria-label={`Mark done: ${f.ruleTitle}`} />
                    <span className="min-w-0 flex-1 space-y-2">
                      <span className="flex flex-wrap items-center gap-2">
                        <Badge variant={`severity-${f.severity}`} dot>{f.severity === "high" ? "High" : f.severity === "medium" ? "Medium" : "Low"} severity</Badge>
                        <span className="font-medium text-foreground">{f.ruleTitle}</span>
                        <span className="text-xs text-muted">
                          <code className="font-mono">{f.ruleCode}</code>{f.citation ? `, ${f.citation}` : ""}
                        </span>
                      </span>
                      <span className="block break-words rounded-sm border-l-[3px] border-border-strong bg-surface-muted px-2.5 py-1.5 font-mono text-[12.5px] text-foreground">{f.quote}</span>
                      <span className="block text-foreground">{f.issue}</span>
                      {f.suggestion ? (
                        <span className="block text-foreground">
                          <span className="font-medium text-muted">Suggested fix: </span>
                          {f.suggestion}
                        </span>
                      ) : null}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {feedbackDecision?.feedbackDraft ? (
        <FeedbackEmail
          label={`Feedback from ${feedbackDecision.reviewerName}`}
          to={detail.submitterName}
          subject={feedbackSubject(detail.code, detail.title, feedbackDecision.outcome)}
          body={feedbackDecision.feedbackDraft}
        />
      ) : null}

      {viewed.asset ? (
        <section aria-labelledby="file-heading" className="rounded-lg border border-border bg-surface shadow-card">
          <div className="border-b border-border px-5 py-3">
            <h2 id="file-heading" className="text-sm font-medium text-foreground">Your file, version {viewed.number}</h2>
            <p className="mt-0.5 text-xs text-muted">
              The text below starts with the text read from this file{viewed.inputText ? ", followed by your accompanying copy after the marked line" : ""}.
            </p>
          </div>
          <div className="px-5 py-5 sm:px-8">
            <AssetViewer asset={viewed.asset} className="mx-auto max-w-[68ch]" />
          </div>
        </section>
      ) : null}

      <SubmitterText versionNumber={viewed.number} content={viewed.content} findings={findings} diffSlot={diffSlot} />
    </div>
  );
}
