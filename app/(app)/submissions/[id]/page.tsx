import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AuditTimeline } from "@/components/review/audit-timeline";
import { ClaimButton } from "@/components/review/claim-button";
import { DecisionsHistory } from "@/components/review/decisions-history";
import type { ClosedDecision } from "@/components/review/decision-panel";
import { formatDateTime, plural, relativeTime } from "@/components/review/format";
import { SubmissionHeader } from "@/components/review/header";
import { ReviewerWorkspace } from "@/components/review/reviewer-workspace";
import { StatusBanner } from "@/components/review/status-banner";
import { SubmitterView } from "@/components/review/submitter-view";
import { toFindingVM, type RuleOption } from "@/components/review/view-models";
import { VersionDiff } from "@/components/review/version-diff";
import { WithdrawControl } from "@/components/review/withdraw-control";
import { buttonVariants } from "@/components/ui/button";
import { ChangeScopePanel } from "@/components/review/change-scope-panel";
import { NetImpressionCard } from "@/components/review/net-impression-card";
import { VariantsPanel } from "@/components/review/variants-panel";
import { factsForDisplay } from "@/lib/compliance/net-impression";
import { loadFacts, loadRules } from "@/lib/data/reference";
import { attachPrecedents, loadPrecedentData } from "@/lib/workflow/precedents";
import { changeScopeForVersion, variantsOf } from "@/lib/workflow/variants";
import { approveVariantsAction } from "./actions";
import { canReview } from "@/lib/workflow/flow";
import { currentActor } from "@/lib/workflow/action-helpers";
import { getDetail } from "@/lib/workflow/queries";
import { WorkflowError } from "@/lib/workflow/types";
import Link from "next/link";

