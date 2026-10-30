"use client";

import { useEffect, useId, useRef, useState } from "react";
import { FileText, ImageUp, RefreshCw, X } from "lucide-react";
import type { AssetInfo } from "@/lib/compliance/feature-types";
import { ACCEPT_ATTR, formatBytes, isPdf, MAX_FILE_BYTES } from "@/lib/workflow/assets";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { prepareFile, type PreparedFile } from "./prepare-file";

interface Props {
  value: PreparedFile | null;
  onChange: (f: PreparedFile | null) => void;
  disabled?: boolean;
  /** Resubmission: the previous version's stored file, shown while it is being kept. */
  kept?: { info: AssetInfo; url: string } | null;
  onRemoveKept?: () => void;
  /** Listen for pasted images anywhere on the page (one uploader per page). */
  capturePaste?: boolean;
}

function Thumb({ url, mediaType, name }: { url: string; mediaType: string; name: string }) {
  if (isPdf(mediaType)) {
    return (
      <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-sm border border-border bg-surface-muted">
        <object data={`${url}#page=1&toolbar=0&navpanes=0&view=FitH`} type="application/pdf" aria-label={`First page of ${name}`} className="pointer-events-none h-full w-full">
          <span className="flex h-full items-center justify-center">
            <FileText aria-hidden className="size-6 text-muted" />
          </span>
        </object>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- object URL / private asset route; next/image cannot optimise either
    <img src={url} alt={`Preview of ${name}`} className="h-24 w-24 shrink-0 rounded-sm border border-border bg-surface-muted object-contain" />
  );
}

/** Drop zone, file button and clipboard paste for one ad file (image or PDF), with preview and remove/replace. */
export function FileDrop({ value, onChange, disabled, kept, onRemoveKept, capturePaste = true }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hintId = useId();
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const accept = async (file: File | null | undefined) => {
    if (!file || disabled) return;
    setBusy(true);
    setError(null);
    const res = await prepareFile(file);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    if (valueRef.current) URL.revokeObjectURL(valueRef.current.previewUrl);
    onChange(res.file);
  };
  const acceptRef = useRef(accept);
  useEffect(() => {
    acceptRef.current = accept;
  });

  const remove = () => {
    if (value) URL.revokeObjectURL(value.previewUrl);
    setError(null);
    onChange(null);
  };

  // Pasting a screenshot anywhere on the page attaches it; pasting text is left alone.
  useEffect(() => {
    if (!capturePaste || disabled) return;
    const onPaste = (e: ClipboardEvent) => {
      const file = [...(e.clipboardData?.files ?? [])][0];
      if (!file) return;
      e.preventDefault();
      void acceptRef.current(file);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [capturePaste, disabled]);

  const picker = (
    <input
      ref={inputRef}
      type="file"
      accept={ACCEPT_ATTR}
      className="sr-only"
      tabIndex={-1}
      aria-hidden
      onChange={(e) => {
        void accept(e.target.files?.[0]);
        e.target.value = "";
      }}
    />
  );
  const choose = () => inputRef.current?.click();

  const shown = value
    ? { url: value.previewUrl, mediaType: value.mediaType, name: value.file.name, size: value.file.size, note: value.note, stored: false }
    : kept
      ? { url: kept.url, mediaType: kept.info.mediaType, name: kept.info.filename, size: kept.info.sizeBytes, note: "Kept from the previous version.", stored: true }
      : null;

  return (
    <div className="space-y-2">
      {picker}
      {shown ? (
        <div className="flex gap-4 rounded-md border border-border-strong bg-surface p-3">
          <Thumb url={shown.url} mediaType={shown.mediaType} name={shown.name} />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="truncate text-sm font-medium" title={shown.name}>
              {shown.name}
            </p>
            <p className="text-xs text-muted">
              {isPdf(shown.mediaType) ? "PDF document" : `${shown.mediaType.replace("image/", "").toUpperCase()} image`}, {formatBytes(shown.size)}
              {value?.originalBytes ? ` (was ${formatBytes(value.originalBytes)})` : ""}
            </p>
            {isPdf(shown.mediaType) ? <p className="text-xs text-muted">The preview shows the first page. The check reads every page.</p> : null}
            {shown.note ? <p className="text-xs text-muted">{shown.note}</p> : null}
            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="sm" variant="secondary" onClick={choose} disabled={disabled || busy}>
                <RefreshCw aria-hidden className="size-3.5" />
                {busy ? "Preparing..." : "Replace file"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={shown.stored ? onRemoveKept : remove}
                disabled={disabled || busy}
                aria-label={`Remove ${shown.name}`}
              >
                <X aria-hidden className="size-3.5" />
                Remove
              </Button>
              {shown.stored ? (
                <a href={shown.url} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center px-2 text-[13px] font-medium text-accent hover:underline">
                  Open file
                </a>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            if (disabled) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void accept(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            "flex flex-col items-center gap-2 rounded-md border border-dashed px-4 py-6 text-center transition-colors",
            dragging ? "border-accent bg-accent-soft" : "border-border-strong bg-surface-muted/40",
            disabled && "opacity-60",
          )}
        >
          <ImageUp aria-hidden className="size-6 text-muted" />
          <p className="text-sm">
            <span className="font-medium">Drop the ad file here</span>
            <span className="text-muted">, paste a screenshot, or</span>
          </p>
          <Button size="sm" variant="secondary" onClick={choose} disabled={disabled || busy} aria-describedby={hintId}>
            {busy ? "Preparing..." : "Choose a file"}
          </Button>
          <p id={hintId} className="text-xs text-muted">
            PNG, JPEG, WebP, GIF, HEIC or PDF, up to {formatBytes(MAX_FILE_BYTES)}. Large images are resized (and HEIC photos converted) in your browser before upload.
          </p>
        </div>
      )}
      {error ? (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : (
        <p className="sr-only" aria-live="polite">
          {busy ? "Preparing file" : value ? `${value.file.name} attached` : ""}
        </p>
      )}
    </div>
  );
}
