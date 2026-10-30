import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DashboardStats } from "@/lib/workflow/queries";
import { queueHref } from "@/components/queue/params";
import {
  agreementRate, formatDecimal, formatHours, formatPercent, NO_DATA, percentOf, STANDING_LABEL, STANDING_VARIANT,
} from "./format";

export function Section({ id, title, caption, children }: { id: string; title: string; caption: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <div>
        <h2 id={id} className="text-lg font-semibold tracking-tight">
          {title}
        </h2>
        <p className="mt-0.5 max-w-3xl text-sm text-muted">{caption}</p>
      </div>
      {children}
    </section>
  );
}

function Tile({ label, value, detail, caption }: { label: string; value: string; detail?: ReactNode; caption: string }) {
  const empty = value === NO_DATA;
  return (
    <div className="flex flex-col rounded-lg border border-border bg-surface p-4 shadow-card">
      <dt className="text-sm font-medium text-muted">{label}</dt>
      <dd className={cn("mt-1 font-semibold tracking-tight tabular-nums", empty ? "text-base text-subtle" : "text-3xl")}>{value}</dd>
      {detail ? <div className="mt-0.5 text-sm text-foreground">{detail}</div> : null}
      <p className="mt-2 text-xs text-subtle">{caption}</p>
    </div>
  );
}

export function KpiTiles({ stats }: { stats: DashboardStats }) {
  const { queue, kpis } = stats;
  return (
    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Tile
        label="Open in queue"
        value={String(queue.open)}
        detail={
          <span>
            <span className={queue.overdue > 0 ? "font-medium text-danger" : ""}>{queue.overdue} overdue</span>, {queue.unassigned} unassigned, {queue.dueSoon} due in the next 12 hours
          </span>
        }
        caption="Submissions waiting for, or in, a compliance review right now."
      />
      <Tile
        label="Median review turnaround"
        value={formatHours(kpis.medianTurnaroundHours)}
        caption="Time from a version being submitted to a decision on it, for decisions in the last 30 days."
      />
      <Tile
        label="SLA attainment"
        value={formatPercent(kpis.slaAttainment)}
        caption="Share of decisions in the last 30 days made inside the SLA: 72 hours for standard, 24 hours for expedited submissions and re-reviews."
      />
      <Tile
        label="First-pass approval rate"
        value={formatPercent(kpis.firstPassApprovalRate)}
        caption="Share of submissions whose first decision was an approval, across all recorded history."
      />
      <Tile
        label="Average rounds to approval"
        value={kpis.avgRoundsToApproval === null ? NO_DATA : formatDecimal(kpis.avgRoundsToApproval)}
        caption="Average number of versions an approved submission went through; 1.0 means approved with no rework."
      />
      <Tile
        label="Decisions in the last 30 days"
        value={String(kpis.decisionsLast30Days)}
        caption="Approvals, change requests and rejections recorded by reviewers. A submission with rework counts once per decision."
      />
    </dl>
  );
}