export const metadata: Metadata = { title: "Submission" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function SubmissionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id: rawId } = await params;
  const sp = await searchParams;
  const id = /^\d{1,9}$/.test(rawId) ? Number(rawId) : NaN;
  if (!Number.isInteger(id) || id <= 0) notFound();

  const actor = await currentActor();
  let detail;
  try {
    detail = await getDetail(actor, id);
  } catch (err) {
    if (err instanceof WorkflowError && err.code === "not_found") notFound();
    throw err;
  }

  const now = new Date();
  const latest = detail.versions[detail.versions.length - 1];
  const wanted = Number(first(sp.v));
  const viewed = detail.versions.find((v) => v.number === wanted) ?? latest;
  const previous = detail.versions.find((v) => v.number === viewed.number - 1) ?? null;
  const compare = first(sp.compare) === "1" && previous !== null;
  const resubmitted = /^\d{1,4}$/.test(first(sp.resubmitted) ?? "") ? Number(first(sp.resubmitted)) : null;

  const reviewerSide = canReview(actor.role) || detail.permissions.canActOnFindings;
  // Reviewer-only enrichments: similar past decisions per finding, what changed, the consumer read, variants.
  const [precedentData, scope, factsRows, variants] = await Promise.all([
    reviewerSide ? loadPrecedentData() : Promise.resolve(null),
    changeScopeForVersion({ id: detail.id, parentId: detail.parentId }, viewed),
    loadFacts(detail.product).then(factsForDisplay),
    detail.status === "approved" ? variantsOf(actor, detail.id) : Promise.resolve([]),
  ]);
  const viewedWithPrecedents = precedentData
    ? attachPrecedents(viewed.findings, { product: detail.product, channel: detail.channel, excludeSubmissionCode: detail.code }, precedentData.corpus)
    : viewed.findings;
  const viewedFindings = viewedWithPrecedents.map((f) => toFindingVM(f, now, precedentData?.submissionIds));
  const latestFindings = latest.findings.map((f) => toFindingVM(f, now));

  const diffSlot =
    compare && previous ? (
      <VersionDiff
        previous={previous.content}
        current={viewed.content}
        previousNumber={previous.number}
        currentNumber={viewed.number}
        resolvedFindings={previous.findings.filter((f) => f.status === "resolved").length}
      />
    ) : null;

  const lastDecision = detail.decisions.at(-1);
  const closedDecision: ClosedDecision | null =
    lastDecision && detail.status !== "withdrawn"
      ? {
          outcome: lastDecision.outcome,
          reviewerName: lastDecision.reviewerName,
          note: lastDecision.note,
          feedbackDraft: lastDecision.feedbackDraft,
          versionNumber: lastDecision.versionNumber,
          atRel: relativeTime(lastDecision.createdAt, now),
          atAbs: formatDateTime(lastDecision.createdAt),
        }
      : null;

  let rules: RuleOption[] = [];
  if (reviewerSide && detail.permissions.canActOnFindings) {
    rules = (await loadRules()).map((r) => ({ code: r.code, title: r.title, severity: r.severity, category: r.category }));
  }

  const actions = (
    <>
      {detail.permissions.canClaim ? <ClaimButton submissionId={detail.id} /> : null}
      {detail.permissions.canWithdraw ? <WithdrawControl submissionId={detail.id} /> : null}
    </>
  );

  return (
    <div className="space-y-6">
      <SubmissionHeader detail={detail} viewed={viewed.number} compare={compare} now={now} actions={detail.permissions.canClaim || detail.permissions.canWithdraw ? actions : null} />

      {resubmitted !== null ? (
        <p role="status" className="rounded-lg border border-success-line bg-success-soft px-4 py-3 text-sm text-success">
          New version submitted. {plural(resubmitted, "earlier finding")} {resubmitted === 1 ? "was" : "were"} resolved automatically.
        </p>
      ) : null}

      {viewed.number !== latest.number ? (
        <p role="note" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-info-line bg-info-soft px-4 py-3 text-sm text-foreground">
          <span>You are viewing version {viewed.number} of {latest.number}. It is read-only; decisions apply to the latest version.</span>
          <Link href={`/submissions/${detail.id}`} className={buttonVariants({ variant: "secondary", size: "sm" })}>View latest (v{latest.number})</Link>
        </p>
      ) : null}

      {detail.parent ? (
        <p role="note" className="border border-border bg-surface px-4 py-3 text-sm text-muted">
          Variant of approved master{" "}
          <Link href={`/submissions/${detail.parent.id}`} className="text-foreground underline underline-offset-4">
            {detail.parent.code} {detail.parent.title}
          </Link>
          . The change summary compares it with the master&apos;s approved text.
        </p>
      ) : null}

      {reviewerSide && scope ? <ChangeScopePanel scope={scope} /> : null}

      {reviewerSide && variants.length > 0 ? (
        <VariantsPanel
          variants={variants}
          canApprove={canReview(actor.role)}
          approveAction={approveVariantsAction.bind(null, detail.id)}
        />
      ) : null}

      {reviewerSide ? (
        <>
          <StatusBanner detail={detail} audience="reviewer" now={now} />
          <ReviewerWorkspace
            key={`${detail.id}-${viewed.number}`}
            submissionId={detail.id}
            code={detail.code}
            title={detail.title}
            submitterName={detail.submitterName}
            status={detail.status}
            permissions={detail.permissions}
            versionNumber={viewed.number}
            latestNumber={latest.number}
            content={viewed.content}
            analysis={{ status: viewed.analysisStatus, summary: viewed.analysisSummary, model: viewed.model }}
            findings={viewedFindings}
            latestFindings={latestFindings}
            rules={rules}
            lastDecision={closedDecision}
            diffSlot={diffSlot}
            asset={viewed.asset}
          />
          <NetImpressionCard impression={viewed.netImpression} facts={factsRows} />
        </>
      ) : (
        <SubmitterView
          detail={detail}
          now={now}
          viewedNumber={viewed.number}
          findings={viewedFindings.filter((f) => f.status !== "dismissed")}
          latestFindings={latestFindings}
          diffSlot={diffSlot}
        />
      )}

      <div className="space-y-6 pt-2">
        <DecisionsHistory decisions={detail.decisions} now={now} />
        <AuditTimeline events={detail.audit} now={now} audience={reviewerSide ? "reviewer" : "submitter"} />
      </div>
    </div>
  );
}
