import { formatWeekLabel, niceMax, niceTicks, pluralize, stackSegments } from "./format";
import type { DashboardStats } from "@/lib/workflow/queries";

const SERIES = [
  { key: "approved", label: "Approved", swatch: "bg-success" },
  { key: "changesRequested", label: "Changes requested", swatch: "bg-accent" },
  { key: "rejected", label: "Rejected", swatch: "bg-danger" },
] as const;

/**
 * Stacked bars built from CSS, not a chart library, so text stays crisp at any width.
 * The visually hidden table below is the accessible equivalent of the whole figure.
 */
export function WeeklyChart({ weeks }: { weeks: DashboardStats["weekly"] }) {
  const totals = weeks.map((w) => w.approved + w.changesRequested + w.rejected);
  const grand = totals.reduce((a, b) => a + b, 0);
  const axisMax = niceMax(Math.max(0, ...totals));
  const ticks = niceTicks(Math.max(0, ...totals));

  return (
    <figure>
      <figcaption className="sr-only">Decisions per week over the last 8 weeks, by outcome. A table with the same numbers follows.</figcaption>

      <ul className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-sm" aria-label="Legend">
        {SERIES.map((s) => {
          const sum = weeks.reduce((n, w) => n + w[s.key], 0);
          return (
            <li key={s.key} className="flex items-center gap-2">
              <span aria-hidden className={`size-3 rounded-sm ${s.swatch}`} />
              <span>{s.label}</span>
              <span className="tabular-nums text-subtle">{sum}</span>
            </li>
          );
        })}
      </ul>

      {grand === 0 ? (
        <p className="rounded-md border border-dashed border-border-strong px-4 py-10 text-center text-sm text-muted">
          No decisions were recorded in the last 8 weeks.
        </p>
      ) : (
        <div aria-hidden className="flex gap-2 pt-3">
          <div className="relative h-56 w-7 shrink-0 text-right text-xs tabular-nums text-subtle">
            {ticks.map((t) => (
              <span key={t} className="absolute right-0 -translate-y-1/2" style={{ bottom: `${(t / axisMax) * 100}%` }}>
                {t}
              </span>
            ))}
          </div>
          <div className="min-w-0 flex-1">
            <div className="relative h-56">
              {ticks.map((t) => (
                <div key={t} className="absolute inset-x-0 border-t border-border" style={{ bottom: `${(t / axisMax) * 100}%` }} />
              ))}
              <div className="absolute inset-0 grid grid-cols-8 gap-1.5 sm:gap-3">
                {weeks.map((w, i) => {
                  const segs = stackSegments(SERIES.map((s) => ({ key: s.key, value: w[s.key] })), axisMax);
                  return (
                    <div key={w.weekStart} className="relative">
                      {segs.map((seg, si) =>
                        seg.value > 0 ? (
                          <div
                            key={seg.key}
                            className={`absolute inset-x-0 flex items-center justify-center overflow-hidden text-[11px] font-medium text-accent-foreground ${SERIES[si].swatch} ${seg.bottomPct + seg.heightPct >= (totals[i] / axisMax) * 100 - 0.01 ? "rounded-t" : ""}`}
                            style={{ bottom: `${seg.bottomPct}%`, height: `${seg.heightPct}%`, boxShadow: "inset 0 1px 0 var(--surface)" }}
                          >
                            {seg.heightPct >= 7 ? seg.value : null}
                          </div>
                        ) : null,
                      )}
                      {totals[i] > 0 ? (
                        <span className="absolute inset-x-0 text-center text-xs font-medium tabular-nums" style={{ bottom: `calc(${(totals[i] / axisMax) * 100}% + 2px)` }}>
                          {totals[i]}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-1.5 grid grid-cols-8 gap-1.5 text-center text-[11px] text-subtle sm:gap-3 sm:text-xs">
              {weeks.map((w) => (
                <span key={w.weekStart} className="leading-tight">
                  {formatWeekLabel(w.weekStart)}
                </span>
              ))}
            </div>
            <p className="mt-1 text-center text-xs text-subtle">Week starting (Monday)</p>
          </div>
        </div>
      )}

      <div className="sr-only">
      <table>
        <caption>Decisions per week, last 8 weeks</caption>
        <thead>
          <tr>
            <th scope="col">Week starting</th>
            <th scope="col">Approved</th>
            <th scope="col">Changes requested</th>
            <th scope="col">Rejected</th>
            <th scope="col">Total</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((w, i) => (
            <tr key={w.weekStart}>
              <th scope="row">{w.weekStart}</th>
              <td>{w.approved}</td>
              <td>{w.changesRequested}</td>
              <td>{w.rejected}</td>
              <td>{pluralize(totals[i], "decision")}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </figure>
  );
}
