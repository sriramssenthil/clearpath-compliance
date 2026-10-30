"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { PriorityBreakdown } from "@/lib/compliance/feature-types";
import { PRIORITY_BAR_MAX } from "@/lib/workflow/priority";
import { cn } from "@/lib/utils";

/** Bar tone only reinforces the number, which is always shown. */
const tone = (score: number) => (score >= 15 ? "bg-danger" : score >= 8 ? "bg-warning" : "bg-accent");

/**
 * Score, a compact bar and a disclosure button. Hover previews the breakdown; click or Enter pins it open, Escape
 * closes it. The panel floats so opening it does not shift the table.
 */
export function PriorityCell({ code, breakdown }: { code: string; breakdown: PriorityBreakdown }) {
  const id = useId();
  const [pinned, setPinned] = useState(false);
  const [hover, setHover] = useState(false);
  const open = pinned || hover;
  const pct = Math.min(100, Math.round((breakdown.score / PRIORITY_BAR_MAX) * 100));

  return (
    <div
      // Raised while open so the panel paints above the next row's (also raised) cells.
      className={cn("relative inline-block", open ? "z-40" : "z-10")}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          setPinned(false);
          setHover(false);
        }
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setPinned((p) => !p)}
        onBlur={() => setPinned(false)}
        className="group flex items-center gap-2 rounded-sm px-1 py-0.5 -mx-1 text-left hover:bg-surface-muted"
      >
        <span className="w-6 text-lg font-medium tabular-nums leading-none">{breakdown.score}</span>
        <span aria-hidden className="block h-1.5 w-12 bg-surface-muted ring-1 ring-border">
          <span className={cn("block h-full", tone(breakdown.score))} style={{ width: `${pct}%` }} />
        </span>
        <ChevronDown aria-hidden className={cn("size-3.5 text-subtle transition-transform", open && "rotate-180")} />
        <span className="sr-only">Priority {breakdown.score} for {code}: show how it was scored</span>
      </button>
      <div
        id={id}
        role="region"
        aria-label={`Priority breakdown for ${code}`}
        hidden={!open}
        className="absolute left-0 top-full z-30 mt-1 w-72 max-w-[calc(100vw-4rem)] border border-border-strong bg-surface p-3 text-xs"
      >
        {breakdown.factors.length === 0 ? (
          <p className="text-muted">No priority factors apply: nothing open, no deadline pressure.</p>
        ) : (
          <ul className="space-y-1">
            {breakdown.factors.map((f) => (
              <li key={f.label} className="flex justify-between gap-3">
                <span className="text-muted">{f.label}</span>
                <span className="font-medium tabular-nums">+{f.points}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 flex justify-between border-t border-border pt-2 font-medium">
          <span>Priority score</span>
          <span className="tabular-nums">{breakdown.score}</span>
        </p>
      </div>
    </div>
  );
}
