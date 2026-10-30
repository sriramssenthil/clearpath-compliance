"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { FindingCard } from "./finding-card";
import { HighlightedText, type HighlightMark } from "./highlighted-text";
import type { FindingVM } from "./view-models";

/** Read-only text with highlighted findings plus the matching cards. Dismissed findings never reach this component. */
export function SubmitterText({ versionNumber, content, findings, diffSlot }: { versionNumber: number; content: string; findings: FindingVM[]; diffSlot: ReactNode | null }) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  const marks: HighlightMark[] = useMemo(
    () => findings.map((f) => ({ id: f.id, start: f.start, end: f.end, severity: f.severity, status: f.status, label: `${f.severity} severity: ${f.ruleTitle} (${f.status})` })),
    [findings],
  );
  useEffect(() => {
    if (selectedId === null) return;
    const el = document.getElementById(`finding-${selectedId}`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    el?.focus({ preventScroll: true });
  }, [selectedId, tick]);

  const select = (id: number) => {
    setSelectedId(id);
    setTick((t) => t + 1);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <section aria-label="Asset text" className="min-w-0 rounded-lg border border-border bg-surface shadow-card">
        <div className="border-b border-border px-5 py-3">
          <h2 className="text-sm font-medium text-foreground">{diffSlot ? `Changes in version ${versionNumber}` : `Your text, version ${versionNumber}`}</h2>
        </div>
        <div className="px-5 py-5 sm:px-8">
          {diffSlot ?? <HighlightedText content={content} marks={marks} selectedId={selectedId} pulseKey={tick} onSelect={select} className="mx-auto max-w-[68ch]" />}
        </div>
      </section>
      <section aria-label="Flagged in this version" className="min-w-0 space-y-3">
        <div>
          <h2 className="text-sm font-medium text-foreground">Flagged in this version ({findings.length})</h2>
          <p className="mt-0.5 text-xs text-muted">
            Open: flagged automatically, not yet confirmed by compliance. Accepted: confirmed by a reviewer and must be fixed. Resolved: fixed in a later version.
          </p>
        </div>
        {findings.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border-strong px-4 py-6 text-center text-sm text-muted">Nothing is flagged in this version.</p>
        ) : (
          <ul role="list" className="space-y-2.5">
            {findings.map((f) => (
              <li key={f.id}>
                <FindingCard finding={f} selected={f.id === selectedId} canAct={false} audience="submitter" onSelect={select} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
