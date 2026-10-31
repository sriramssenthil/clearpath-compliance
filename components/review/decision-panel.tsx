"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { decideAction } from "@/app/(app)/submissions/[id]/actions";
import { approvalBlockers, STATUS_LABEL, type Outcome, type Status } from "@/lib/workflow/flow";
import { FeedbackEmail } from "./feedback-email";
import { feedbackSubject, plural } from "./format";
import type { FindingVM } from "./view-models";

export interface ClosedDecision {
  outcome: Outcome;
  reviewerName: string;
  note: string | null;
  feedbackDraft: string | null;
  versionNumber: number;
  atRel: string;
  atAbs: string;
}

interface Props {
  submissionId: number;
  submissionCode: string;
  submissionTitle: string;
  submitterName: string;
  status: Status;
  versionNumber: number;
  latestNumber: number;
  /** Findings of the latest version: the approval guard is evaluated on these, never on an older version. */
  latestFindings: FindingVM[];
  canDecide: boolean;
  lastDecision: ClosedDecision | null;
  /** Changes whenever another reason box opens (or Escape is pressed); closes the confirm step. */
  closeSignal?: number;
  /** Called when the confirm step opens, so the workspace can close other reason boxes. */
  onConfirmOpen?: () => void;
}

const OUTCOME_VERB: Record<Outcome, string> = { approved: "Approve", changes_requested: "Request changes", rejected: "Reject" };

