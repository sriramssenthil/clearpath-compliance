"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Precedent, PrecedentMatch } from "@/lib/compliance/feature-types";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDay } from "./format";

const OUTCOME: Record<Precedent["outcome"], { label: string; variant: BadgeVariant; title: string }> = {
  fixed: { label: "Fixed", variant: "success", title: "The wording was changed and the revised version passed review" },
  dismissed: { label: "Dismissed", variant: "neutral", title: "The reviewer judged the wording acceptable" },
  rejected: { label: "Rejected", variant: "danger", title: "The asset was rejected" },
};

export interface PrecedentListProps {
  matches: PrecedentMatch[];
  /** Submission code to id, from loadPrecedentData(); live precedents link to their submission. */
  submissionIds?: Record<string, number>;
  /** Start expanded (default collapsed to a one-line summary). */
  defaultOpen?: boolean;
  className?: string;
}

/**
 * Reviewer-facing: the most similar past decisions for one finding. The rule says why the wording is a problem;
 * the precedent shows how it was resolved last time.
 * Collapsed by default (native details/summary); clicks inside do not select the surrounding finding card.
 */
export function PrecedentList({ matches, submissionIds, defaultOpen = false, className }: PrecedentListProps) {
  const items = matches.slice(0, 3);
  if (items.length === 0) return null;
  const fixed = items.filter((m) => m.precedent.outcome === "fixed").length;
  const summary = `${items.length} similar past decision${items.length === 1 ? "" : "s"}${fixed ? `, ${fixed} fixed` : ""}`;

  return (
    <details
      open={defaultOpen}
      className={cn("group mt-2.5 border-t border-border pt-2 text-sm", className)}
      onClick={(e) => e.stopPropagation()}
    >
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs text-muted hover:text-foreground [&::-webkit-details-marker]:hidden">
        <ChevronRight aria-hidden className="size-3.5 shrink-0 transition-transform group-open:rotate-90" />
        <span className="hidden font-medium uppercase tracking-wide text-subtle sm:inline">Similar past decisions</span>
        <span aria-hidden className="hidden text-border-strong sm:inline">/</span>
        <span>{summary}</span>
      </summary>
      <p className="mt-1.5 text-xs text-subtle">
        Ranked by shared wording, with extra weight for the same rule. Matches are suggestions from history, not rulings.
      </p>
      <ol className="mt-2 space-y-2">
        {items.map((m) => (
          <PrecedentItem key={m.precedent.id} match={m} submissionId={m.precedent.submissionCode ? submissionIds?.[m.precedent.submissionCode] : undefined} />
        ))}
      </ol>
    </details>
  );
}

function PrecedentItem({ match: m, submissionId }: { match: PrecedentMatch; submissionId?: number }) {
  const p = m.precedent;
  const outcome = OUTCOME[p.outcome];
  const changed = p.approvedText && p.approvedText.trim() !== p.originalText.trim();
  const href =
    p.source === "live" && p.submissionCode
      ? submissionId
        ? `/submissions/${submissionId}`
        : `/submissions?q=${encodeURIComponent(p.submissionCode)}`
      : null;

  return (
    <li className="border border-border bg-background p-2.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Badge variant={outcome.variant} title={outcome.title}>{outcome.label}</Badge>
        {m.sameRule ? (
          <Badge variant="accent" title="Flagged under the same rule as this finding">Same rule</Badge>
        ) : (
          <Badge variant="neutral" title="Flagged under a different rule, but the wording is close">
            Other rule <code className="font-mono text-[11px]">{p.ruleCode}</code>
          </Badge>
        )}
        <span className="ml-auto text-xs text-muted">
          {p.reviewerName}, <time dateTime={p.decidedAt.toISOString()}>{formatDay(p.decidedAt)}</time>
        </span>
      </div>

      <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-subtle">Original wording</p>
      <blockquote className="mt-0.5 line-clamp-4 break-words border-l-2 border-border-strong bg-surface-muted px-2.5 py-1.5 font-mono text-[12.5px] leading-relaxed text-foreground">
        {p.originalText}
      </blockquote>

      {changed ? (
        <>
          <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-success">What passed</p>
          <blockquote className="mt-0.5 break-words border-l-2 border-success-line bg-success-soft px-2.5 py-1.5 text-[13px] leading-relaxed text-foreground">
            {p.approvedText}
          </blockquote>
        </>
      ) : null}

      <p className="mt-2 leading-relaxed text-foreground">
        <span className="text-muted">{p.reviewerName.split(" ")[0]}: </span>
        &ldquo;{p.reviewerComment}&rdquo;
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {m.matchedTerms.length > 0 ? (
          <>
            <span className="text-xs text-subtle" title="Words this finding and the past decision share">Shared terms</span>
            {m.matchedTerms.map((t) => (
              <span key={t} className="border border-border-strong px-1.5 py-px font-mono text-[11px] text-muted">{t}</span>
            ))}
          </>
        ) : null}
        <span className="ml-auto flex items-center gap-3 text-xs">
          <span className="text-subtle" title="Similarity from 0 to 100: shared wording, plus weight for the same rule, product and channel">
            Match {Math.round(m.score * 100)}
          </span>
          {href ? (
            <Link href={href} className="text-accent underline-offset-2 hover:underline">
              Open {p.submissionCode}
            </Link>
          ) : (
            <span className="text-subtle" title="From the review history kept before ClearPath Review">Pre-app history</span>
          )}
        </span>
      </div>
    </li>
  );
}
