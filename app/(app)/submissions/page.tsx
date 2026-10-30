import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Plus, SearchX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { SubmissionsTable } from "@/components/submit/submissions-table";
import { ListFilters } from "@/components/submit/list-filters";
import { PRODUCT_LABEL } from "@/components/submit/options";
import { PRODUCTS, type Product } from "@/lib/compliance/types";
import { STATUS_LABEL, type Status } from "@/lib/workflow/flow";
import { requireUser } from "@/lib/auth";
import { currentActor } from "@/lib/workflow/action-helpers";
import { listSubmissions } from "@/lib/workflow/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Submissions" };

type Params = Record<string, string | string[] | undefined>;

const STATUSES = Object.keys(STATUS_LABEL) as Status[];
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

function href(p: { q?: string; product?: string; status?: string }) {
  const sp = new URLSearchParams();
  if (p.q) sp.set("q", p.q);
  if (p.product) sp.set("product", p.product);
  if (p.status) sp.set("status", p.status);
  const s = sp.toString();
  return s ? `/submissions?${s}` : "/submissions";
}

export default async function SubmissionsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const actor = await currentActor();
  const user = await requireUser();
  const all = await listSubmissions(actor);

  const q = first(sp.q).trim().slice(0, 100);
  const productRaw = first(sp.product);
  const product = (PRODUCTS as readonly string[]).includes(productRaw) ? (productRaw as Product) : "";
  const statusRaw = first(sp.status);
  const status = (STATUSES as string[]).includes(statusRaw) ? (statusRaw as Status) : "";

  const submitter = actor.role === "marketer" || actor.role === "affiliate";
  const heading = actor.role === "marketer" ? "My submissions" : actor.role === "affiliate" ? "Partner submissions" : "All submissions";
  const title = actor.role === "affiliate" ? `${user.partnerName ?? "Partner"} submissions` : heading;
  const blurb = submitter
    ? "Everything you have sent to compliance, with where it stands and what to do next."
    : "Every submission across marketing and partners, with status, risk and service-level state.";

  const needle = q.toLowerCase();
  const scoped = all.filter(
    (s) => (!product || s.product === product) && (!needle || s.code.toLowerCase().includes(needle) || s.title.toLowerCase().includes(needle)),
  );
  const rows = status ? scoped.filter((s) => s.status === status) : scoped;
  const counts = new Map<string, number>(STATUSES.map((st) => [st, scoped.filter((s) => s.status === st).length]));
  const filtered = Boolean(q || product || status);
  const now = new Date();

  const chips: { key: Status | ""; label: string; count: number }[] = [
    { key: "", label: "All", count: scoped.length },
    ...STATUSES.map((st) => ({ key: st, label: STATUS_LABEL[st], count: counts.get(st) ?? 0 })),
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">{title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">{blurb}</p>
        </div>
        {submitter ? (
          <Link href="/submissions/new" className={buttonVariants({ size: "lg" })}>
            <Plus aria-hidden className="size-4" />
            New submission
          </Link>
        ) : null}
      </header>

      {all.length > 0 ? (
        <div className="space-y-4">
          <ListFilters q={q} product={product} status={status} filtered={filtered} />
          <nav aria-label="Filter by status">
            <ul className="flex flex-wrap gap-2">
              {chips.map((c) => {
                const active = (status || "") === c.key;
                return (
                  <li key={c.label}>
                    <Link
                      href={href({ q, product, status: c.key })}
                      aria-current={active ? "true" : undefined}
                      className={cn(
                        "inline-flex h-8 items-center gap-2 rounded-full border px-3 text-[13px] font-medium transition-colors",
                        active ? "border-accent bg-accent-soft text-accent" : "border-border-strong bg-surface text-muted hover:bg-surface-muted hover:text-foreground",
                      )}
                    >
                      {c.label}
                      <span className={cn("rounded-full px-1.5 text-xs tabular-nums", active ? "bg-accent/10" : "bg-surface-muted")}>
                        <span className="sr-only">: </span>
                        {c.count}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <p className="text-xs text-muted" aria-live="polite">
            Showing {rows.length} of {all.length} {all.length === 1 ? "submission" : "submissions"}
            {product ? `, product: ${PRODUCT_LABEL[product]}` : ""}
            {q ? `, matching "${q}"` : ""}.
          </p>
        </div>
      ) : null}

      {all.length === 0 ? (
        <Card>
          <CardBody className="flex flex-col items-center gap-3 py-12 text-center">
            <FileText aria-hidden className="size-8 text-subtle" />
            <h2 className="text-base font-medium">No submissions yet</h2>
            <p className="max-w-md text-sm text-muted">
              {submitter
                ? "Send your first asset to compliance. You can load an example ad and run the automated pre-check to see how it works before you submit anything."
                : "Submissions from marketing and partners will appear here as soon as they are sent."}
            </p>
            {submitter ? (
              <Link href="/submissions/new" className={buttonVariants({ size: "lg" })}>
                <Plus aria-hidden className="size-4" />
                New submission
              </Link>
            ) : null}
          </CardBody>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <CardBody className="flex flex-col items-center gap-3 py-12 text-center">
            <SearchX aria-hidden className="size-8 text-subtle" />
            <h2 className="text-base font-medium">No submissions match these filters</h2>
            <p className="max-w-md text-sm text-muted">Try a different status, product or search term.</p>
            <Link href="/submissions" className={buttonVariants({ variant: "secondary" })}>
              Clear filters
            </Link>
          </CardBody>
        </Card>
      ) : (
        <SubmissionsTable rows={rows} staff={!submitter} submitterSide={submitter} now={now} />
      )}
    </div>
  );
}
