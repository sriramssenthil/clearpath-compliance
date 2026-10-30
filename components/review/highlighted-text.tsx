"use client";

import { Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { buildSegments, selectionToRange } from "./segments";

export interface HighlightMark {
  id: number;
  start: number | null;
  end: number | null;
  severity: "high" | "medium" | "low";
  status: "open" | "accepted" | "dismissed" | "resolved";
  /** Tooltip, e.g. "High severity - UDAAP-GUARANTEE (open)". */
  label: string;
}

export interface TextSelection {
  text: string;
  start: number;
  end: number;
}

// Colour carries severity, line style carries it too (solid / dashed / dotted), so colour is never the only signal.
const SEVERITY: Record<HighlightMark["severity"], { open: string; accepted: string; line: string }> = {
  high: { open: "bg-sev-high-soft decoration-sev-high", accepted: "bg-sev-high-line ring-1 ring-sev-high", line: "decoration-solid" },
  medium: { open: "bg-sev-medium-soft decoration-sev-medium", accepted: "bg-sev-medium-line ring-1 ring-sev-medium", line: "decoration-dashed" },
  low: { open: "bg-sev-low-soft decoration-sev-low", accepted: "bg-sev-low-line ring-1 ring-sev-low", line: "decoration-dotted" },
};

export function markClass(m: Pick<HighlightMark, "severity" | "status">, selected: boolean, pulsing: boolean) {
  const sev = SEVERITY[m.severity];
  return cn(
    "scroll-mt-24 cursor-pointer rounded-[3px] px-0.5 text-foreground [box-decoration-break:clone] [-webkit-box-decoration-break:clone]",
    m.status === "dismissed"
      ? "bg-surface-muted opacity-55 hover:opacity-90"
      : m.status === "resolved"
        ? "bg-neutral-soft line-through decoration-1 decoration-subtle opacity-75"
        : cn("underline decoration-2 underline-offset-4", sev.line, m.status === "accepted" ? cn(sev.accepted, "font-medium") : sev.open),
    selected && "outline-2 outline-offset-1 outline-ring",
    pulsing && "animate-pulse",
  );
}

function offsetIn(root: HTMLElement, node: Node, off: number, contentLength: number): number | null {
  if (node.nodeType === Node.TEXT_NODE) {
    const el = node.parentElement?.closest<HTMLElement>("[data-start]");
    return el && root.contains(el) ? Number(el.dataset.start) + off : null;
  }
  const el = node as HTMLElement;
  if (el === root) {
    const child = root.children[off] as HTMLElement | undefined;
    return child ? Number(child.dataset.start) : contentLength;
  }
  const seg = el.closest<HTMLElement>("[data-start]");
  if (!seg || !root.contains(seg)) return null;
  return Number(seg.dataset.start) + (off > 0 ? (seg.textContent?.length ?? 0) : 0);
}

interface Props {
  content: string;
  marks: HighlightMark[];
  selectedId: number | null;
  /** Bumped by the parent whenever a selection should (re)scroll and pulse, even if the id is unchanged. */
  pulseKey?: number;
  onSelect?: (id: number) => void;
  /** Enables the floating "Add finding" button on text selection (reviewers only). */
  onAddFinding?: (sel: TextSelection) => void;
  className?: string;
}

export function HighlightedText({ content, marks, selectedId, pulseKey = 0, onSelect, onAddFinding, className }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const segments = useMemo(() => buildSegments(content, marks), [content, marks]);
  const byId = useMemo(() => new Map(marks.map((m) => [m.id, m])), [marks]);
  const [pulsing, setPulsing] = useState(false);
  const [pending, setPending] = useState<{ sel: TextSelection; x: number; y: number } | null>(null);

  useEffect(() => {
    if (selectedId === null) return;
    const root = rootRef.current;
    const el = root?.querySelector<HTMLElement>(`[data-finding~="${selectedId}"]`);
    if (!el) return;
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    setPulsing(true);
    const t = setTimeout(() => setPulsing(false), 1400);
    return () => clearTimeout(t);
  }, [selectedId, pulseKey]);

  useEffect(() => {
    if (!onAddFinding) return;
    let dragging = false;
    const compute = () => {
      const root = rootRef.current;
      const sel = document.getSelection();
      if (!root || !sel || sel.isCollapsed || sel.rangeCount === 0) return setPending(null);
      const r = sel.getRangeAt(0);
      if (!root.contains(r.startContainer) || !root.contains(r.endContainer)) return setPending(null);
      const a = offsetIn(root, r.startContainer, r.startOffset, content.length);
      const b = offsetIn(root, r.endContainer, r.endOffset, content.length);
      if (a === null || b === null) return setPending(null);
      const range = selectionToRange(content, a, b);
      if (!range) return setPending(null);
      const rect = r.getBoundingClientRect();
      setPending({ sel: range, x: Math.min(Math.max(rect.left + rect.width / 2, 70), window.innerWidth - 70), y: rect.bottom + 8 });
    };
    const down = (e: MouseEvent) => {
      if ((e.target as HTMLElement | null)?.closest("[data-add-finding]")) return;
      dragging = true;
      setPending(null);
    };
    const up = () => {
      dragging = false;
      setTimeout(compute, 0);
    };
    const change = () => {
      if (!dragging) compute();
    };
    document.addEventListener("mousedown", down);
    document.addEventListener("mouseup", up);
    document.addEventListener("selectionchange", change);
    window.addEventListener("scroll", change, true);
    window.addEventListener("resize", change);
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("mouseup", up);
      document.removeEventListener("selectionchange", change);
      window.removeEventListener("scroll", change, true);
      window.removeEventListener("resize", change);
    };
  }, [content, onAddFinding]);

  return (
    <>
      <div
        ref={rootRef}
        className={cn("whitespace-pre-wrap break-words text-[15px] leading-8 text-foreground", className)}
        data-reading
      >
        {segments.map((seg) => {
          if (seg.ids.length === 0) {
            return (
              <span key={seg.start} data-start={seg.start}>
                {seg.text}
              </span>
            );
          }
          const primaryId = selectedId !== null && seg.ids.includes(selectedId) ? selectedId : seg.ids[0];
          const m = byId.get(primaryId)!;
          const selected = selectedId !== null && seg.ids.includes(selectedId);
          const more = seg.ids.length > 1 ? ` (+${seg.ids.length - 1} overlapping)` : "";
          return (
            <mark
              key={seg.start}
              data-start={seg.start}
              data-finding={seg.ids.join(" ")}
              tabIndex={onSelect ? 0 : undefined}
              title={m.label + more}
              className={markClass(m, selected, selected && pulsing)}
              onClick={onSelect ? () => onSelect(primaryId) : undefined}
              onKeyDown={
                onSelect
                  ? (e) => {
                      if (e.key === "Enter") onSelect(primaryId);
                    }
                  : undefined
              }
            >
              {seg.text}
            </mark>
          );
        })}
      </div>
      {pending && onAddFinding ? (
        <button
          type="button"
          data-add-finding
          style={{ position: "fixed", left: pending.x, top: pending.y, transform: "translateX(-50%)" }}
          className="z-50 inline-flex h-8 items-center gap-1.5 rounded-md border border-transparent bg-accent px-3 text-[13px] font-medium text-accent-foreground shadow-lg hover:bg-accent-hover"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            onAddFinding(pending.sel);
            setPending(null);
            document.getSelection()?.removeAllRanges();
          }}
        >
          <Plus aria-hidden className="size-3.5" />
          Add finding
        </button>
      ) : null}
    </>
  );
}
