"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { buildSegments, type Locatable, type Sev } from "./segments";

// Border style as well as color, so severity is not conveyed by hue alone.
const MARK: Record<Sev, string> = {
  high: "bg-sev-high-soft border-sev-high border-b-2 border-solid",
  medium: "bg-sev-medium-soft border-sev-medium border-b-2 border-dashed",
  low: "bg-sev-low-soft border-sev-low border-b-2 border-dotted",
};
const SEV_WORD: Record<Sev, string> = { high: "High", medium: "Medium", low: "Low" };

interface Props {
  content: string;
  /** Sorted findings; a segment's ids index into this array. */
  findings: (Locatable & { label: string })[];
  activeKey: number | null;
  /** Called with the finding index to focus; repeated clicks on overlapping marks cycle through them. */
  onSelect: (index: number) => void;
}

/** Read-only rendering of the checked text with a mark around each located finding. */
export function HighlightedText({ content, findings, activeKey, onSelect }: Props) {
  const segments = useMemo(() => buildSegments(content, findings), [content, findings]);

  return (
    <div
      className="max-h-[32rem] min-h-[24rem] overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-border-strong bg-surface-muted px-3 py-2.5 text-sm leading-7"
      tabIndex={-1}
    >
      {segments.map((seg) => {
        if (seg.severity === null) return <span key={seg.start}>{seg.text}</span>;
        const labels = seg.ids.map((i) => `${SEV_WORD[findings[i].severity]}: ${findings[i].label}`).join("; ");
        const pick = () => {
          const at = activeKey === null ? -1 : seg.ids.indexOf(activeKey);
          onSelect(seg.ids[(at + 1) % seg.ids.length]);
        };
        const active = activeKey !== null && seg.ids.includes(activeKey);
        return (
          <mark
            key={seg.start}
            id={`finding-mark-${seg.ids[0]}`}
            role="button"
            tabIndex={0}
            title={`${labels} (select to see details)`}
            onClick={pick}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                pick();
              }
            }}
            className={cn(
              "cursor-pointer rounded-sm px-0.5 text-foreground transition-shadow",
              MARK[seg.severity],
              active && "ring-2 ring-ring",
            )}
          >
            {seg.text}
          </mark>
        );
      })}
    </div>
  );
}
