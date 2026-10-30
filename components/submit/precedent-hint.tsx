"use client";

import type { PrecedentMatch } from "@/lib/compliance/feature-types";
import { CopyButton } from "@/components/review/copy-button";
import { cn } from "@/lib/utils";

/**
 * Submitter-facing: wording compliance approved for a similar claim before. Only "fixed" precedents with a known
 * approved wording are shown, anonymised (no reviewer, partner, submission or original text).
 */
export function PrecedentHint({ matches, max = 2, className }: { matches: PrecedentMatch[] | undefined; max?: number; className?: string }) {
  const texts: string[] = [];
  for (const m of matches ?? []) {
    const t = m.precedent.outcome === "fixed" ? m.precedent.approvedText?.trim() : undefined;
    if (t && !texts.includes(t)) texts.push(t);
    if (texts.length === max) break;
  }
  if (texts.length === 0) return null;

  return (
    <div className={cn("mt-2.5 border border-border bg-background p-2.5 text-sm", className)}>
      <p className="text-xs font-medium uppercase tracking-wide text-subtle">Compliance approved this wording before</p>
      <ul className="mt-1.5 space-y-2">
        {texts.map((t) => (
          <li key={t} className="flex items-start gap-2">
            <blockquote className="min-w-0 flex-1 break-words border-l-2 border-success-line pl-2.5 leading-relaxed text-foreground">{t}</blockquote>
            <CopyButton text={t} className="shrink-0" />
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-subtle">From a similar claim in an earlier review. Adapt it to your asset; it is still reviewed.</p>
    </div>
  );
}
