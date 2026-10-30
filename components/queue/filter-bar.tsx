"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { CHANNELS, PRODUCTS } from "@/lib/compliance/types";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CHANNEL_LABEL, PRODUCT_LABEL } from "./labels";
import { queueHref, type QueueView } from "./params";
import Link from "next/link";

const selectClass =
  "h-9 w-full rounded-md border border-border-strong bg-surface px-2.5 text-sm text-foreground shadow-card focus-visible:outline-2";

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-1 text-xs font-medium text-muted", className)}>
      {label}
      {children}
    </label>
  );
}

/** Filters live in the URL so a filtered queue can be shared. Selects apply immediately; the search box applies on Enter or Apply. */
export function FilterBar({ view, partners, activeCount }: { view: QueueView; partners: { id: number; name: string }[]; activeCount: number }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();

  function apply(form: HTMLFormElement) {
    const f = new FormData(form);
    const get = (k: string) => String(f.get(k) ?? "");
    const next: Partial<QueueView> = {
      status: view.status,
      assignee: (get("assignee") || "all") as QueueView["assignee"],
      risk: get("risk") as QueueView["risk"],
      product: get("product") as QueueView["product"],
      channel: get("channel") as QueueView["channel"],
      partner: get("partner") ? Number(get("partner")) : null,
      q: get("q").trim(),
    };
    start(() => router.push(queueHref(next)));
  }

  return (
    <form
      ref={formRef}
      role="search"
      aria-label="Filter the review queue"
      onSubmit={(e) => {
        e.preventDefault();
        apply(e.currentTarget);
      }}
      onChange={(e) => {
        if (e.target instanceof HTMLSelectElement) apply(e.currentTarget);
      }}
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-[repeat(5,minmax(0,1fr))_minmax(0,1.4fr)_auto] lg:items-end"
      aria-busy={pending}
    >
      <Field label="Assignee">
        <select name="assignee" defaultValue={view.assignee} className={selectClass}>
          <option value="all">All</option>
          <option value="me">Mine</option>
          <option value="unassigned">Unassigned</option>
        </select>
      </Field>
      <Field label="Risk">
        <select name="risk" defaultValue={view.risk} className={selectClass}>
          <option value="">Any risk</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </Field>
      <Field label="Product">
        <select name="product" defaultValue={view.product} className={selectClass}>
          <option value="">All products</option>
          {PRODUCTS.map((p) => (
            <option key={p} value={p}>
              {PRODUCT_LABEL[p]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Channel">
        <select name="channel" defaultValue={view.channel} className={selectClass}>
          <option value="">All channels</option>
          {CHANNELS.map((c) => (
            <option key={c} value={c}>
              {CHANNEL_LABEL[c]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Partner">
        <select name="partner" defaultValue={view.partner ?? ""} className={selectClass}>
          <option value="">All submitters</option>
          {partners.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Search by code or title" className="col-span-2 sm:col-span-2 lg:col-span-1">
        <span className="relative block">
          <Search aria-hidden className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-subtle" />
          <input
            type="search"
            name="q"
            defaultValue={view.q}
            placeholder="CP-1042 or title"
            maxLength={80}
            className={cn(selectClass, "pl-8")}
          />
        </span>
      </Field>
      <div className="col-span-2 flex items-center gap-2 sm:col-span-1">
        <Button type="submit" size="md" disabled={pending}>
          Apply
        </Button>
        {activeCount > 0 ? (
          <Link href={queueHref({ status: view.status })} className={buttonVariants({ variant: "ghost", size: "md" })}>
            Clear ({activeCount})
          </Link>
        ) : null}
      </div>
    </form>
  );
}