export function AgingBars({ buckets }: { buckets: DashboardStats["queue"]["aging"] }) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const total = buckets.reduce((n, b) => n + b.count, 0);
  if (total === 0) {
    return (
      <Card>
        <CardBody className="text-sm text-muted">Nothing is waiting for review, so there is nothing to age.</CardBody>
      </Card>
    );
  }
  return (
    <Card>
      <CardBody>
        <ul className="space-y-3">
          {buckets.map((b, i) => (
            <li key={b.label} className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-3 text-sm">
              <span className="text-muted">{b.label}</span>
              <span className="h-4 overflow-hidden rounded-full bg-surface-muted">
                <span
                  className={cn("block h-full rounded-full", i === buckets.length - 1 ? "bg-danger" : "bg-accent")}
                  style={{ width: `${percentOf(b.count, max)}%` }}
                />
              </span>
              <span className="text-right font-medium tabular-nums">{b.count}</span>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

export function TopRules({ rules }: { rules: DashboardStats["topRules"] }) {
  if (rules.length === 0) {
    return (
      <Card>
        <CardBody className="text-sm text-muted">No findings recorded in the last 8 weeks.</CardBody>
      </Card>
    );
  }
  const max = Math.max(1, ...rules.map((r) => r.count));
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <thead className="border-b border-border bg-surface-muted text-left text-xs font-semibold uppercase tracking-wide text-subtle">
            <tr>
              <th scope="col" className="px-4 py-2.5">Rule</th>
              <th scope="col" className="px-4 py-2.5">Times flagged</th>
              <th scope="col" className="px-4 py-2.5 text-right" title="Accepted findings divided by accepted plus dismissed. Open findings are not counted.">
                Reviewers agreed
              </th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => {
              const rate = agreementRate(r.accepted, r.dismissed);
              return (
                <tr key={r.ruleCode} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/rules#${r.ruleCode}`} className="font-medium hover:text-accent hover:underline">
                      {r.title}
                    </Link>
                    <div className="font-mono text-xs text-subtle">{r.ruleCode}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="h-2.5 w-full max-w-48 overflow-hidden rounded-full bg-surface-muted">
                        <span className="block h-full rounded-full bg-accent" style={{ width: `${percentOf(r.count, max)}%` }} />
                      </span>
                      <span className="w-8 font-medium tabular-nums">{r.count}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {rate === null ? (
                      <span className="text-subtle">Not enough data yet</span>
                    ) : (
                      <>
                        <span className="font-medium">{formatPercent(rate)}</span>
                        <span className="block text-xs text-subtle">
                          {r.accepted} of {r.accepted + r.dismissed} judged
                        </span>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

const SOURCE_LABEL = { rule: "Rule check", ai: "AI review", reviewer: "Reviewer-added" } as const;

export function AgreementBySource({ rows }: { rows: DashboardStats["acceptance"] }) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[30rem] text-sm">
          <thead className="border-b border-border bg-surface-muted text-left text-xs font-semibold uppercase tracking-wide text-subtle">
            <tr>
              <th scope="col" className="px-4 py-2.5">Source of the flag</th>
              <th scope="col" className="px-4 py-2.5 text-right">Accepted</th>
              <th scope="col" className="px-4 py-2.5 text-right">Dismissed</th>
              <th scope="col" className="px-4 py-2.5">Agreement</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const rate = agreementRate(r.accepted, r.dismissed);
              return (
                <tr key={r.source} className="border-b border-border last:border-0">
                  <th scope="row" className="px-4 py-3 text-left font-medium">{SOURCE_LABEL[r.source]}</th>
                  <td className="px-4 py-3 text-right tabular-nums">{r.accepted}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.dismissed}</td>
                  <td className="px-4 py-3">
                    {rate === null ? (
                      <span className="text-subtle">Not enough data yet</span>
                    ) : (
                      <div className="flex items-center gap-3">
                        <span className="h-2.5 w-28 overflow-hidden rounded-full bg-surface-muted">
                          <span className="block h-full rounded-full bg-accent" style={{ width: `${rate * 100}%` }} />
                        </span>
                        <span className="font-medium tabular-nums">{formatPercent(rate)}</span>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function PartnerScorecard({ partners }: { partners: DashboardStats["partners"] }) {
  if (partners.length === 0) {
    return (
      <Card>
        <CardBody className="text-sm text-muted">No affiliate partners yet.</CardBody>
      </Card>
    );
  }
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[56rem] text-sm">
          <thead className="border-b border-border bg-surface-muted text-left text-xs font-semibold uppercase tracking-wide text-subtle">
            <tr>
              <th scope="col" className="px-4 py-2.5">Partner</th>
              <th scope="col" className="px-4 py-2.5 text-right">Submissions</th>
              <th scope="col" className="px-4 py-2.5 text-right">Approved</th>
              <th scope="col" className="px-4 py-2.5 text-right">Rejected</th>
              <th scope="col" className="px-4 py-2.5 text-right" title="Rejected divided by approved plus rejected. Needs at least 3 decided submissions.">
                Rejection rate
              </th>
              <th scope="col" className="px-4 py-2.5 text-right" title="All findings (any status) on each submission's latest version, averaged over all of the partner's submissions.">
                Avg findings
              </th>
              <th scope="col" className="px-4 py-2.5">Most frequent rule</th>
              <th scope="col" className="px-4 py-2.5" title="Watch above 15% rejection, High risk above 30%, once at least 3 submissions are decided.">
                Standing
              </th>
            </tr>
          </thead>
          <tbody>
            {partners.map((p) => (
              <tr key={p.partnerId} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <Link href={queueHref({ status: "all", partner: p.partnerId })} className="font-medium hover:text-accent hover:underline">
                    {p.name}
                  </Link>
                  <div className="text-xs capitalize text-subtle">{p.type}</div>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{p.submissions}</td>
                <td className="px-4 py-3 text-right tabular-nums">{p.approved}</td>
                <td className="px-4 py-3 text-right tabular-nums">{p.rejected}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {p.rejectionRate === null ? <span className="text-subtle">Not enough history</span> : formatPercent(p.rejectionRate)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{p.submissions ? formatDecimal(p.avgFindings) : "-"}</td>
                <td className="px-4 py-3">
                  {p.topRule ? (
                    <Link href={`/rules#${p.topRule}`} className="font-mono text-xs hover:text-accent hover:underline">
                      {p.topRule}
                    </Link>
                  ) : (
                    <span className="text-subtle">None</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={STANDING_VARIANT[p.standing]} dot>
                    {STANDING_LABEL[p.standing]}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
