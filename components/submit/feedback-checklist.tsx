"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { SeverityBadge } from "@/components/ui/badge";

export interface ChecklistItem {
  id: number;
  severity: "high" | "medium" | "low";
  ruleTitle: string;
  ruleCode: string;
  quote: string;
  issue: string;
  suggestion: string | null;
}

/** The findings compliance confirmed, as a checklist the submitter can tick off while editing (not saved anywhere). */
export function FeedbackChecklist({ items }: { items: ChecklistItem[] }) {
  const [done, setDone] = useState<Set<number>>(new Set());
  const toggle = (id: number) =>
    setDone((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  return (
    <div>
      <p className="text-sm text-muted">
        {done.size} of {items.length} marked as fixed. Ticking is just for you; the new version is re-checked in full when you submit it.
      </p>
      <ul className="mt-3 space-y-3">
        {items.map((it) => {
          const checked = done.has(it.id);
          return (
            <li key={it.id} className="rounded-lg border border-border bg-surface p-4">
              <label className="flex cursor-pointer items-start gap-3">
                <input type="checkbox" checked={checked} onChange={() => toggle(it.id)} className="mt-1 size-4 shrink-0 accent-[var(--accent)]" />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <SeverityBadge severity={it.severity} />
                    <span className={cn("text-sm font-medium", checked && "text-muted line-through")}>{it.ruleTitle}</span>
                    <code className="rounded bg-surface-muted px-1.5 py-0.5 text-xs text-muted">{it.ruleCode}</code>
                  </span>
                  <blockquote className="mt-2 border-l-2 border-border-strong pl-3 text-sm italic [overflow-wrap:anywhere]">{it.quote}</blockquote>
                  <span className="mt-2 block text-sm text-muted">{it.issue}</span>
                  {it.suggestion ? (
                    <span className="mt-2 block rounded-md border border-success-line bg-success-soft px-3 py-2 text-sm">
                      <span className="font-medium text-success">Suggested fix: </span>
                      <span className="whitespace-pre-wrap [overflow-wrap:anywhere]">{it.suggestion}</span>
                    </span>
                  ) : null}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
