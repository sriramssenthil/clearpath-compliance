"use client";

import Form from "next/form";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { Search } from "lucide-react";
import { PRODUCTS } from "@/lib/compliance/types";
import { Button } from "@/components/ui/button";
import { INPUT_CLASS } from "./field";
import { PRODUCT_LABEL } from "./options";

interface Props {
  q: string;
  product: string;
  status: string;
  filtered: boolean;
}

/** next/form: a GET form that navigates client-side (and still works without scripts). The select submits on change. */
export function ListFilters({ q, product, status, filtered }: Props) {
  return (
    <Form action="/submissions" role="search" aria-label="Filter submissions" className="flex flex-wrap items-end gap-3">
      {status ? <input type="hidden" name="status" value={status} /> : null}
      <div className="min-w-0 flex-1 basis-56">
        <label htmlFor="q" className="sr-only">
          Search by code or title
        </label>
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
          <input id="q" name="q" type="search" defaultValue={q} placeholder="Search by code or title" className={`${INPUT_CLASS} pl-9`} />
        </div>
      </div>
      <div>
        <label htmlFor="product-filter" className="sr-only">
          Product
        </label>
        <select
          id="product-filter"
          name="product"
          defaultValue={product}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className={INPUT_CLASS}
        >
          <option value="">All products</option>
          {PRODUCTS.map((p) => (
            <option key={p} value={p}>
              {PRODUCT_LABEL[p]}
            </option>
          ))}
        </select>
      </div>
      <SearchButton />
      {filtered ? (
        <Link href="/submissions" className="self-center text-sm font-medium text-muted underline-offset-2 hover:text-foreground hover:underline">
          Clear filters
        </Link>
      ) : null}
    </Form>
  );
}

function SearchButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending} aria-live="polite">
      {pending ? "Searching..." : "Search"}
    </Button>
  );
}
