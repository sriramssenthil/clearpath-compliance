import { AUDIT_LABEL } from "@/lib/workflow/audit-actions";
import type { AuditView } from "@/lib/workflow/types";
import { cn } from "@/lib/utils";
import { summarizeAuditDetails } from "./audit-summary";
import { formatDateTime, relativeTime } from "./format";

const TONE: Record<string, string> = {
  "decision.approved": "bg-success border-success",
  "decision.changes_requested": "bg-warning border-warning",
  "decision.rejected": "bg-danger border-danger",
  "submission.withdrawn": "bg-subtle border-subtle",
};

// Reviewer triage that the submitter is not shown (dismissals are not findings the submitter sees).
const REVIEWER_ONLY = new Set(["finding.dismissed", "finding.reopened"]);

export function AuditTimeline({ events: all, now, audience = "reviewer" }: { events: AuditView[]; now: Date; audience?: "reviewer" | "submitter" }) {
  const events = audience === "submitter" ? all.filter((e) => !REVIEWER_ONLY.has(e.action)) : all;
  return (
    <section aria-labelledby="audit-heading" className="rounded-lg border border-border bg-surface shadow-card">
      <div className="border-b border-border px-5 py-4">
        <h2 id="audit-heading" className="text-base font-semibold tracking-tight text-foreground">Audit trail</h2>
        <p className="mt-0.5 text-sm text-muted">Append-only record of every action on this submission.</p>
        {audience === "submitter" ? <p className="mt-0.5 text-xs text-subtle">Internal reviewer triage of findings that were not upheld is not shown here.</p> : null}
      </div>
      {events.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted">No events recorded yet.</p>
      ) : (
        <ol className="px-5 py-5">
          {events.map((e, i) => {
            const summary = summarizeAuditDetails(e.action, e.details);
            const label = (AUDIT_LABEL as Record<string, string>)[e.action] ?? e.action;
            const last = i === events.length - 1;
            return (
              <li key={e.id} className="relative flex gap-4 pb-6 last:pb-0">
                {!last ? <span aria-hidden className="absolute left-[7px] top-4 h-full w-px bg-border-strong" /> : null}
                <span aria-hidden className={cn("relative z-10 mt-1 size-[15px] shrink-0 rounded-full border-2 bg-surface", TONE[e.action] ?? "border-border-strong")} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                    <p className="font-medium text-foreground">{label}</p>
                    <time dateTime={e.createdAt.toISOString()} title={formatDateTime(e.createdAt)} className="text-xs text-subtle">
                      {relativeTime(e.createdAt, now)}
                    </time>
                  </div>
                  <p className="text-sm text-muted">{e.actorName ?? "Automated check"}</p>
                  {summary ? <p className="mt-0.5 text-sm text-foreground [overflow-wrap:anywhere]">{summary}</p> : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
