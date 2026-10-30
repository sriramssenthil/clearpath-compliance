import Link from "next/link";
import { PRIORITY_WEIGHTS as W } from "@/lib/workflow/priority";
import { cn } from "@/lib/utils";
import { queueHref, type QueueView } from "./params";

const RULES: [string, string][] = [
  ["Each open high-severity finding", `+${W.highFinding}`],
  ["Each other open finding", `+${W.otherFinding}`],
  ["SLA deadline passed", `+${W.slaOverdue}`],
  ["SLA due within 12 hours", `+${W.slaDueSoon}`],
  ["Expedited request", `+${W.expedited}`],
  ["Launch date passed, not yet approved", `+${W.launchPassed}`],
  ["Launches within 48 hours", `+${W.launchWithin48h}`],
  ["Launches within 7 days", `+${W.launchWithin7d}`],
  ["Partner on high-risk standing (over 30% rejected)", `+${W.partnerHighRisk}`],
  ["Partner on watch (over 15% rejected)", `+${W.partnerWatch}`],
  ["Mortgage product", `+${W.productMortgage}`],
  ["Credit card product", `+${W.productCreditCard}`],
  ["Each full day waiting", `+${W.agePerDay}, up to ${W.ageMax}`],
];

/** Sort toggle plus a one-line explanation of the score, with the full weight table on demand. */
export function PriorityExplainer({ view }: { view: QueueView }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="max-w-3xl flex-1 basis-80 text-xs text-muted">
        <p>
          The priority score adds points for open findings (high severity counts most), SLA and launch deadlines, expedited
          requests, the partner&apos;s record, the product and time waiting. Hover or select a score to see its parts.
        </p>
        <details className="mt-1">
          <summary className="w-fit cursor-pointer text-accent underline-offset-2 hover:underline">How priority works</summary>
          <div className="mt-2 max-w-lg border border-border bg-surface p-3">
            <p>
              Points add up and only factors that apply are counted; ties go to the earlier SLA deadline. The weights are
              ClearPath internal policy set by the compliance lead. The score only orders the work: it never approves or
              rejects anything. Partner standing needs at least 3 decided submissions, as on the dashboard.
            </p>
            <table className="mt-2 w-full">
              <caption className="sr-only">Priority weights</caption>
              <tbody>
                {RULES.map(([label, pts]) => (
                  <tr key={label} className="border-t border-border first:border-t-0">
                    <th scope="row" className="py-1 pr-4 text-left font-normal">{label}</th>
                    <td className="whitespace-nowrap py-1 text-right font-medium tabular-nums text-foreground">{pts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>
      <div role="group" aria-label="Sort the queue" className="inline-flex items-center gap-2 text-xs">
        <span className="text-subtle">Sort by</span>
        <span className="inline-flex border border-border">
          {(["priority", "deadline"] as const).map((key) => {
            const active = view.sort === key;
            return (
              <Link
                key={key}
                href={queueHref({ ...view, sort: key })}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "px-3 py-1.5 font-medium transition-colors",
                  active ? "bg-surface-muted text-foreground" : "text-muted hover:text-foreground",
                )}
              >
                {key === "priority" ? "Priority" : "Deadline"}
              </Link>
            );
          })}
        </span>
      </div>
    </div>
  );
}
