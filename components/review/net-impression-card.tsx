import { Badge } from "@/components/ui/badge";
import type { NetImpression } from "@/lib/compliance/feature-types";

export { factsForDisplay } from "@/lib/compliance/net-impression";

export interface NetImpressionCardProps {
  impression: NetImpression | null;
  facts: { label: string; value: string }[];
}

/** Reasonable-consumer read next to the real terms. Server-renderable; no client state. */
export function NetImpressionCard({ impression, facts }: NetImpressionCardProps) {
  if (!impression) return null;
  const misleadingCount = impression.beliefs.filter((b) => b.misleading).length;

  return (
    <section aria-labelledby="net-impression-title" className="@container rounded-sm border border-border bg-surface">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border px-5 py-3">
        <h2 id="net-impression-title" className="text-base font-medium tracking-tight text-foreground">
          Net impression
        </h2>
        <p className="text-xs text-muted">
          {impression.beliefs.length === 0
            ? "No specific beliefs listed"
            : `${misleadingCount} of ${impression.beliefs.length} beliefs misleading`}
        </p>
      </header>

      <div className="grid gap-px bg-border @2xl:grid-cols-2">
        <div className="bg-surface px-5 py-4">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted">What a first-time borrower would take away</h3>
          <blockquote className="mt-3 text-base leading-relaxed text-foreground">
            <p>&ldquo;{impression.takeaway}&rdquo;</p>
          </blockquote>
        </div>
        <div className="bg-surface px-5 py-4">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted">What ClearPath actually offers</h3>
          {facts.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No product facts on file.</p>
          ) : (
            <dl className="mt-3 grid grid-cols-[minmax(6rem,auto)_1fr] gap-x-4 gap-y-2 text-sm">
              {facts.map((f) => (
                <div key={f.label} className="contents">
                  <dt className="text-muted">{f.label}</dt>
                  <dd className="min-w-0 text-foreground">{f.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>

      {impression.beliefs.length > 0 ? (
        <div className="border-t border-border">
          <div className="hidden grid-cols-[1fr_1fr_7rem] gap-4 border-b border-border px-5 py-2 text-xs font-medium uppercase tracking-wide text-muted @2xl:grid">
            <span>Belief the ad creates</span>
            <span>Actual term</span>
            <span className="text-right">Read</span>
          </div>
          <ul>
            {impression.beliefs.map((b, i) => (
              <li
                key={i}
                className="grid gap-2 border-b border-border px-5 py-3 text-sm last:border-b-0 @2xl:grid-cols-[1fr_1fr_7rem] @2xl:gap-4"
              >
                <p className="min-w-0 text-foreground">
                  <span className="mr-1 text-xs text-muted md:hidden">Belief:</span>
                  {b.belief}
                </p>
                <p className="min-w-0 text-muted">
                  <span className="mr-1 text-xs md:hidden">Actual:</span>
                  {b.actual}
                </p>
                <div className="md:text-right">
                  {b.misleading ? (
                    <Badge variant="danger" dot title="A reasonable consumer would be misled about a material term">
                      Misleading
                    </Badge>
                  ) : (
                    <Badge variant="neutral" title="Consistent with the actual terms">
                      Accurate
                    </Badge>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <footer className="border-t border-border px-5 py-3 text-xs text-muted">
        Reasonable-consumer read (the UDAAP net-impression test). Advisory: it never blocks or approves anything.
      </footer>
    </section>
  );
}
