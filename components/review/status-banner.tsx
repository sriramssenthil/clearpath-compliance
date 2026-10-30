import Link from "next/link";
import type { ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { SLA_HOURS } from "@/lib/workflow/flow";
import type { SubmissionDetail } from "@/lib/workflow/types";
import { cn } from "@/lib/utils";
import { formatDateTime, relativeTime } from "./format";

type Tone = "neutral" | "info" | "success" | "warning" | "danger";
const TONE: Record<Tone, string> = {
  neutral: "border-neutral-line bg-neutral-soft",
  info: "border-info-line bg-info-soft",
  success: "border-success-line bg-success-soft",
  warning: "border-warning-line bg-warning-soft",
  danger: "border-danger-line bg-danger-soft",
};

function Banner({ tone, title, children, action }: { tone: Tone; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <section aria-label="Status" className={cn("flex flex-wrap items-center justify-between gap-4 rounded-lg border px-5 py-4", TONE[tone])}>
      <div className="min-w-0 flex-1 basis-80">
        <h2 className="text-base font-medium tracking-tight text-foreground">{title}</h2>
        <div className="mt-1 space-y-1 text-sm text-foreground [overflow-wrap:anywhere]">{children}</div>
      </div>
      {action}
    </section>
  );
}

/** Plain-language status for both audiences: what is happening now and what happens next. */
export function StatusBanner({ detail, audience, now }: { detail: SubmissionDetail; audience: "submitter" | "reviewer"; now: Date }) {
  const last = detail.decisions.at(-1) ?? null;
  const due = detail.dueAt;
  const hours = detail.currentVersion > 1 ? Math.min(SLA_HOURS.resubmission, SLA_HOURS[detail.priority]) : SLA_HOURS[detail.priority];
  const dueText = due ? (
    <>
      due <time dateTime={due.toISOString()} title={formatDateTime(due)}>{formatDateTime(due)}</time>
      {detail.sla === "overdue" ? " (overdue)" : ""}
    </>
  ) : null;
  const decidedLine = last ? (
    <>
      {last.reviewerName}, <time dateTime={last.createdAt.toISOString()} title={formatDateTime(last.createdAt)}>{formatDateTime(last.createdAt)}</time> ({relativeTime(last.createdAt, now)}), on version {last.versionNumber}.
    </>
  ) : null;
  const note = last?.note ? <p className="whitespace-pre-wrap">Note: {last.note}</p> : null;

  switch (detail.status) {
    case "submitted":
      if (audience === "reviewer") return null;
      return (
        <Banner tone="info" title="Awaiting review">
          <p>Compliance has it. Typical response is within {hours} hours; yours is {dueText ?? "being scheduled"}.</p>
          <p className="text-muted">Nothing is needed from you unless a reviewer asks for changes. You can withdraw it below at any time.</p>
        </Banner>
      );
    case "in_review":
      if (audience === "reviewer") return null;
      return (
        <Banner tone="info" title="In review">
          <p>{detail.assigneeName ? `${detail.assigneeName} is reviewing it now.` : "A compliance reviewer is reviewing it now."} A decision is {dueText ?? "expected soon"}.</p>
          <p className="text-muted">You will see the outcome here. If changes are needed you will get a list of exactly what to fix.</p>
        </Banner>
      );
    case "changes_requested":
      if (audience === "reviewer") {
        return (
          <Banner tone="warning" title="Changes requested: waiting for the submitter">
            <p>Requested by {decidedLine} A new version will return to the queue for re-review.</p>
            {note}
          </Banner>
        );
      }
      return (
        <Banner
          tone="warning"
          title="Changes requested"
          action={
            detail.permissions.canResubmit ? (
              <Link href={`/submissions/${detail.id}/resubmit`} className={buttonVariants({ size: "lg" })}>
                Make changes and resubmit
              </Link>
            ) : null
          }
        >
          <p>{last ? `${last.reviewerName} reviewed version ${last.versionNumber} and needs the changes listed below before it can be approved.` : "A reviewer needs changes before this can be approved."}</p>
          {note}
          <p className="text-muted">Submit a new version when ready. Re-reviews of a revision are prioritised (target: {Math.min(SLA_HOURS.resubmission, SLA_HOURS[detail.priority])} hours).</p>
        </Banner>
      );
    case "approved":
      return (
        <Banner tone="success" title="Approved">
          <p>Approved by {decidedLine}</p>
          {note}
          <p className="text-muted">Approval is tied to this exact text (version {last?.versionNumber ?? detail.currentVersion}). Any edit, however small, needs a new review.</p>
        </Banner>
      );
    case "rejected":
      return (
        <Banner tone="danger" title="Rejected">
          <p>Rejected by {decidedLine}</p>
          {note ?? <p>No note was left.</p>}
          <p className="text-muted">This submission is closed. To try again, submit a new asset.</p>
        </Banner>
      );
    case "withdrawn":
      return (
        <Banner tone="neutral" title="Withdrawn">
          <p>This submission was withdrawn{detail.decidedAt ? <> <time title={formatDateTime(detail.decidedAt)}>{relativeTime(detail.decidedAt, now)}</time></> : null} and is out of the review queue. It is kept for the audit record.</p>
        </Banner>
      );
  }
}
