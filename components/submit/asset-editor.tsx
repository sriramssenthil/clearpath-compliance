"use client";

import { forwardRef, type ReactNode } from "react";
import { RefreshCw, ScanSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { MAX_CONTENT } from "./options";
import { wordCount } from "./segments";

interface Props {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  error?: string | null;
  view: "edit" | "highlight";
  onViewChange: (v: "edit" | "highlight") => void;
  /** Highlight view is available once a current (not stale) result with located findings exists. */
  canHighlight: boolean;
  highlightHint: string;
  /** Rendered instead of the textarea in highlight view. */
  highlighted: ReactNode;
  running: boolean;
  hasResult: boolean;
  canRun: boolean;
  onRun: () => void;
  /** Optional slot above the editor, e.g. the "load an example" menu. */
  toolbar?: ReactNode;
  id?: string;
}

export const AssetEditor = forwardRef<HTMLTextAreaElement, Props>(function AssetEditor(
  { value, onChange, disabled, error, view, onViewChange, canHighlight, highlightHint, highlighted, running, hasResult, canRun, onRun, toolbar, id = "asset-content" },
  ref,
) {
  const over = value.length > MAX_CONTENT;
  const tab = (v: "edit" | "highlight", label: string, off?: boolean) => (
    <button
      type="button"
      role="tab"
      aria-selected={view === v}
      disabled={off}
      title={off ? highlightHint : undefined}
      onClick={() => onViewChange(v)}
      className={cn(
        "h-8 rounded-md px-3 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        view === v ? "bg-surface text-foreground shadow-card" : "text-muted hover:text-foreground",
      )}
    >
      {label}
    </button>
  );

  return (
    // Sticky on wide screens so the text stays in view while scrolling a long findings list.
    <Card className="lg:sticky lg:top-[4.5rem]">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>
              <label htmlFor={id}>Asset text</label>
            </CardTitle>
            <CardDescription className="mt-1 max-w-prose">
              Paste the full text of the asset. For images, paste the text version: that text is what gets checked. The check reads the whole
              text, including footnotes and fine print.
            </CardDescription>
          </div>
          {toolbar}
        </div>
      </CardHeader>
      <CardBody className="space-y-3">
        <div role="tablist" aria-label="Text view" className="inline-flex gap-1 rounded-lg bg-surface-muted p-1">
          {tab("edit", "Edit")}
          {tab("highlight", "Highlight findings", !canHighlight)}
        </div>

        {view === "edit" ? (
          <textarea
            id={id}
            ref={ref}
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            spellCheck
            aria-invalid={Boolean(error) || over}
            aria-describedby={`${id}-meta`}
            placeholder="Paste or type the ad copy, email body, landing page text, SMS or social post here."
            className={cn(
              "block min-h-[24rem] w-full resize-y rounded-md border bg-surface px-3 py-2.5 text-sm leading-7",
              error || over ? "border-danger" : "border-border-strong",
            )}
          />
        ) : (
          highlighted
        )}

        <div id={`${id}-meta`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className={cn("text-xs", over ? "font-medium text-danger" : "text-muted")}>
            {value.length.toLocaleString("en-US")} / {MAX_CONTENT.toLocaleString("en-US")} characters, {wordCount(value).toLocaleString("en-US")} words
          </p>
          <Button onClick={onRun} disabled={disabled || running || !canRun || over} variant={hasResult ? "secondary" : "primary"}>
            {hasResult ? <RefreshCw aria-hidden className="size-4" /> : <ScanSearch aria-hidden className="size-4" />}
            {running ? "Checking..." : hasResult ? "Re-run pre-check" : "Run pre-check"}
          </Button>
        </div>
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
      </CardBody>
    </Card>
  );
});
