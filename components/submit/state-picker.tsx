"use client";

import { useId, useMemo, useRef, useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDismiss } from "./popover";
import { US_STATES, stateName } from "./us-states";

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}

/** Chips for the selected states (default nationwide) plus a searchable list of all 50 states and DC. */
export function StatePicker({ value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const listId = useId();
  useDismiss(open, () => setOpen(false), ref);

  const q = query.trim().toLowerCase();
  const options = useMemo(
    () => (q ? US_STATES.filter((s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase() === q) : US_STATES),
    [q],
  );
  const toggle = (code: string) =>
    onChange(value.includes(code) ? value.filter((c) => c !== code) : [...value, code].sort());

  return (
    <div ref={ref} className="relative">
      <div className="flex flex-wrap items-center gap-2">
        {value.length === 0 ? (
          <span className="inline-flex h-8 items-center rounded-full border border-accent-line bg-accent-soft px-3 text-[13px] font-medium text-accent">
            Nationwide / not state-specific
          </span>
        ) : (
          value.map((code) => (
            <span
              key={code}
              className="inline-flex h-8 items-center gap-1 rounded-full border border-border-strong bg-surface-muted pl-3 pr-1 text-[13px] font-medium"
            >
              <span title={stateName(code)}>{code}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => toggle(code)}
                aria-label={`Remove ${stateName(code)}`}
                className="grid size-6 place-items-center rounded-full text-muted hover:bg-border hover:text-foreground"
              >
                <X aria-hidden className="size-3.5" />
              </button>
            </span>
          ))
        )}
        <button
          type="button"
          disabled={disabled}
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((o) => !o)}
          className="inline-flex h-8 items-center gap-1 rounded-full border border-dashed border-border-strong px-3 text-[13px] font-medium text-muted hover:bg-surface-muted hover:text-foreground disabled:opacity-50"
        >
          <Plus aria-hidden className="size-3.5" />
          {value.length === 0 ? "Target specific states" : "Add states"}
        </button>
        {value.length > 0 ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange([])}
            className="text-[13px] font-medium text-muted underline-offset-2 hover:text-foreground hover:underline"
          >
            Reset to nationwide
          </button>
        ) : null}
      </div>

      {open ? (
        <div
          id={listId}
          className="absolute left-0 z-30 mt-2 w-full max-w-sm rounded-lg border border-border-strong bg-surface p-2 shadow-lg"
        >
          <input
            type="search"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search states"
            aria-label="Search states"
            className="mb-2 h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm"
          />
          <ul className="max-h-60 overflow-y-auto" role="listbox" aria-multiselectable aria-label="States">
            {options.length === 0 ? <li className="px-3 py-2 text-sm text-muted">No matching state.</li> : null}
            {options.map((s) => {
              const on = value.includes(s.code);
              return (
                <li key={s.code} role="option" aria-selected={on}>
                  <button
                    type="button"
                    onClick={() => toggle(s.code)}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-md px-3 py-1.5 text-left text-sm hover:bg-surface-muted",
                      on && "font-medium",
                    )}
                  >
                    <span>
                      {s.name} <span className="text-subtle">({s.code})</span>
                    </span>
                    {on ? <Check aria-hidden className="size-4 text-accent" /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-2 flex justify-end">
            <button type="button" onClick={() => setOpen(false)} className="rounded-md px-3 py-1 text-[13px] font-medium text-accent hover:bg-accent-soft">
              Done
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
