/** Queue URL state: parsing searchParams into view state and service filters, and back into a query string. */
import { CHANNELS, PRODUCTS, type Channel, type Product } from "@/lib/compliance/types";
import type { Status } from "@/lib/workflow/flow";
import type { QueueFilters } from "@/lib/workflow/types";

export const STATUS_VIEWS = [
  { key: "needs_review", label: "Needs review", statuses: ["submitted", "in_review"] },
  { key: "waiting", label: "Waiting on submitter", statuses: ["changes_requested"] },
  { key: "decided", label: "Decided", statuses: ["approved", "rejected", "withdrawn"] },
  { key: "all", label: "All", statuses: ["submitted", "in_review", "changes_requested", "approved", "rejected", "withdrawn"] },
] as const satisfies readonly { key: string; label: string; statuses: readonly Status[] }[];

export type StatusViewKey = (typeof STATUS_VIEWS)[number]["key"];

export interface QueueView {
  status: StatusViewKey;
  assignee: "all" | "me" | "unassigned";
  risk: "" | "low" | "medium" | "high";
  product: "" | Product;
  channel: "" | Channel;
  partner: number | null;
  q: string;
  sort: "priority" | "deadline";
}

type Raw = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const oneOf = <T extends string>(v: string, allowed: readonly T[]): T | "" => ((allowed as readonly string[]).includes(v) ? (v as T) : "");

export function parseQueueView(raw: Raw): QueueView {
  const status = oneOf(first(raw.status), STATUS_VIEWS.map((s) => s.key)) || "needs_review";
  const partner = /^\d+$/.test(first(raw.partner)) ? Number(first(raw.partner)) : null;
  return {
    status,
    assignee: oneOf(first(raw.assignee), ["me", "unassigned"] as const) || "all",
    risk: oneOf(first(raw.risk), ["low", "medium", "high"] as const),
    product: oneOf(first(raw.product), PRODUCTS),
    channel: oneOf(first(raw.channel), CHANNELS),
    partner,
    q: first(raw.q).trim().slice(0, 80),
    sort: oneOf(first(raw.sort), ["deadline"] as const) || "priority",
  };
}

export function toQueueFilters(v: QueueView): QueueFilters {
  const statuses = STATUS_VIEWS.find((s) => s.key === v.status)!.statuses;
  return {
    status: [...statuses],
    assignee: v.assignee === "all" ? undefined : v.assignee,
    risk: v.risk || undefined,
    product: v.product || undefined,
    channel: v.channel || undefined,
    partnerId: v.partner ?? undefined,
    q: v.q || undefined,
  };
}

/** Number of filters narrowing the list (the status view and sort do not count). */
export function activeFilterCount(v: QueueView): number {
  return [v.assignee !== "all", v.risk, v.product, v.channel, v.partner !== null, v.q].filter(Boolean).length;
}

/** Query string for a view; defaults are omitted so shared URLs stay short. */
export function queueHref(v: Partial<QueueView>): string {
  const p = new URLSearchParams();
  if (v.status && v.status !== "needs_review") p.set("status", v.status);
  if (v.assignee && v.assignee !== "all") p.set("assignee", v.assignee);
  if (v.risk) p.set("risk", v.risk);
  if (v.product) p.set("product", v.product);
  if (v.channel) p.set("channel", v.channel);
  if (v.partner) p.set("partner", String(v.partner));
  if (v.q) p.set("q", v.q);
  if (v.sort === "deadline") p.set("sort", "deadline");
  const s = p.toString();
  return s ? `/queue?${s}` : "/queue";
}

export interface QueueStats {
  open: number;
  overdue: number;
  dueSoon: number;
  unassigned: number;
}

export function queueStats(list: { status: Status; sla: string; assigneeId: number | null }[]): QueueStats {
  const open = list.filter((s) => s.status === "submitted" || s.status === "in_review");
  return {
    open: open.length,
    overdue: open.filter((s) => s.sla === "overdue").length,
    dueSoon: open.filter((s) => s.sla === "due_soon").length,
    unassigned: open.filter((s) => s.assigneeId === null).length,
  };
}
