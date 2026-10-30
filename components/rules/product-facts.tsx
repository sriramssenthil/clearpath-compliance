import type { ProductFacts } from "@/lib/compliance/types";
import { PRODUCT_LABEL } from "@/components/queue/labels";
import { CopyButton } from "./copy-button";

const usd = (n: number) => `$${n.toLocaleString("en-US")}`;
const pct = (n: number) => `${n}%`;

function factRows(f: ProductFacts["facts"]): [string, string][] {
  const rows: [string, string][] = [];
  if (f.aprMin !== undefined && f.aprMax !== undefined) rows.push(["Offered APR range", `${pct(f.aprMin)} to ${pct(f.aprMax)}`]);
  if (f.amountMin !== undefined && f.amountMax !== undefined) rows.push(["Amounts", `${usd(f.amountMin)} to ${usd(f.amountMax)}`]);
  if (f.termMonthsMin !== undefined && f.termMonthsMax !== undefined) rows.push(["Terms", `${f.termMonthsMin} to ${f.termMonthsMax} months`]);
  if (f.introAprPercent !== undefined) rows.push(["Introductory APR", `${pct(f.introAprPercent)}${f.introMonths ? ` for ${f.introMonths} months` : ""}`]);
  if (f.annualFee !== undefined) rows.push(["Annual fee", usd(f.annualFee)]);
  return rows;
}

/** One product's facts and approved snippets, in a native disclosure so it works without client JS. */
export function ProductFactsPanel({ data, defaultOpen }: { data: ProductFacts; defaultOpen?: boolean }) {
  const rows = factRows(data.facts);
  return (
    <details open={defaultOpen} className="group rounded-lg border border-border bg-surface shadow-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-4 py-3 marker:hidden [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block font-medium">{data.facts.displayName}</span>
          <span className="block text-xs text-subtle">
            {PRODUCT_LABEL[data.product]} &middot; {data.approvedSnippets.length} approved snippets
          </span>
        </span>
        <span aria-hidden className="text-xs text-subtle group-open:hidden">Show</span>
        <span aria-hidden className="hidden text-xs text-subtle group-open:inline">Hide</span>
      </summary>
      <div className="space-y-5 border-t border-border px-4 py-4">
        <section aria-label={`${data.facts.displayName} facts`}>
          <h3 className="text-sm font-medium">Facts</h3>
          <dl className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-subtle">{k}</dt>
                <dd className="text-sm font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          {data.facts.notes.length > 0 ? (
            <>
              <h4 className="mt-4 text-xs font-medium uppercase tracking-wide text-subtle">Notes the checker applies</h4>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted">
                {data.facts.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
        <section aria-label={`${data.facts.displayName} approved snippets`}>
          <h3 className="text-sm font-medium">Approved disclosure snippets</h3>
          <ul className="mt-2 space-y-3">
            {data.approvedSnippets.map((s) => (
              <li key={s.id} className="rounded-md border border-border bg-surface-muted/50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{s.label}</p>
                    <p className="font-mono text-xs text-subtle">{s.id}</p>
                  </div>
                  <CopyButton text={s.text} label={s.label} />
                </div>
                <p className="mt-2 text-sm text-muted">{s.text}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </details>
  );
}
