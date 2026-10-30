"use client";

import { useRef, useState } from "react";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CopyButton } from "./copy-button";
import { QUICK_DISMISS_REASONS, SOURCE_LABEL, type FindingVM } from "./view-models";

const SEV_TEXT = { high: "High severity", medium: "Medium severity", low: "Low severity" } as const;
const SEV_BORDER = { high: "border-sev-high", medium: "border-sev-medium", low: "border-sev-low" } as const;
const STATUS_TONE: Record<FindingVM["status"], { label: string; variant: BadgeVariant }> = {
  open: { label: "Open", variant: "neutral" },
  accepted: { label: "Accepted", variant: "accent" },
  dismissed: { label: "Dismissed", variant: "neutral" },
  resolved: { label: "Resolved", variant: "success" },
};

export interface FindingCardProps {
  finding: FindingVM;
  selected: boolean;
  /** Reviewer actions available (permission and latest version). */
  canAct: boolean;
  pending?: boolean;
  error?: string | null;
  dismissOpen?: boolean;
  /** Submitter view: hides reviewer-only detail (dismissal reasons, who acted). */
  audience?: "reviewer" | "submitter";
  onSelect?: (id: number) => void;
  onAccept?: (id: number) => void;
  onReopen?: (id: number) => void;
  onDismiss?: (id: number, reason: string) => void;
  onDismissOpenChange?: (id: number, open: boolean) => void;
}