export function DecisionPanel(p: Props) {
  const [note, setNote] = useState("");
  const [override, setOverride] = useState("");
  // The confirm step belongs to the close signal it was opened under, so a newer signal (another reason
  // box opening, or Escape) closes it without an effect.
  const [confirmState, setConfirmState] = useState<{ outcome: Outcome; signal: number | undefined } | null>(null);
  const confirming = confirmState && confirmState.signal === p.closeSignal ? confirmState.outcome : null;
  const setConfirming = (o: Outcome | null) => setConfirmState(o ? { outcome: o, signal: p.closeSignal } : null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ outcome: Outcome; draft: string | null } | null>(null);
  const [pending, start] = useTransition();

  const first = p.submitterName.split(" ")[0];
  const emailTo = p.submitterName;
  const emailSubject = (o: Outcome) => feedbackSubject(p.submissionCode, p.submissionTitle, o);

  if (!p.canDecide) {
    return (
      <section aria-label="Decision" className="space-y-2.5 rounded-lg border border-border bg-surface p-3.5 text-sm">
        <h3 className="font-medium text-foreground">Decision</h3>
        {sent ? (
          <>
            <p className="text-foreground">{sent.outcome === "approved" ? "Approved. The submitter has been notified." : `${STATUS_LABEL[sent.outcome]} recorded.`}</p>
            {sent.draft ? <FeedbackEmail label={`Sent to ${emailTo} (preview)`} to={emailTo} subject={emailSubject(sent.outcome)} body={sent.draft} /> : null}
          </>
        ) : p.lastDecision ? (
          <>
            <p className="text-foreground">
              <strong>{p.status === "withdrawn" ? STATUS_LABEL.withdrawn : STATUS_LABEL[p.lastDecision.outcome]}</strong> by {p.lastDecision.reviewerName} on version {p.lastDecision.versionNumber},{" "}
              <time title={p.lastDecision.atAbs}>{p.lastDecision.atRel}</time>. This review is read-only.
            </p>
            {p.lastDecision.note ? <p className="rounded-md bg-surface-muted px-2.5 py-1.5 text-muted">Note: {p.lastDecision.note}</p> : null}
            {p.lastDecision.feedbackDraft ? (
              <FeedbackEmail label={`Sent to ${emailTo} (preview)`} to={emailTo} subject={emailSubject(p.lastDecision.outcome)} body={p.lastDecision.feedbackDraft} />
            ) : null}
          </>
        ) : (
          <p className="text-muted">{p.status === "withdrawn" ? "This submission was withdrawn by the submitter side. No further review is possible." : "No decision can be recorded right now."}</p>
        )}
      </section>
    );
  }

  if (p.versionNumber !== p.latestNumber) {
    return (
      <section aria-label="Decision" className="space-y-2 rounded-lg border border-border bg-surface p-3.5 text-sm">
        <h3 className="font-medium text-foreground">Decision</h3>
        <p className="text-muted">You are viewing version {p.versionNumber}. Findings and decisions apply to the latest version only (version {p.latestNumber}).</p>
        <Link href={`/submissions/${p.submissionId}`} className={buttonVariants({ variant: "secondary", size: "sm" })}>View version {p.latestNumber}</Link>
      </section>
    );
  }

  const blockers = approvalBlockers(p.latestFindings);
  const accepted = p.latestFindings.filter((f) => f.status === "accepted");
  const open = p.latestFindings.filter((f) => f.status === "open").length;
  const hasNote = note.trim().length > 0;

  const blocking = p.latestFindings.filter((f) => f.severity === "high" && (f.status === "open" || f.status === "accepted"));
  const overrideOk = override.trim().length >= 10;
  // Approving over high-severity findings is allowed, but only with a written justification (see the confirm step).
  const approveBlockedReason = null;
  const changesBlockedReason = accepted.length === 0 && !hasNote ? "Accept at least one finding or write a note to request changes." : null;
  const rejectBlockedReason = !hasNote ? "A note explaining the rejection is required." : null;

  const openHigh = p.latestFindings.filter((f) => f.severity === "high" && f.status === "open").length;
  const acceptedHigh = accepted.filter((f) => f.severity === "high").length;
  // Accepted findings are decided: the reviewer confirmed them as required changes. The natural next step is
  // to send them back, so "Request changes" becomes the primary action.
  const suggestChanges = accepted.length > 0 && openHigh === 0;
  const summary =
    openHigh > 0
      ? `${plural(openHigh, "high-severity finding")} still ${openHigh === 1 ? "needs" : "need"} a decision: accept ${openHigh === 1 ? "it" : "them"} as a required change or dismiss ${openHigh === 1 ? "it" : "them"} with a reason.`
      : accepted.length > 0
        ? `You accepted ${plural(accepted.length, "finding")} as required change${accepted.length === 1 ? "" : "s"}${acceptedHigh ? ` (${acceptedHigh} high severity)` : ""}${open > 0 ? `, and ${plural(open, "finding")} ${open === 1 ? "is" : "are"} still open` : ""}. Next step: request changes to send ${accepted.length === 1 ? "it" : "them"} to ${first}.${acceptedHigh ? " Approving instead would approve over confirmed issues and needs a written justification." : ""}`
        : open > 0
          ? `No high-severity blockers. ${plural(open, "finding")} still open: decide each, or approve if you are satisfied they do not apply.`
          : "Every finding has a decision. You can approve, request changes or reject.";

  function submit(outcome: Outcome) {
    setError(null);
    start(async () => {
      const res = await decideAction(p.submissionId, {
        outcome,
        note: note.trim() || null,
        overrideReason: outcome === "approved" && blockers > 0 ? override.trim() : null,
      });
      if (res.ok) {
        setSent({ outcome, draft: res.data.feedbackDraft });
        setConfirming(null);
      } else {
        setError(res.error);
        setConfirming(null);
      }
    });
  }

  const blockedReason = (o: Outcome) => (o === "approved" ? approveBlockedReason : o === "changes_requested" ? changesBlockedReason : rejectBlockedReason);

  return (
    <section aria-label="Decision" className="space-y-3 rounded-lg border border-border-strong bg-surface p-3.5 text-sm shadow-card">
      <h3 className="font-medium text-foreground">Your decision</h3>
      <p id="decision-state" className={openHigh > 0 ? "text-sev-high" : suggestChanges ? "text-foreground" : "text-muted"}>{summary}</p>

      {sent ? (
        <p role="status" className="rounded-md border border-success-line bg-success-soft px-2.5 py-1.5 text-success">Decision recorded.</p>
      ) : null}

      <label className="block">
        <span className="text-xs font-medium text-muted">Note to the submitter {confirming === null ? "(required to reject, optional otherwise)" : ""}</span>
        <textarea
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={pending}
          className="mt-1 w-full resize-y rounded-md border border-border-strong bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-subtle"
          placeholder="Shared with the submitter and kept in the audit trail"
        />
      </label>

      {confirming ? (
        <div role="group" aria-label={`Confirm: ${OUTCOME_VERB[confirming]}`} className="space-y-2 rounded-md border border-accent-line bg-accent-soft/50 p-3">
          <p className="font-medium text-foreground">
            {confirming === "approved" ? `Approve version ${p.versionNumber}?` : `${OUTCOME_VERB[confirming]} on version ${p.versionNumber}?`}
          </p>
          <div className="text-muted">
            <p className="text-xs font-medium uppercase tracking-wide text-subtle">{first} will receive</p>
            {confirming === "approved" ? (
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                <li>Status changes to Approved, tied to this exact text of version {p.versionNumber}.</li>
                <li>{hasNote ? "Your note, shown on the approval." : "No note."}</li>
                {blocking.length ? <li>Your override justification, recorded on the approval and on each finding below.</li> : null}
              </ul>
            ) : (
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                <li>An email draft with {plural(accepted.length, "required change")}{accepted.length ? ` (${accepted.map((f) => f.ruleCode).join(", ")})` : ""}.</li>
                <li>{hasNote ? <>Your note: &ldquo;{note.trim().length > 120 ? `${note.trim().slice(0, 120)}...` : note.trim()}&rdquo;</> : "No note."}</li>
                {confirming === "changes_requested" ? <li>A prompt to submit a new version, which returns to you.</li> : <li>The submission closes; a new asset would be needed.</li>}
              </ul>
            )}
          </div>
          {confirming === "approved" && blocking.length ? (
            <div className="space-y-2 border border-warning-line bg-warning-soft p-3">
              <p className="font-medium text-warning">
                You are approving over {plural(blocking.length, "high-severity finding")}
                {blocking.some((f) => f.status === "accepted") ? ", including ones you accepted as confirmed issues" : ""}:
              </p>
              <ul className="space-y-1.5">
                {blocking.map((f) => (
                  <li key={f.id} className="flex items-start justify-between gap-2 text-foreground">
                    <span className="min-w-0">
                      <span className="font-medium">{f.ruleTitle}</span>
                      <span className="ml-1.5 text-xs text-muted">({f.status === "accepted" ? "accepted" : "undecided"})</span>
                      <span className="block truncate text-xs text-muted">&ldquo;{f.quote}&rdquo;</span>
                    </span>
                    <button
                      type="button"
                      className="shrink-0 text-xs text-accent underline underline-offset-4"
                      onClick={() => {
                        const el = document.getElementById(`finding-${f.id}`);
                        el?.scrollIntoView({ block: "center" });
                        el?.focus();
                      }}
                    >
                      Show
                    </button>
                  </li>
                ))}
              </ul>
              <label className="block">
                <span className="text-xs font-medium text-foreground">Why is it acceptable to approve anyway? (required, recorded in the audit trail)</span>
                <textarea
                  rows={3}
                  value={override}
                  onChange={(e) => setOverride(e.target.value)}
                  disabled={pending}
                  className="mt-1 w-full resize-y border border-border-strong bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-subtle"
                  placeholder="For example: Legal confirmed the guarantee language is for a secured product with no credit decision."
                />
              </label>
              {!overrideOk ? <p className="text-xs text-muted">At least 10 characters.</p> : null}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={confirming === "rejected" ? "danger" : "primary"}
              disabled={pending || (confirming === "approved" && blocking.length > 0 && !overrideOk)}
              onClick={() => submit(confirming)}
            >
              {pending ? "Saving..." : confirming === "approved" && blocking.length ? "Approve with override" : `Confirm: ${OUTCOME_VERB[confirming]}`}
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirming(null)}>Back</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {(["approved", "changes_requested", "rejected"] as Outcome[]).map((o) => {
              const reason = blockedReason(o);
              return (
                <Button
                  key={o}
                  variant={
                    o === "rejected" ? "danger" : (o === "changes_requested") === suggestChanges ? "primary" : "secondary"
                  }
                  disabled={pending || reason !== null}
                  aria-describedby={reason ? `blocked-${o}` : undefined}
                  title={reason ?? undefined}
                  onClick={() => {
                    setError(null);
                    setConfirming(o);
                    p.onConfirmOpen?.();
                  }}
                >
                  {o === "approved" && blocking.length ? "Approve with override..." : OUTCOME_VERB[o]}
                </Button>
              );
            })}
          </div>
          {(["changes_requested", "rejected"] as Outcome[]).map((o) => {
            const reason = blockedReason(o);
            return reason ? <p key={o} id={`blocked-${o}`} className="text-xs text-subtle">{OUTCOME_VERB[o]}: {reason}</p> : null;
          })}
          {approveBlockedReason ? <p id="blocked-approved" className="sr-only">Approve: {approveBlockedReason}</p> : null}
        </div>
      )}
      {error ? <p role="alert" className="text-xs text-danger">{error}</p> : null}
    </section>
  );
}
