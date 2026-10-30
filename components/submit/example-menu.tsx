"use client";

import { useId, useRef, useState } from "react";
import { ChevronDown, FileText, ImageIcon } from "lucide-react";
import { EXAMPLE_ASSETS, type ExampleAsset } from "@/lib/seed/examples";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDismiss } from "./popover";

interface Props {
  onPick: (example: ExampleAsset) => void;
  disabled?: boolean;
  variant?: "primary" | "secondary";
}

/** Menu of canned ads. Choosing one fills title, product, channel, states, text and (for image examples) the file. */
export function ExampleMenu({ onPick, disabled, variant = "secondary" }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useDismiss(open, () => setOpen(false), ref);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className={buttonVariants({ variant })}
      >
        <FileText aria-hidden className="size-4" />
        Load an example
        <ChevronDown aria-hidden className={cn("size-4 transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div id={id} className="absolute left-0 z-30 mt-2 w-[min(26rem,calc(100vw-2rem))] rounded-lg border border-border-strong bg-surface p-1 shadow-lg">
          <p className="px-3 py-2 text-xs text-muted">Replaces the title, product, channel, states, text and file in the form.</p>
          <ul className="max-h-[22rem] overflow-y-auto">
            {EXAMPLE_ASSETS.map((ex) => (
              <li key={ex.id}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(ex);
                    setOpen(false);
                  }}
                  className="block w-full rounded-md px-3 py-2 text-left hover:bg-surface-muted"
                >
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    {ex.image ? <ImageIcon aria-label="Image file" className="size-3.5 shrink-0 text-muted" /> : null}
                    {ex.label}
                  </span>
                  <span className="mt-0.5 block text-xs leading-5 text-muted">{ex.description}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
