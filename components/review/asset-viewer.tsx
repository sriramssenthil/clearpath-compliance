"use client";

import { ExternalLink, FileText } from "lucide-react";
import { useMemo } from "react";
import type { AssetInfo } from "@/lib/compliance/feature-types";
import { formatBytes, isPdf, spanInPart, splitCombinedContent } from "@/lib/workflow/assets";
import { cn } from "@/lib/utils";
import { HighlightedText, type HighlightMark, type TextSelection } from "./highlighted-text";

export const assetUrl = (id: number) => `/api/assets/${id}`;

/** The uploaded ad file: the image (click for full size) or an embedded PDF, with an open link. */
export function AssetViewer({ asset, className }: { asset: AssetInfo; className?: string }) {
  const url = assetUrl(asset.id);
  const pdf = isPdf(asset.mediaType);
  return (
    <figure className={cn("space-y-2", className)}>
      {pdf ? (
        <object data={url} type="application/pdf" aria-label={`PDF: ${asset.filename}`} className="h-[28rem] w-full rounded-sm border border-border bg-surface-muted">
          <p className="flex items-center gap-2 p-4 text-sm text-muted">
            <FileText aria-hidden className="size-4" />
            This browser cannot show the PDF inline. Use the link below to open it.
          </p>
        </object>
      ) : (
        <a href={url} target="_blank" rel="noreferrer" className="block rounded-sm border border-border bg-surface-muted" title="Open full size in a new tab">
          {/* eslint-disable-next-line @next/next/no-img-element -- private, permission-checked route; next/image would proxy and cache it */}
          <img src={url} alt={`Uploaded ad file: ${asset.filename}`} className="mx-auto max-h-[28rem] w-auto max-w-full object-contain" />
        </a>
      )}
      <figcaption className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span className="min-w-0 truncate" title={asset.filename}>
          {asset.filename} <span className="text-subtle">({pdf ? "PDF" : asset.mediaType.replace("image/", "").toUpperCase()}, {formatBytes(asset.sizeBytes)})</span>
        </span>
        <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
          {pdf ? "Open PDF in a new tab" : "Open full size"}
          <ExternalLink aria-hidden className="size-3.5" />
        </a>
      </figcaption>
    </figure>
  );
}

interface TextProps {
  content: string;
  hasFile: boolean;
  marks: HighlightMark[];
  selectedId: number | null;
  pulseKey?: number;
  onSelect?: (id: number) => void;
  onAddFinding?: (sel: TextSelection) => void;
  className?: string;
}

/**
 * A version's checked text. For a version with a file it is shown as two labelled parts, the
 * transcription and the typed copy, with finding offsets (and new selections) mapped to each part.
 */
export function AssetText({ content, hasFile, marks, selectedId, pulseKey, onSelect, onAddFinding, className }: TextProps) {
  const parts = useMemo(() => splitCombinedContent(content, hasFile), [content, hasFile]);
  const sections = useMemo(
    () =>
      [
        hasFile && parts.transcription ? { key: "file", label: "Text read from the file", part: parts.transcription } : null,
        parts.typed ? { key: "typed", label: hasFile ? "Accompanying copy" : null, part: parts.typed } : null,
      ].filter((s) => s !== null),
    [parts, hasFile],
  );

  if (!hasFile) {
    return <HighlightedText content={content} marks={marks} selectedId={selectedId} pulseKey={pulseKey} onSelect={onSelect} onAddFinding={onAddFinding} className={className} />;
  }
  return (
    <div className="space-y-6">
      {sections.map(({ key, label, part }) => {
        const local = marks.map((m) => ({ ...m, ...(spanInPart(m, part) ?? { start: null, end: null }) }));
        return (
          <section key={key} aria-label={label ?? undefined} className={className}>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-subtle">{label}</h3>
            {part.text.trim() ? (
              <HighlightedText
                content={part.text}
                marks={local}
                selectedId={selectedId}
                pulseKey={pulseKey}
                onSelect={onSelect}
                onAddFinding={onAddFinding ? (sel) => onAddFinding({ ...sel, start: sel.start + part.start, end: sel.end + part.start }) : undefined}
              />
            ) : (
              <p className="text-sm text-muted">{key === "file" ? "No text was read from the file." : "None."}</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
