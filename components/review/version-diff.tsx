import { diffWordsWithSpace } from "diff";
import { diffStats, diffSummary } from "./diff-stats";

/** Word-level diff of two versions. Pure render (no hooks), so it is computed on the server and passed to the workspace as a slot. */
export function VersionDiff({ previous, current, previousNumber, currentNumber, resolvedFindings }: {
  previous: string;
  current: string;
  previousNumber: number;
  currentNumber: number;
  resolvedFindings: number;
}) {
  const parts = diffWordsWithSpace(previous, current);
  const stats = diffStats(parts);
  return (
    <div>
      <p role="status" className="mb-3 text-sm font-medium text-foreground">
        Version {previousNumber} to version {currentNumber}: {diffSummary(stats, resolvedFindings)}
      </p>
      <p className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-subtle">
        <span><ins className="rounded-[3px] bg-success-soft px-1 text-success underline decoration-success decoration-2 underline-offset-2">Added</ins> underlined</span>
        <span><del className="rounded-[3px] bg-danger-soft px-1 text-danger decoration-danger decoration-2">Removed</del> struck through</span>
      </p>
      <div className="mx-auto max-w-[68ch] whitespace-pre-wrap break-words text-[15px] leading-8 text-foreground" data-diff>
        {parts.map((part, i) =>
          part.added ? (
            <ins key={i} className="rounded-[3px] bg-success-soft px-0.5 text-success underline decoration-success decoration-2 underline-offset-4 [text-decoration-skip-ink:none]">{part.value}</ins>
          ) : part.removed ? (
            <del key={i} className="rounded-[3px] bg-danger-soft px-0.5 text-danger decoration-danger decoration-2">{part.value}</del>
          ) : (
            <span key={i}>{part.value}</span>
          ),
        )}
      </div>
    </div>
  );
}