export function FindingCard({
  finding: f, selected, canAct, pending = false, error = null, dismissOpen = false, audience = "reviewer",
  onSelect, onAccept, onReopen, onDismiss, onDismissOpenChange,
}: FindingCardProps) {
  const status = STATUS_TONE[f.status];
  const located = f.start !== null && f.end !== null;
  const dismissed = f.status === "dismissed";
  const resolved = f.status === "resolved";

  return (
    <article
      id={`finding-${f.id}`}
      tabIndex={-1}
      aria-label={`${SEV_TEXT[f.severity]}: ${f.ruleTitle}`}
      aria-current={selected ? "true" : undefined}
      data-status={f.status}
      onClick={() => onSelect?.(f.id)}
      className={cn(
        "scroll-mt-3 rounded-lg border bg-surface p-3.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
        selected ? "border-accent ring-1 ring-accent" : "border-border hover:border-border-strong",
        (dismissed || resolved) && !selected && "bg-surface-muted/60",
      )}
    >
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Badge variant={`severity-${f.severity}`} dot>{SEV_TEXT[f.severity]}</Badge>
        <Badge variant={status.variant}>{status.label}</Badge>
        <span className="ml-auto text-xs text-subtle">
          {f.source === "ai" ? `${SOURCE_LABEL.ai}${f.confidence ? `, ${f.confidence} confidence` : ""}` : SOURCE_LABEL[f.source]}
        </span>
      </header>

      <h4 className={cn("mt-2 font-semibold leading-snug text-foreground", (dismissed || resolved) && "text-muted")}>{f.ruleTitle}</h4>
      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
        <code className="rounded bg-surface-muted px-1 py-0.5 font-mono text-[11px] text-foreground">{f.ruleCode}</code>
        {f.citation ? <span>{f.citation}</span> : null}
      </p>

      <blockquote className={cn("mt-2.5 break-words rounded-sm border-l-[3px] bg-surface-muted px-2.5 py-1.5 font-mono text-[12.5px] leading-relaxed text-foreground", SEV_BORDER[f.severity])}>
        {f.quote}
        {!located ? <span className="mt-1 block font-sans text-[11px] text-subtle">Not located verbatim in the text (for example, a missing disclosure).</span> : null}
      </blockquote>

      <p className="mt-2.5 leading-relaxed text-foreground">{f.issue}</p>

      {f.suggestion ? (
        <div className="mt-2.5 rounded-md border border-border bg-background p-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-subtle">Suggested fix</span>
            <CopyButton text={f.suggestion} />
          </div>
          <p className="mt-1 leading-relaxed text-foreground">{f.suggestion}</p>
        </div>
      ) : null}

      {f.source === "ai" && audience === "reviewer" ? (
        <p className="mt-2 text-xs italic text-subtle">The model only flags possible issues. The reviewer decides what stands.</p>
      ) : null}

      {f.status !== "open" && (f.actedByName || f.actedAbs) && audience === "reviewer" ? (
        <p className="mt-2 text-xs text-muted">
          {f.status === "accepted" ? "Accepted" : f.status === "dismissed" ? "Dismissed" : "Resolved"}
          {f.actedByName ? ` by ${f.actedByName}` : f.status === "resolved" ? " automatically in a later version" : ""}
          {f.actedAbs ? (
            <>
              {", "}
              <time title={f.actedAbs}>{f.actedRel}</time>
            </>
          ) : null}
        </p>
      ) : null}
      {f.status === "resolved" && !f.actedAbs && audience === "reviewer" ? (
        <p className="mt-2 text-xs text-muted">Resolved automatically: the rule was no longer raised in a later version.</p>
      ) : null}
      {dismissed && f.dismissReason && audience === "reviewer" ? (
        <p className="mt-1 text-xs text-muted">
          <span className="font-medium text-foreground">Reason:</span> {f.dismissReason}
        </p>
      ) : null}

      {canAct && !resolved ? (
        <div className="mt-3 border-t border-border pt-3">
          {dismissOpen ? (
            <DismissForm
              pending={pending}
              onCancel={() => onDismissOpenChange?.(f.id, false)}
              onSubmit={(reason) => onDismiss?.(f.id, reason)}
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              {f.status !== "accepted" ? (
                <Button size="sm" variant="primary" disabled={pending} onClick={() => onAccept?.(f.id)} title="Confirm this is a violation that must be fixed (shortcut: a)">
                  Accept
                </Button>
              ) : null}
              {f.status !== "dismissed" ? (
                <Button size="sm" variant="secondary" disabled={pending} onClick={() => onDismissOpenChange?.(f.id, true)} title="Dismiss with a reason (shortcut: d)">
                  Dismiss
                </Button>
              ) : null}
              {f.status !== "open" ? (
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => onReopen?.(f.id)} title="Return this finding to undecided">
                  Reopen
                </Button>
              ) : null}
              {pending ? <span className="self-center text-xs text-muted" role="status">Saving...</span> : null}
            </div>
          )}
          {error ? <p role="alert" className="mt-2 text-xs text-danger">{error}</p> : null}
        </div>
      ) : null}
    </article>
  );
}

function DismissForm({ pending, onCancel, onSubmit }: { pending: boolean; onCancel: () => void; onSubmit: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const trimmed = reason.trim();
  const invalid = trimmed.length < 3;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (!invalid) onSubmit(trimmed);
      }}
      className="space-y-2"
    >
      <fieldset>
        <legend className="text-xs font-medium text-foreground">Why is this not a violation? (recorded in the audit trail)</legend>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {QUICK_DISMISS_REASONS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => {
                setReason(q === "Other" ? "" : q);
                ref.current?.focus();
              }}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs transition-colors",
                reason === q ? "border-accent bg-accent-soft text-accent" : "border-border-strong bg-surface text-muted hover:bg-surface-muted hover:text-foreground",
              )}
            >
              {q}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="block">
        <span className="sr-only">Dismissal reason</span>
        <textarea
          ref={ref}
          autoFocus
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          onBlur={() => setTouched(true)}
          aria-invalid={touched && invalid}
          placeholder="Reason (required, at least 3 characters)"
          className="w-full resize-y rounded-md border border-border-strong bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-subtle"
        />
      </label>
      {touched && invalid ? <p className="text-xs text-danger">Add a reason of at least 3 characters.</p> : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Dismissing..." : "Confirm dismiss"}
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
