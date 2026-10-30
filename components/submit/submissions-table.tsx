import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { STATUS_LABEL } from "@/lib/workflow/flow";
import type { SubmissionSummary } from "@/lib/workflow/types";
import { formatAbsolute, formatDay, relativeTime, shortDuration } from "./format";
import { CHANNEL_LABEL, PRODUCT_LABEL } from "./options";

interface Props {
  rows: SubmissionSummary[];
  /** Staff views also show who submitted. */
  staff: boolean;
  /** Viewer is on the submitter side: changes_requested rows get the resubmit call to action. */
  submitterSide: boolean;
  now: Date;
}

const RISK: Record<SubmissionSummary["riskLevel"], { label: string; variant: "success" | "warning" | "danger" }> = {
  low: { label: "Low", variant: "success" },
  medium: { label: "Medium", variant: "warning" },
  high: { label: "High", variant: "danger" },
};

function Meta({ s }: { s: SubmissionSummary }) {
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      <Badge variant="neutral">{PRODUCT_LABEL[s.product]}</Badge>
      <Badge variant="neutral">{CHANNEL_LABEL[s.channel]}</Badge>
      {s.priority === "expedited" ? (
        <Badge variant="accent" title="Expedited review: compliance aims to respond within 24 hours">
          Expedited
        </Badge>
      ) : null}
    </div>
  );
}

function Risk({ s }: { s: SubmissionSummary }) {
  const r = RISK[s.riskLevel];
  return (
    <Badge variant={r.variant} title={`Risk score ${s.riskScore}, from finding severity, product, channel and partner history`}>
      {r.label} risk
    </Badge>
  );
}

function Findings({ s }: { s: SubmissionSummary }) {
  if (s.openFindings === 0) return <span className="text-sm text-muted">None open</span>;
  return (
    <span className="text-sm" title="Findings on the current version that have not been dismissed or resolved">
      <span className="font-medium tabular-nums">{s.openFindings}</span> open
      {s.highOpenFindings > 0 ? (
        <span className="mt-0.5 block whitespace-nowrap font-semibold text-danger tabular-nums">{s.highOpenFindings} high severity</span>
      ) : null}
    </span>
  );
}

function Timing({ s, now, submitterSide }: { s: SubmissionSummary; now: Date; submitterSide: boolean }) {
  if (s.status === "submitted" || s.status === "in_review") {
    if (!s.dueAt) return <span className="text-sm text-muted">Awaiting compliance</span>;
    const ms = s.dueAt.getTime() - now.getTime();
    const abs = `Response due ${formatAbsolute(s.dueAt)}`;
    if (s.sla === "overdue") return <Badge variant="danger" title={abs}>Overdue by {shortDuration(-ms)}</Badge>;
    if (s.sla === "due_soon") return <Badge variant="warning" title={abs}>Due in {shortDuration(ms)}</Badge>;
    return (
      <span className="text-sm text-muted" title={abs}>
        Due in {shortDuration(ms)}
      </span>
    );
  }
  if (s.status === "changes_requested") {
    return <span className="text-sm font-medium text-warning">{submitterSide ? "Waiting on you" : "Waiting on submitter"}</span>;
  }
  if (s.decidedAt) {
    return (
      <span className="text-sm text-muted" title={formatAbsolute(s.decidedAt)}>
        {STATUS_LABEL[s.status]} {formatDay(s.decidedAt)}
      </span>
    );
  }
  return <span className="text-sm text-muted">-</span>;
}

function Cta({ s }: { s: SubmissionSummary }) {
  return (
    <Link
      href={`/submissions/${s.id}/resubmit`}
      className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "relative z-10 mt-2")}
    >
      Review feedback and resubmit
      <ArrowRight aria-hidden className="size-3.5" />
    </Link>
  );
}

function Submitted({ s, now }: { s: SubmissionSummary; now: Date }) {
  return (
    <time dateTime={s.submittedAt.toISOString()} title={formatAbsolute(s.submittedAt)} className="text-sm text-muted">
      {relativeTime(s.submittedAt, now)}
    </time>
  );
}

function Th({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <th scope="col" className={cn("px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-subtle", className)}>
      {children}
    </th>
  );
}

export function SubmissionsTable({ rows, staff, submitterSide, now }: Props) {
  return (
    <>
      <div className="hidden overflow-x-auto rounded-lg border border-border bg-surface shadow-card md:block">
        <table className="w-full min-w-[56rem] border-collapse">
          <caption className="sr-only">Submissions</caption>
          <thead className="border-b border-border bg-surface-muted">
            <tr>
              <Th>Submission</Th>
              <Th>Status</Th>
              <Th>Risk</Th>
              <Th>Findings</Th>
              <Th>Timing</Th>
              {staff ? <Th>Submitted by</Th> : null}
              <Th>Submitted</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((s) => (
              <tr key={s.id} className="relative align-top hover:bg-surface-muted/60">
                <td className="max-w-sm px-4 py-3">
                  <Link
                    href={`/submissions/${s.id}`}
                    className="text-sm font-semibold text-foreground after:absolute after:inset-0 hover:text-accent"
                  >
                    <span className="mr-2 font-mono text-xs font-medium text-muted">{s.code}</span>
                    {s.title}
                  </Link>
                  <Meta s={s} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={s.status} />
                  {s.currentVersion > 1 ? <p className="mt-1 text-xs text-muted">Version {s.currentVersion}</p> : null}
                </td>
                <td className="px-4 py-3">
                  <Risk s={s} />
                </td>
                <td className="px-4 py-3">
                  <Findings s={s} />
                </td>
                <td className="px-4 py-3">
                  <Timing s={s} now={now} submitterSide={submitterSide} />
                  {submitterSide && s.status === "changes_requested" ? <Cta s={s} /> : null}
                </td>
                {staff ? (
                  <td className="px-4 py-3 text-sm">
                    {s.submitterName}
                    {s.partnerName ? <p className="text-xs text-muted">{s.partnerName}</p> : null}
                  </td>
                ) : null}
                <td className="whitespace-nowrap px-4 py-3">
                  <Submitted s={s} now={now} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden">
        {rows.map((s) => (
          <li key={s.id} className="relative rounded-lg border border-border bg-surface p-4 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <Link href={`/submissions/${s.id}`} className="min-w-0 text-sm font-semibold after:absolute after:inset-0">
                <span className="block font-mono text-xs font-medium text-muted">{s.code}</span>
                <span className="[overflow-wrap:anywhere]">{s.title}</span>
              </Link>
              <StatusBadge status={s.status} />
            </div>
            <Meta s={s} />
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <dt className="text-xs text-subtle">Risk</dt>
                <dd className="mt-0.5">
                  <Risk s={s} />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-subtle">Findings</dt>
                <dd className="mt-0.5">
                  <Findings s={s} />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-subtle">Timing</dt>
                <dd className="mt-0.5">
                  <Timing s={s} now={now} submitterSide={submitterSide} />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-subtle">Submitted</dt>
                <dd className="mt-0.5">
                  <Submitted s={s} now={now} />
                </dd>
              </div>
              {staff ? (
                <div className="col-span-2">
                  <dt className="text-xs text-subtle">Submitted by</dt>
                  <dd className="mt-0.5">
                    {s.submitterName}
                    {s.partnerName ? <span className="text-muted">, {s.partnerName}</span> : null}
                  </dd>
                </div>
              ) : null}
            </dl>
            {submitterSide && s.status === "changes_requested" ? <Cta s={s} /> : null}
          </li>
        ))}
      </ul>
    </>
  );
}
