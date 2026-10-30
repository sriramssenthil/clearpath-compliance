import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { STATUS_LABEL } from "@/lib/workflow/flow";
import type { SubmissionDetail } from "@/lib/workflow/types";
import { CHANNEL_LABEL, PRODUCT_LABEL, formatDay, formatDateTime, relativeTime, slaBadge } from "./format";

const RISK = { low: "neutral", medium: "warning", high: "danger" } as const;

export function SubmissionHeader({ detail, viewed, compare, now, actions }: {
  detail: SubmissionDetail;
  viewed: number;
  compare: boolean;
  now: Date;
  actions?: ReactNode;
}) {
  const sla = slaBadge(detail.sla, detail.dueAt, now);
  const multi = detail.versions.length > 1;
  const href = (n: number, withCompare: boolean) => `/submissions/${detail.id}?v=${n}${withCompare ? "&compare=1" : ""}`;
  const canCompare = multi && viewed > 1;

  return (
    <header className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="text-sm text-muted">
            <Link href="/submissions" className="underline-offset-2 hover:underline">Submissions</Link>
            <span aria-hidden> / </span>
            <span className="font-mono text-foreground">{detail.code}</span>
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground [overflow-wrap:anywhere]">{detail.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant={`status-${detail.status}`} dot>{STATUS_LABEL[detail.status]}</Badge>
            <Badge variant={RISK[detail.riskLevel]} title={`Risk score ${detail.riskScore}: points from finding severity, product, channel and partner history. Higher means more scrutiny.`}>
              {detail.riskLevel.charAt(0).toUpperCase() + detail.riskLevel.slice(1)} risk
            </Badge>
            {sla ? <Badge variant={sla.tone} title={sla.title}>{sla.label}</Badge> : null}
            {detail.priority === "expedited" ? <Badge variant="accent" title={detail.priorityReason ?? undefined}>Expedited</Badge> : null}
          </div>
        </div>
        {actions ? <div className="flex flex-col items-start gap-2 sm:items-end">{actions}</div> : null}
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border border-border bg-surface px-4 py-3 text-sm sm:grid-cols-3 lg:grid-cols-5">
        <Meta label="Product" value={PRODUCT_LABEL[detail.product]} />
        <Meta label="Channel" value={CHANNEL_LABEL[detail.channel]} />
        <Meta label="Target states" value={detail.states.length ? detail.states.join(", ") : "Nationwide"} />
        <Meta label="Partner" value={detail.partnerName ?? "In-house"} />
        <Meta label="Submitted by" value={detail.submitterName} />
        <Meta label="Assignee" value={detail.assigneeName ?? "Unassigned"} muted={!detail.assigneeName} />
        <Meta
          label="Priority"
          value={detail.priority === "expedited" ? `Expedited${detail.priorityReason ? `: ${detail.priorityReason}` : ""}` : "Standard"}
        />
        <Meta label="Launch date" value={detail.launchDate ? formatDay(detail.launchDate) : "Not set"} muted={!detail.launchDate} />
        <div className="col-span-2 sm:col-span-1">
          <dt className="text-xs text-subtle">Submitted</dt>
          <dd className="text-foreground"><time dateTime={detail.submittedAt.toISOString()} title={formatDateTime(detail.submittedAt)}>{relativeTime(detail.submittedAt, now)}</time></dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <nav aria-label="Versions" className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-medium uppercase tracking-wide text-subtle">Version</span>
          {detail.versions.map((v) => (
            <Link
              key={v.number}
              href={href(v.number, compare && v.number > 1)}
              scroll={false}
              aria-current={v.number === viewed ? "page" : undefined}
              title={`Version ${v.number}, submitted ${formatDateTime(v.createdAt)} by ${v.createdByName}${v.number === detail.currentVersion ? " (latest)" : ""}`}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium tabular-nums transition-colors",
                v.number === viewed ? "border-accent bg-accent text-accent-foreground" : "border-border-strong bg-surface text-muted hover:bg-surface-muted hover:text-foreground",
              )}
            >
              v{v.number}
              {v.number === detail.currentVersion && multi ? <span className="sr-only"> (latest)</span> : null}
            </Link>
          ))}
        </nav>
        {multi ? (
          canCompare ? (
            <Link
              href={href(viewed, !compare)}
              scroll={false}
              className="inline-flex items-center gap-2 rounded-md px-1 py-1 text-sm text-foreground"
            >
              <span aria-hidden className={cn("relative h-5 w-9 rounded-full border transition-colors", compare ? "border-accent bg-accent" : "border-border-strong bg-surface-muted")}>
                <span className={cn("absolute top-0.5 size-3.5 rounded-full bg-surface shadow transition-all", compare ? "left-[1.2rem]" : "left-0.5")} />
              </span>
              Compare with previous version<span className="sr-only">{compare ? " (on)" : " (off)"}</span>
            </Link>
          ) : (
            <span className="text-sm text-subtle" title="Version 1 has no earlier version to compare with">Compare with previous version (select v2 or later)</span>
          )
        ) : null}
      </div>
    </header>
  );
}

function Meta({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-subtle">{label}</dt>
      <dd className={cn("[overflow-wrap:anywhere]", muted ? "text-muted" : "text-foreground")}>{value}</dd>
    </div>
  );
}
