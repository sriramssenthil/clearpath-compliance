"use client";

import { useState } from "react";
import { Check, Copy, Crosshair } from "lucide-react";
import type { AnchoredFinding } from "@/lib/compliance/types";
import type { RuleInfo } from "@/lib/workflow/types";
import { Badge, SeverityBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  index: number;
  finding: AnchoredFinding;
  info?: RuleInfo;
  located: boolean;
  active: boolean;
  /** Outcome of the last apply action on this card. */
  note?: string | null;
  onReplace: () => void;
  onAppend: () => void;
  onShow: () => void;
}

export function FindingCard({ index, finding: f, info, located, active, note, onReplace, onAppend, onShow }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!f.suggestion) return;
    try {
      await navigator.clipboard.writeText(f.suggestion);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <li
      id={`finding-card-${index}`}
      className={cn(
        "scroll-mt-24 rounded-lg border border-border bg-surface p-4 transition-shadow",
        active && "ring-2 ring-ring",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <SeverityBadge severity={f.severity} />
        <h4 className="text-sm font-medium">{info?.title ?? f.ruleCode}</h4>
        <code className="rounded bg-surface-muted px-1.5 py-0.5 text-xs text-muted">{f.ruleCode}</code>
      </div>

      <blockquote className="mt-3 border-l-2 border-border-strong pl-3 text-sm italic text-foreground [overflow-wrap:anywhere]">
        {f.quote}
      </blockquote>

      <p className="mt-3 text-sm">
        <span className="font-medium">Why it matters. </span>
        <span className="text-muted">{f.issue}</span>
      </p>

      {info ? (
        <p className="mt-2 text-sm">
          <span className="font-medium">{info.citation}. </span>
          <span className="text-muted">{info.guidance}</span>
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
        <Badge variant="neutral">{f.source === "ai" ? "AI review" : "Rule check"}</Badge>
        {f.source === "ai" && f.confidence ? <span>{f.confidence} confidence</span> : null}
        {located ? (
          <button type="button" onClick={onShow} className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
            <Crosshair aria-hidden className="size-3.5" />
            Show in text
          </button>
        ) : null}
      </div>

      {f.suggestion ? (
        <div className="mt-3 rounded-md border border-success-line bg-success-soft p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-success">Suggested fix</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-foreground [overflow-wrap:anywhere]">{f.suggestion}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={onReplace} title="Swap the first occurrence of the quoted text for this suggestion">
              Replace quoted text
            </Button>
            <Button size="sm" variant="secondary" onClick={onAppend} title="Add the suggestion as a new paragraph at the end of the text, for missing disclosures">
              Append to end
            </Button>
            <Button size="sm" variant="ghost" onClick={copy}>
              {copied ? <Check aria-hidden className="size-3.5" /> : <Copy aria-hidden className="size-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <p role="status" className="mt-2 min-h-4 text-xs text-muted">
            {note ?? ""}
          </p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted">No automatic fix for this one. Use the guidance above to reword it.</p>
      )}
    </li>
  );
}
