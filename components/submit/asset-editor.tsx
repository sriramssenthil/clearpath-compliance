"use client";

import { forwardRef, type ReactNode } from "react";
import { ScanSearch } from "lucide-react";
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
  /** The file uploader, shown above the text box. */
  fileSlot?: ReactNode;
  /** A file is attached, so the text box becomes optional accompanying copy. */
  hasFile?: boolean;
  id?: string;
}

export const AssetEditor = forwardRef<HTMLTextAreaElement, Props>(function AssetEditor(
  { value, onChange, disabled, error, view, onViewChange, canHighlight, highlightHint, highlighted, running, hasResult, canRun, onRun, toolbar, fileSlot, hasFile = false, id = "asset-content" },
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
            <CardTitle>Asset</CardTitle>
            <CardDescription className="mt-1 max-w-prose">
              Upload the ad as an image or PDF, paste its text, or both (for example a banner and its caption). The check reads everything,
              including footnotes and fine print, and the text it reads from your file is shown with the results.
            </CardDescription>
          </div>
          {toolbar}
        </div>
      </CardHeader>
      <CardBody className="space-y-3">
        {fileSlot}
        <div className="flex flex-wrap items-end justify-between gap-2 pt-1">
          <label htmlFor={id} className="text-sm font-medium">
            {hasFile ? (
              <>
                Caption or accompanying copy <span className="font-normal text-subtle">(optional)</span>
              </>
            ) : (
              "Asset text"
            )}
          </label>
          {!hasFile ? <span className="text-xs text-muted">Required unless you attach a file</span> : null}
        </div>
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
            aria-required={!hasFile}
            placeholder={
              hasFile
                ? "Text that runs with the file, such as a social caption, email subject line or alt text. Leave empty if the file is the whole ad."
                : "Paste or type the ad copy, email body, landing page text, SMS or social post here."
            }
            className={cn(
              "block w-full resize-y rounded-md border bg-surface px-3 py-2.5 text-sm leading-7",
              hasFile ? "min-h-[10rem]" : "min-h-[24rem]",
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
          {/* First run only. Afterwards Re-run lives in the sticky submit bar (always visible) and the results
              panel; a copy here could slide under the sticky bar while scrolling. */}
          {!hasResult || running ? (
            <Button onClick={onRun} disabled={disabled || running || !canRun || over} variant="primary">
              <ScanSearch aria-hidden className="size-4" />
              {running ? "Checking..." : "Run pre-check"}
            </Button>
          ) : null}
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
