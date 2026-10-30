import { LinkPending } from "@/components/ui/link-pending";
import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, SearchX } from "lucide-react";
import { asc } from "drizzle-orm";
import { db, tables } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { currentActor } from "@/lib/workflow/action-helpers";
import { listQueue } from "@/lib/workflow/queries";
import { listPrioritizedQueue } from "@/lib/workflow/queue";
import { Card, CardBody } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { FilterBar } from "@/components/queue/filter-bar";
import { QueueTable } from "@/components/queue/queue-table";
import { PriorityExplainer } from "@/components/queue/priority-explainer";
import { activeFilterCount, parseQueueView, queueHref, queueStats, STATUS_VIEWS, toQueueFilters } from "@/components/queue/params";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Review queue" };

function Stat({ label, value, tone, hint }: { label: string; value: number; tone?: "danger" | "warning"; hint: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3 shadow-card">
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className={cn("mt-0.5 text-2xl font-medium tabular-nums tracking-tight", value > 0 && tone === "danger" && "text-danger", value > 0 && tone === "warning" && "text-warning")}>
        {value}
      </dd>
      <p className="text-xs text-subtle">{hint}</p>
    </div>
  );
}

const EMPTY: Record<string, { title: string; body: string }> = {
  needs_review: { title: "Nothing waiting for review", body: "Every submission has been picked up or decided. New submissions appear here as soon as they arrive." },
  waiting: { title: "Nothing is waiting on a submitter", body: "No submission currently has changes requested." },
  decided: { title: "No decided submissions yet", body: "Approved, rejected and withdrawn submissions will be listed here." },
  all: { title: "No submissions yet", body: "Submissions will appear here once marketers or partners send them in." },
};

export default async function QueuePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireRole("reviewer", "lead");
  const actor = await currentActor();
  const view = parseQueueView(await searchParams);
  const filters = toQueueFilters(view);
  const defaultView = view.status === "needs_review" && activeFilterCount(view) === 0;

  const now = new Date();
  const [rows, wholeQueue, partners] = await Promise.all([
    listPrioritizedQueue(actor, filters, view.sort, now),
    // The stat strip always describes the whole queue, whatever the filters below are doing.
    defaultView ? null : listQueue(actor),
    db.select({ id: tables.partners.id, name: tables.partners.name }).from(tables.partners).orderBy(asc(tables.partners.name)),
  ]);
  // When filters find nothing in this tab, say where matches do exist instead of leaving a dead end.
  const elsewhere =
    rows.length === 0 && activeFilterCount(view) > 0
      ? (
          await Promise.all(
            STATUS_VIEWS.filter((v) => v.key !== view.status && v.key !== "all").map(async (v) => ({
              key: v.key,
              label: v.label,
              count: (await listPrioritizedQueue(actor, toQueueFilters({ ...view, status: v.key }), view.sort, now)).length,
            })),
          )
        ).filter((v) => v.count > 0)
      : [];
  const stats = queueStats(wholeQueue ?? rows);
  const filtered = activeFilterCount(view);
  const empty = EMPTY[view.status];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-medium tracking-tight">Review queue</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Submissions that need a compliance decision, highest priority first. Open one to accept or dismiss its flagged findings.
        </p>
      </header>

      <section aria-label="Queue summary">
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Awaiting or in review" value={stats.open} hint="Compliance holds the clock" />
          <Stat label="Overdue" value={stats.overdue} tone="danger" hint="Past the SLA deadline" />
          <Stat label="Due in the next 12 hours" value={stats.dueSoon} tone="warning" hint="Not yet overdue" />
          <Stat label="Unassigned" value={stats.unassigned} hint="Nobody has claimed these" />
        </dl>
        <p className="mt-2 text-xs text-subtle">These four figures cover the whole review queue, regardless of the filters below.</p>
      </section>

      {/* Two rows of two on phones, so every view is visible without hidden horizontal scrolling. */}
      <nav aria-label="Queue view">
        <ul className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-surface-muted p-1 sm:inline-flex">
          {STATUS_VIEWS.map((s) => {
            const active = s.key === view.status;
            return (
              <li key={s.key}>
                <Link
                  href={queueHref({ ...view, status: s.key })}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 text-sm font-medium transition-colors",
                    active ? "bg-surface text-foreground shadow-card" : "text-muted hover:text-foreground",
                  )}
                >
                  {s.label}
                  <LinkPending />
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <FilterBar key={queueHref(view)} view={view} partners={partners} activeCount={filtered} />

      <section aria-labelledby="queue-list-heading" className="space-y-2">
        <h2 id="queue-list-heading" className="text-sm font-medium">
          {rows.length} {rows.length === 1 ? "submission" : "submissions"}
          {filtered > 0 ? " match the filters" : ""}
          <span className="font-normal text-subtle">
            {view.sort === "priority" ? ", highest priority first" : ", by SLA deadline, then risk"}
          </span>
        </h2>
        <PriorityExplainer view={view} />

        {rows.length === 0 ? (
          <Card>
            <CardBody className="flex flex-col items-center gap-2 py-12 text-center">
              {filtered > 0 ? <SearchX aria-hidden className="size-8 text-subtle" /> : <CheckCircle2 aria-hidden className="size-8 text-success" />}
              <p className="font-medium">{filtered > 0 ? "No submissions match these filters" : empty.title}</p>
              <p className="max-w-md text-sm text-muted">
                {filtered > 0
                  ? elsewhere.length > 0
                    ? `Nothing in ${STATUS_VIEWS.find((v) => v.key === view.status)!.label} matches, but other views do:`
                    : "Try removing a filter or searching for a different code or title."
                  : empty.body}
              </p>
              {elsewhere.length > 0 ? (
                <div className="mt-2 flex flex-wrap justify-center gap-2" role="status">
                  {elsewhere.map((v) => (
                    <Link key={v.key} href={queueHref({ ...view, status: v.key })} className={buttonVariants({ variant: "primary", size: "sm" })}>
                      {v.count} {v.count === 1 ? "match" : "matches"} in {v.label}
                    </Link>
                  ))}
                </div>
              ) : null}
              {filtered > 0 ? (
                <Link href={queueHref({ status: view.status, sort: view.sort })} className={buttonVariants({ variant: "secondary", size: "sm", className: "mt-2" })}>
                  Clear filters
                </Link>
              ) : null}
            </CardBody>
          </Card>
        ) : (
          <QueueTable rows={rows} now={now} sort={view.sort} />
        )}
      </section>
    </div>
  );
}
