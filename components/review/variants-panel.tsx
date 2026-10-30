"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Badge, StatusBadge, type StatusVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ChangeScope } from "@/lib/compliance/feature-types";

export interface VariantRow {
  id: number;
  code: string;
  title: string;
  status: string;
  scope: ChangeScope | null;
  openHighFindings: number;
  eligible: boolean;
}

interface Props {
  variants: VariantRow[];
  canApprove: boolean;
  approveAction?: (ids: number[]) => Promise<{ ok: boolean; error?: string; approved?: number }>;
}

const STATUSES: StatusVariant[] = ["submitted", "in_review", "changes_requested", "approved", "rejected", "withdrawn"];
const isStatus = (s: string): s is StatusVariant => (STATUSES as string[]).includes(s);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const ELIGIBLE_LABEL = "Fast-track: only non-regulated text differs from the master";

/** Why a variant is not fast-track eligible, in the order a reviewer would care about. */
function ineligibleReason(v: VariantRow): string {
  if (v.status === "approved") return "Already approved";
  if (v.status === "rejected" || v.status === "withdrawn") return "Closed: no decision can be recorded";
  if (!v.scope) return "Not compared with the master yet: review in full";
  if (v.scope.regulatedCount > 0)
    return `Needs full review: ${plural(v.scope.regulatedCount, "change")} ${v.scope.regulatedCount === 1 ? "touches" : "touch"} claims or disclosures`;
  if (v.scope.hunks.length === 0) return "Identical to the master: review in full";
  if (v.openHighFindings > 0) return `Needs full review: ${plural(v.openHighFindings, "open high-severity finding")}`;
  return "Not eligible for fast-track: review in full";
}

/** Campaign variants of an approved master, with bulk approval of the ones whose differences are non-regulated. */
export function VariantsPanel({ variants, canApprove, approveAction }: Props) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const allRef = useRef<HTMLInputElement>(null);

  const selectable = canApprove && !!approveAction;
  const eligibleIds = useMemo(() => variants.filter((v) => v.eligible).map((v) => v.id), [variants]);
  // Drop selections that stopped being eligible after a refresh.
  const chosen = eligibleIds.filter((id) => selected.has(id));
  const n = chosen.length;
  const allChosen = eligibleIds.length > 0 && n === eligibleIds.length;

  useEffect(() => {
    if (allRef.current) allRef.current.indeterminate = n > 0 && !allChosen;
  }, [n, allChosen]);

  function toggle(id: number) {
    setDone(null);
    setConfirming(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setDone(null);
    setConfirming(false);
    setSelected(allChosen ? new Set() : new Set(eligibleIds));
  }

  function approve() {
    if (!approveAction || n === 0) return;
    setError(null);
    start(async () => {
      try {
        const res = await approveAction(chosen);
        if (res.ok) {
          setDone(res.approved ?? n);
          setSelected(new Set());
        } else {
          setError(res.error ?? "The variants could not be approved. Nothing was changed.");
        }
      } catch {
        setError("The request failed. Check your connection and try again.");
      }
      setConfirming(false);
    });
  }

  if (variants.length === 0) {
    return (
      <section aria-label="Campaign variants" className="space-y-1 text-sm">
        <h3 className="font-medium text-foreground">Campaign variants</h3>
        <p className="text-muted">No variants of this master have been submitted.</p>
      </section>
    );
  }

  return (
    <section aria-label="Campaign variants" className="space-y-3 text-sm">
      <div className="space-y-1">
        <h3 className="font-medium text-foreground">Campaign variants ({variants.length})</h3>
        <p className="text-muted">
          Each variant is compared with this approved master.{" "}
          {plural(eligibleIds.length, "variant")} {eligibleIds.length === 1 ? "differs" : "differ"} only in non-regulated text
          (greetings, names, button labels, formatting).
        </p>
      </div>

      {selectable && eligibleIds.length > 0 ? (
        <label className="inline-flex items-center gap-2 text-foreground">
          <input
            ref={allRef}
            type="checkbox"
            checked={allChosen}
            onChange={toggleAll}
            disabled={pending}
            className="size-4 accent-[var(--accent)]"
          />
          Select all eligible ({eligibleIds.length})
        </label>
      ) : null}

      <ul className="divide-y divide-border border-y border-border">
        {variants.map((v) => {
          const checkId = `variant-${v.id}`;
          const showBox = selectable && v.eligible;
          return (
            <li key={v.id} className="flex gap-3 py-3">
              {selectable ? (
                <div className="w-4 shrink-0 pt-0.5">
                  {showBox ? (
                    <input
                      id={checkId}
                      type="checkbox"
                      checked={selected.has(v.id)}
                      onChange={() => toggle(v.id)}
                      disabled={pending}
                      aria-describedby={`${checkId}-why`}
                      className="size-4 accent-[var(--accent)]"
                    />
                  ) : null}
                </div>
              ) : null}
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <label htmlFor={showBox ? checkId : undefined} className="min-w-0 break-words font-medium text-foreground">
                    <span className="font-mono text-xs text-subtle">{v.code}</span> {v.title}
                  </label>
                  {isStatus(v.status) ? <StatusBadge status={v.status} /> : <Badge>{v.status}</Badge>}
                  <Link href={`/submissions/${v.id}`} className="text-xs text-accent underline-offset-2 hover:underline">
                    Open<span className="sr-only"> {v.code}</span>
                  </Link>
                </div>
                {v.scope ? <p className="text-muted">{v.scope.summary.replace(/ Fast-track eligible\.$/u, "")}</p> : null}
                <p id={`${checkId}-why`} className={v.eligible ? "text-success" : "text-subtle"}>
                  {v.eligible ? ELIGIBLE_LABEL : ineligibleReason(v)}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      {selectable && eligibleIds.length > 0 ? (
        <div className="space-y-2">
          {confirming && n > 0 ? (
            <div role="group" aria-label="Confirm bulk approval" className="space-y-2 border border-accent-line bg-accent-soft p-3">
              <p className="text-foreground">
                You are approving {plural(n, "variant")} because their only differences from the approved master are non-regulated. This
                is recorded in each audit trail.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={approve} disabled={pending} aria-busy={pending}>
                  {pending ? "Approving..." : `Confirm: approve ${plural(n, "variant")}`}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              size="sm"
              onClick={() => {
                setError(null);
                setDone(null);
                setConfirming(true);
              }}
              disabled={n === 0 || pending}
              title={n === 0 ? "Select at least one eligible variant" : undefined}
            >
              Approve selected ({n})
            </Button>
          )}
          {error ? (
            <p role="alert" className="text-danger">
              {error}
            </p>
          ) : null}
          {done !== null ? (
            <p role="status" className="border border-success-line bg-success-soft px-2.5 py-1.5 text-success">
              Approved {plural(done, "variant")}. Each decision is recorded in that variant&apos;s audit trail.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
