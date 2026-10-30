import { Badge } from "@/components/ui/badge";
import type { ChangeHunk, ChangeScope } from "@/lib/compliance/feature-types";

const LONG = 240;
const KIND_LABEL: Record<ChangeHunk["kind"], string> = { added: "Added", removed: "Removed", changed: "Changed" };

const delClass = "rounded-[3px] bg-danger-soft px-0.5 text-danger decoration-danger decoration-2";
const insClass =
  "rounded-[3px] bg-success-soft px-0.5 text-success underline decoration-success decoration-2 underline-offset-4 [text-decoration-skip-ink:none]";

/** Which stretches of text changed against the earlier version or the master, and whether each touches a claim. Pure render. */
export function ChangeScopePanel({ scope }: { scope: ChangeScope }) {
  const total = scope.hunks.length;
  const against = scope.comparedTo.kind === "master" ? `the approved master (${scope.comparedTo.label})` : scope.comparedTo.label;

  return (
    <section aria-label="Change scope" className="space-y-4">
      <Banner scope={scope} />
      <p className="text-xs text-subtle">
        Compared with {against}. Each change is checked for numbers, finance terms, disclosures, rule patterns and text flagged earlier.
        When unsure it is marked regulated. This is a reviewer aid: nothing is approved automatically.
      </p>
      {total > 0 ? (
        <ol className="divide-y divide-border border-y border-border">
          {scope.hunks.map((h, i) => (
            <HunkRow key={i} hunk={h} index={i + 1} total={total} />
          ))}
        </ol>
      ) : null}
    </section>
  );
}

function Banner({ scope }: { scope: ChangeScope }) {
  const total = scope.hunks.length;
  if (total === 0) {
    return (
      <div role="status" className="border border-neutral-line bg-neutral-soft px-3.5 py-2.5 text-sm">
        <p className="font-medium text-foreground">No changes</p>
        <p className="mt-0.5 text-muted">{scope.summary}</p>
      </div>
    );
  }
  if (scope.fastTrack) {
    return (
      <div role="status" className="border border-success-line bg-success-soft px-3.5 py-2.5 text-sm">
        <p className="font-medium text-success">No claim or disclosure changed: fast-track eligible. You still decide.</p>
        <p className="mt-0.5 text-muted">{scope.summary.replace(/ Fast-track eligible\.$/u, "")}</p>
      </div>
    );
  }
  return (
    <div role="status" className="border border-warning-line bg-warning-soft px-3.5 py-2.5 text-sm">
      <p className="font-medium text-warning">
        {scope.regulatedCount} of {total} {total === 1 ? "change touches" : "changes touch"} claims or disclosures
      </p>
      <p className="mt-0.5 text-muted">{scope.summary} Review the regulated changes in full.</p>
    </div>
  );
}

function HunkRow({ hunk, index, total }: { hunk: ChangeHunk; index: number; total: number }) {
  const long = hunk.before.length + hunk.after.length > LONG;
  const body = <HunkText hunk={hunk} />;
  return (
    <li className="space-y-2 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="text-xs font-medium text-subtle">
          <span className="sr-only">Change </span>
          {index} of {total} · {KIND_LABEL[hunk.kind]}
        </span>
        {hunk.regulated ? (
          <Badge variant="warning" dot title="This change may alter a claim or disclosure. Review it in full.">
            Regulated
          </Badge>
        ) : (
          <Badge variant="neutral" title="No number, finance term, disclosure, rule pattern or flagged text is involved.">
            Not regulated
          </Badge>
        )}
      </div>
      {long ? (
        <details className="group">
          <summary className="cursor-pointer text-sm text-muted hover:text-foreground">
            <span className="group-open:hidden">{preview(hunk)}</span>
            <span className="hidden group-open:inline">Hide full text</span>
          </summary>
          <div className="mt-2">{body}</div>
        </details>
      ) : (
        body
      )}
      {hunk.reasons.length > 0 ? (
        <ul aria-label="Why it is regulated" className="flex flex-wrap gap-1.5">
          {hunk.reasons.map((r) => (
            <li key={r} className="border border-border px-1.5 py-0.5 text-xs text-muted">
              {r}
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function HunkText({ hunk }: { hunk: ChangeHunk }) {
  return (
    <p className="whitespace-pre-wrap break-words text-[15px] leading-7 text-foreground">
      {hunk.before ? (
        <del className={delClass}>
          <span className="sr-only">Removed: </span>
          {hunk.before}
        </del>
      ) : null}
      {hunk.before && hunk.after ? (
        <span aria-hidden className="px-2 text-subtle">
          to
        </span>
      ) : null}
      {hunk.after ? (
        <ins className={insClass}>
          <span className="sr-only">Added: </span>
          {hunk.after}
        </ins>
      ) : null}
    </p>
  );
}

function preview(h: ChangeHunk): string {
  const cut = (s: string) => (s.length > 80 ? `${s.slice(0, 80).trimEnd()}...` : s);
  const text = h.kind === "added" ? `Added "${cut(h.after)}"` : h.kind === "removed" ? `Removed "${cut(h.before)}"` : `"${cut(h.before)}" to "${cut(h.after)}"`;
  return `${text} (show full text)`;
}
