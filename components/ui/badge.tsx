import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type SeverityVariant = "high" | "medium" | "low";
export type StatusVariant = "submitted" | "in_review" | "changes_requested" | "approved" | "rejected" | "withdrawn";
export type BadgeVariant = "neutral" | "accent" | "info" | "success" | "warning" | "danger" | `severity-${SeverityVariant}` | `status-${StatusVariant}`;

const TONE = {
  neutral: "bg-neutral-soft text-neutral border-neutral-line",
  accent: "bg-accent-soft text-accent border-accent-line",
  info: "bg-info-soft text-info border-info-line",
  success: "bg-success-soft text-success border-success-line",
  warning: "bg-warning-soft text-warning border-warning-line",
  danger: "bg-danger-soft text-danger border-danger-line",
} as const;

const VARIANT_CLASS: Record<BadgeVariant, string> = {
  neutral: TONE.neutral,
  accent: TONE.accent,
  info: TONE.info,
  success: TONE.success,
  warning: TONE.warning,
  danger: TONE.danger,
  "severity-high": TONE.danger,
  "severity-medium": TONE.warning,
  "severity-low": TONE.info,
  "status-submitted": TONE.neutral,
  "status-in_review": TONE.accent,
  "status-changes_requested": TONE.warning,
  "status-approved": TONE.success,
  "status-rejected": TONE.danger,
  "status-withdrawn": TONE.neutral,
};

export const STATUS_LABELS: Record<StatusVariant, string> = {
  submitted: "Submitted",
  in_review: "In review",
  changes_requested: "Changes requested",
  approved: "Approved",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

export const SEVERITY_LABELS: Record<SeverityVariant, string> = { high: "High", medium: "Medium", low: "Low" };

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  /** Show a small colored dot before the label. */
  dot?: boolean;
}

/** Small pill. Prefer SeverityBadge / StatusBadge when the value comes from the database. */
export function Badge({ variant = "neutral", dot, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm border px-2 py-0.5 text-xs font-medium leading-5",
        VARIANT_CLASS[variant],
        className,
      )}
      {...props}
    >
      {dot ? <span aria-hidden className="size-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

export function SeverityBadge({ severity, className }: { severity: SeverityVariant; className?: string }) {
  return (
    <Badge variant={`severity-${severity}`} dot className={className}>
      {SEVERITY_LABELS[severity]}
    </Badge>
  );
}

export function StatusBadge({ status, className }: { status: StatusVariant; className?: string }) {
  return (
    <Badge variant={`status-${status}`} dot className={className}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}
