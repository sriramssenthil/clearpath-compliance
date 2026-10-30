import { ClickableRow } from "@/components/ui/clickable-row";
import Link from "next/link";
import { Zap } from "lucide-react";
import { Badge, StatusBadge, type BadgeVariant } from "@/components/ui/badge";
import type { SubmissionSummary } from "@/lib/workflow/types";
import { cn } from "@/lib/utils";
import { ClaimButton } from "./claim-button";
import { CHANNEL_LABEL, PRODUCT_LABEL, RISK_LABEL } from "./labels";
import { PriorityCell } from "./priority-cell";
import { deadlineCell, formatAbsolute, isFastLane, launchLabel, relativeTime, type DeadlineTone } from "./sla-label";

const TONE_VARIANT: Record<DeadlineTone, BadgeVariant> = { danger: "danger", warning: "warning", neutral: "neutral" };

const FAST_LANE_HINT =
  "Fast lane: low risk and nothing flagged, so this can usually be cleared quickly. A reviewer still decides; the checker never approves anything.";

function Label({ children }: { children: string }) {
  return <span className="mb-0.5 block text-xs font-medium text-subtle md:hidden">{children}</span>;
}

const th = "px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-subtle";
const td = "block py-1.5 md:table-cell md:px-3 md:py-3 md:align-top";

function Row({ s, now }: { s: SubmissionSummary; now: Date }) {
  const dl = deadlineCell(s, now);
  const fast = isFastLane(s);
  const unclaimed = s.assigneeId === null && s.status === "submitted";
  const launch = launchLabel(s, now);

  return (
    <ClickableRow
      href={`/submissions/${s.id}`}
      data-testid="queue-row"
      className="relative mb-3 block rounded-lg border border-border bg-surface p-4 shadow-card transition-colors hover:bg-surface-muted/60 focus-within:bg-surface-muted/60 md:mb-0 md:table-row md:rounded-none md:border-0 md:border-b md:p-0 md:shadow-none"
    >
      <td className={td}>
        <Label>Priority</Label>
        {s.priorityScore ? <PriorityCell code={s.code} breakdown={s.priorityScore} /> : <span className="text-muted">Not scored</span>}
      </td>
      <td className={td}>
        <Label>Deadline</Label>
        <div className="flex flex-wrap items-center gap-1.5 md:flex-col md:items-start">
          <Badge variant={TONE_VARIANT[dl.tone]} title={dl.absolute ? formatAbsolute(dl.absolute) : undefined}>
            {dl.text}
          </Badge>
          {launch ? (
            <Badge variant={TONE_VARIANT[launch.tone]} title={launch.title}>
              {launch.text}
            </Badge>
          ) : null}
          {s.fastTrack ? (
            <span
              title="Fast-track: the latest version changed no claim or disclosure versus the previous version or its approved master. A reviewer still decides."
              className="inline-flex items-center gap-1 text-xs font-medium text-success"
            >
              <Zap aria-hidden className="size-3" />
              No claim changed
            </span>
          ) : null}
          {fast ? (
            <span title={FAST_LANE_HINT} className="inline-flex items-center gap-1 text-xs font-medium text-success">
              <Zap aria-hidden className="size-3" />
              Fast lane
            </span>
          ) : null}
        </div>
      </td>
      <td className={td}>
        <Label>Risk</Label>
        <Badge
          variant={`severity-${s.riskLevel}`}
          dot
          title={`Risk score ${s.riskScore}. Medium from 5 points, high from 10; findings, product, channel and partner history all add points.`}
        >
          {RISK_LABEL[s.riskLevel]} risk
        </Badge>
      </td>
      <td className={cn(td, "md:w-[28%]")}>
        <Label>Submission</Label>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-xs text-subtle">{s.code}</span>
          {s.currentVersion > 1 ? <span className="text-xs text-subtle">v{s.currentVersion}</span> : null}
        </div>
        <Link
          href={`/submissions/${s.id}`}
          className="font-medium text-foreground hover:text-accent hover:underline after:absolute after:inset-0 after:content-[''] focus-visible:after:rounded-lg md:after:hidden"
        >
          {s.title}
        </Link>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <Badge>{PRODUCT_LABEL[s.product]}</Badge>
          <Badge>{CHANNEL_LABEL[s.channel]}</Badge>
          {s.priority === "expedited" ? <Badge variant="accent">Expedited</Badge> : null}
          <StatusBadge status={s.status} />
        </div>
      </td>
      <td className={td}>
        <Label>Submitted by</Label>
        {s.partnerName ? (
          <>
            <div className="font-medium">{s.partnerName}</div>
            <div className="text-xs text-subtle">Affiliate partner, via {s.submitterName}</div>
          </>
        ) : (
          <>
            <div>{s.submitterName}</div>
            <div className="text-xs text-subtle">In-house</div>
          </>
        )}
      </td>
      <td className={td}>
        <Label>Open findings</Label>
        {s.openFindings === 0 ? (
          <span className="text-muted">None open</span>
        ) : (
          <>
            <div className="font-medium">{s.openFindings} open</div>
            {s.highOpenFindings > 0 ? (
              <div className="text-xs font-medium text-danger">{s.highOpenFindings} high severity</div>
            ) : (
              <div className="text-xs text-subtle">None high severity</div>
            )}
          </>
        )}
      </td>
      <td className={td}>
        <Label>Assignee</Label>
        {unclaimed ? (
          <div className="flex flex-col items-start gap-1.5">
            <span className="text-muted">Unassigned</span>
            <ClaimButton submissionId={s.id} code={s.code} />
          </div>
        ) : s.assigneeName ? (
          s.assigneeName
        ) : (
          <span className="text-muted">Unassigned</span>
        )}
      </td>
      <td className={cn(td, "md:whitespace-nowrap")}>
        <Label>Submitted</Label>
        <span title={formatAbsolute(s.submittedAt)}>{relativeTime(s.submittedAt, now)}</span>
      </td>
    </ClickableRow>
  );
}

/** Renders the list in the order the service returned it; sorting is the service's job. */
export function QueueTable({ rows, now, sort = "priority" }: { rows: SubmissionSummary[]; now: Date; sort?: "priority" | "deadline" }) {
  return (
    // No overflow clipping here: the priority breakdown floats over the rows below it.
    <div className="md:rounded-lg md:border md:border-border md:bg-surface md:shadow-card">
      <table className="block w-full text-sm md:table">
        <caption className="sr-only">
          {sort === "priority" ? "Submissions sorted by priority score, highest first" : "Submissions sorted by deadline, then risk"}
        </caption>
        <thead className="hidden border-b border-border bg-surface-muted md:table-header-group">
          <tr>
            <th scope="col" className={th}>Priority</th>
            <th scope="col" className={th}>Deadline</th>
            <th scope="col" className={th}>Risk</th>
            <th scope="col" className={th}>Submission</th>
            <th scope="col" className={th}>Submitted by</th>
            <th scope="col" className={th}>Open findings</th>
            <th scope="col" className={th}>Assignee</th>
            <th scope="col" className={th}>Submitted</th>
          </tr>
        </thead>
        <tbody className="block md:table-row-group">
          {rows.map((s) => (
            <Row key={s.id} s={s} now={now} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
