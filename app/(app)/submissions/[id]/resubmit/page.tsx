import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, MessageSquareText } from "lucide-react";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackChecklist } from "@/components/submit/feedback-checklist";
import { ResubmitForm } from "@/components/submit/resubmit-form";
import { formatAbsolute, relativeTime } from "@/components/submit/format";
import { currentActor } from "@/lib/workflow/action-helpers";
import { getDetail } from "@/lib/workflow/queries";
import { WorkflowError, type SubmissionDetail } from "@/lib/workflow/types";

// Server actions on this page call the model (5-15 s); allow headroom beyond the host default.
export const maxDuration = 60;

export const metadata: Metadata = { title: "Resubmit" };

export default async function ResubmitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const actor = await currentActor();
  let detail: SubmissionDetail;
  try {
    detail = await getDetail(actor, id);
  } catch (err) {
    if (err instanceof WorkflowError && err.code === "not_found") notFound();
    throw err;
  }
  if (!detail.permissions.canResubmit) redirect(`/submissions/${id}`);

  const version = detail.versions.find((v) => v.number === detail.currentVersion) ?? detail.versions[detail.versions.length - 1];
  const decision = [...detail.decisions].reverse().find((d) => d.outcome === "changes_requested") ?? null;
  const checklist = version.findings
    .filter((f) => f.status === "accepted")
    .map((f) => ({ id: f.id, severity: f.severity, ruleTitle: f.ruleTitle, ruleCode: f.ruleCode, quote: f.quote, issue: f.issue, suggestion: f.suggestion }));
  const message = decision?.feedbackDraft ?? decision?.note ?? null;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/submissions/${id}`} className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-foreground">
          <ArrowLeft aria-hidden className="size-4" />
          Back to {detail.code}
        </Link>
        <h1 className="mt-2 text-2xl font-medium tracking-tight">Submit a new version</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          {detail.code} is waiting on you. Work through the feedback below, edit the text or upload a corrected file, check it, then send it back. Version {detail.currentVersion + 1} gets a
          faster review than a first submission.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquareText aria-hidden className="size-4 text-warning" />
            What compliance asked you to change
          </CardTitle>
          {decision ? (
            <CardDescription>
              From {decision.reviewerName} on version {decision.versionNumber},{" "}
              <time dateTime={decision.createdAt.toISOString()} title={formatAbsolute(decision.createdAt)}>
                {relativeTime(decision.createdAt)}
              </time>
            </CardDescription>
          ) : null}
        </CardHeader>
        <CardBody className="space-y-5">
          {message ? (
            <figure>
              <figcaption className="sr-only">Message from the reviewer</figcaption>
              <div className="whitespace-pre-wrap rounded-md border border-border bg-surface-muted px-4 py-3 text-sm leading-6 [overflow-wrap:anywhere]">{message}</div>
            </figure>
          ) : (
            <p className="text-sm text-muted">The reviewer did not leave a written note.</p>
          )}
          <div>
            <h2 className="text-sm font-medium">Findings to fix ({checklist.length})</h2>
            {checklist.length > 0 ? (
              <div className="mt-2">
                <FeedbackChecklist items={checklist} />
              </div>
            ) : (
              <p className="mt-1 text-sm text-muted">No individual findings were marked as required. Follow the note above.</p>
            )}
          </div>
        </CardBody>
      </Card>

      <ResubmitForm
        submissionId={id}
        title={detail.title}
        product={detail.product}
        channel={detail.channel}
        states={detail.states}
        initialContent={version.inputText ?? (version.asset ? "" : version.content)}
        currentAsset={version.asset}
      />
    </div>
  );
}
