"use client";

import { useEffect, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { FindingCard, type FindingCardProps } from "./finding-card";
import { FILTER_LABEL, type FindingFilter, type FindingVM } from "./view-models";

export interface AnalysisInfo {
  status: "pending" | "complete" | "rules_only" | "failed";
  summary: string | null;
  model: string | null;
}

export function AnalysisSummary({ analysis }: { analysis: AnalysisInfo }) {
  const chip =
    analysis.status === "complete" ? { label: "Rules + AI", variant: "info" as const }
    : analysis.status === "rules_only" ? { label: "Rules only", variant: "warning" as const }
    : analysis.status === "failed" ? { label: "Analysis failed", variant: "danger" as const }
    : { label: "Analysis pending", variant: "neutral" as const };
  return (
    <section aria-label="Automated analysis summary" className="rounded-lg border border-border bg-surface p-3.5 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-medium text-foreground">Automated analysis</h3>
        <Badge variant={chip.variant}>{chip.label}</Badge>
        {analysis.model ? <span className="text-xs text-subtle">Model: {analysis.model}</span> : null}
      </div>
      {analysis.summary ? <p className="mt-2 leading-relaxed text-foreground">{analysis.summary}</p> : null}
      {analysis.status === "rules_only" ? (
        <p className="mt-2 rounded-md border border-warning-line bg-warning-soft px-2.5 py-1.5 text-xs text-warning">
          The AI review was unavailable for this version, so only the deterministic rule checks ran. Read the text yourself for anything the rules cannot see.
        </p>
      ) : null}
      <p className="mt-2 text-xs text-subtle">The checker only adds flags. It never approves anything; every decision is the reviewer&apos;s.</p>
    </section>
  );
}

interface Props extends Pick<FindingCardProps, "onAccept" | "onReopen" | "onDismiss" | "onDismissOpenChange" | "onSelect"> {
  analysis: AnalysisInfo;
  findings: FindingVM[];
  unlocated: Set<number>;
  filter: FindingFilter;
  onFilter: (f: FindingFilter) => void;
  selectedId: number | null;
  selectTick: number;
  canAct: boolean;
  pendingId: number | null;
  errors: Record<number, string>;
  dismissOpenId: number | null;
  /** Rendered above the list, e.g. the add-finding form. */
  top?: ReactNode;
}

const FILTERS: FindingFilter[] = ["open", "accepted", "dismissed", "resolved", "all"];

export function matchesFilter(f: FindingVM, filter: FindingFilter) {
  return filter === "all" || f.status === filter;
}

export function FindingsPanel({
  analysis, findings, unlocated, filter, onFilter, selectedId, selectTick, canAct, pendingId, errors, dismissOpenId, top,
  onSelect, onAccept, onReopen, onDismiss, onDismissOpenChange,
}: Props) {
  const counts: Record<FindingFilter, number> = { open: 0, accepted: 0, dismissed: 0, resolved: 0, all: findings.length };
  for (const f of findings) counts[f.status] += 1;
  const shown = findings.filter((f) => matchesFilter(f, filter));
  const located = shown.filter((f) => !unlocated.has(f.id));
  const notLocated = shown.filter((f) => unlocated.has(f.id));

  useEffect(() => {
    if (selectedId === null) return;
    const el = document.getElementById(`finding-${selectedId}`);
    if (!el) return;
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    el.focus({ preventScroll: true });
  }, [selectedId, selectTick]);

  const card = (f: FindingVM) => (
    <li key={f.id}>
      <FindingCard
        finding={f}
        selected={f.id === selectedId}
        canAct={canAct}
        pending={pendingId === f.id}
        error={errors[f.id] ?? null}
        dismissOpen={dismissOpenId === f.id}
        onSelect={onSelect}
        onAccept={onAccept}
        onReopen={onReopen}
        onDismiss={onDismiss}
        onDismissOpenChange={onDismissOpenChange}
      />
    </li>
  );

  return (
    <div className="space-y-3">
      <AnalysisSummary analysis={analysis} />
      {top}
      <div role="group" aria-label="Filter findings by state" className="flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1">
        {FILTERS.map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={filter === k}
            onClick={() => onFilter(k)}
            className={cn(
              "flex-1 whitespace-nowrap rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
              filter === k ? "bg-accent text-accent-foreground" : "text-muted hover:bg-surface-muted hover:text-foreground",
            )}
          >
            {FILTER_LABEL[k]} <span className={cn("tabular-nums", filter === k ? "opacity-90" : "text-subtle")}>({counts[k]})</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border-strong px-4 py-6 text-center text-sm text-muted">
          {findings.length === 0
            ? "No findings were raised for this version. The checker found nothing to flag; read the text before deciding."
            : filter === "open"
              ? "No open findings. Every flag has been decided."
              : `No ${FILTER_LABEL[filter].toLowerCase()} findings.`}
        </p>
      ) : (
        <>
          {located.length > 0 ? <ul role="list" className="space-y-2.5">{located.map(card)}</ul> : null}
          {notLocated.length > 0 ? (
            <section aria-label="Not located in the text" className="space-y-2.5">
              <h3 className="pt-1 text-xs font-medium uppercase tracking-wide text-subtle">Not located in the text ({notLocated.length})</h3>
              <ul role="list" className="space-y-2.5">{notLocated.map(card)}</ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
