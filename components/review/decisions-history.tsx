import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL } from "@/lib/workflow/flow";
import type { DecisionView } from "@/lib/workflow/types";
import { formatDateTime, relativeTime } from "./format";

export function DecisionsHistory({ decisions, now }: { decisions: DecisionView[]; now: Date }) {
  return (
    <section aria-labelledby="decisions-heading" className="rounded-lg border border-border bg-surface shadow-card">
      <div className="border-b border-border px-5 py-4">
        <h2 id="decisions-heading" className="text-base font-semibold tracking-tight text-foreground">Decisions</h2>
        <p className="mt-0.5 text-sm text-muted">Each decision is recorded against the exact version it was made on.</p>
      </div>
      {decisions.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted">No decision yet.</p>
      ) : (
        <ul role="list" className="divide-y divide-border">
          {[...decisions].reverse().map((d) => (
            <li key={d.id} className="px-5 py-4 text-sm">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Badge variant={`status-${d.outcome}`} dot>{STATUS_LABEL[d.outcome]}</Badge>
                <span className="text-foreground">{d.reviewerName}</span>
                <span className="text-muted">on version {d.versionNumber}</span>
                <time dateTime={d.createdAt.toISOString()} title={formatDateTime(d.createdAt)} className="text-xs text-subtle">{relativeTime(d.createdAt, now)}</time>
              </div>
              {d.note ? <p className="mt-2 whitespace-pre-wrap text-foreground [overflow-wrap:anywhere]">{d.note}</p> : <p className="mt-2 text-subtle">No note.</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
