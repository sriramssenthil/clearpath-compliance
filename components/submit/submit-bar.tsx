"use client";

import type { ReactNode } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  label: string;
  pendingLabel: string;
  submitting: boolean;
  disabled?: boolean;
  /** When set, the bar asks for one inline confirmation with this message before submitting. */
  confirmMessage: string | null;
  onSubmit: () => void;
  onConfirm: () => void;
  onCancelConfirm: () => void;
  error?: string | null;
  hint?: ReactNode;
  left?: ReactNode;
}

/** Sticky action bar with a single inline confirmation step (no modal). */
export function SubmitBar({ label, pendingLabel, submitting, disabled, confirmMessage, onSubmit, onConfirm, onCancelConfirm, error, hint, left }: Props) {
  return (
    <div className="sticky bottom-0 z-20 -mx-4 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 text-xs text-muted">{left}</div>
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-x-4 gap-y-2">
          {error ? (
            <p role="alert" className="min-w-0 flex-1 basis-60 text-right text-sm font-medium text-danger max-sm:text-left">
              {error}
            </p>
          ) : confirmMessage ? (
            <p role="status" className="min-w-0 flex-1 basis-60 text-right text-sm max-sm:text-left">
              {confirmMessage}
            </p>
          ) : hint ? (
            <p className="min-w-0 flex-1 basis-60 text-right text-xs text-muted max-sm:text-left">{hint}</p>
          ) : null}
          {confirmMessage && !error ? (
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onCancelConfirm} disabled={submitting}>
                Keep editing
              </Button>
              <Button onClick={onConfirm} disabled={submitting}>
                <Send aria-hidden className="size-4" />
                {submitting ? pendingLabel : "Confirm and submit"}
              </Button>
            </div>
          ) : (
            <Button onClick={onSubmit} disabled={disabled || submitting}>
              <Send aria-hidden className="size-4" />
              {submitting ? pendingLabel : label}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
