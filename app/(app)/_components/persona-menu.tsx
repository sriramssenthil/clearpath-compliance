"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Check, ChevronDown, LogOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ROLES, PERSONAS, type Role } from "@/lib/personas";
import { cn } from "@/lib/utils";

export interface MenuUser {
  id: number;
  name: string;
  role: Role;
  partnerName: string | null;
}

interface Props {
  users: MenuUser[];
  current: MenuUser;
  switchAction: (userId: number) => Promise<void>;
  signOutAction: () => Promise<void>;
}

/** Demo persona switcher: every seeded user, grouped by role. Each row is a form posting to the switchPersona server action. */
export function PersonaMenu({ users, current, switchAction, signOutAction }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Close on navigation (adjusting state during render, per React docs, instead of in an effect).
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls="persona-menu"
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 items-center gap-2 rounded-md border border-border-strong bg-surface px-2.5 text-sm shadow-card transition-colors hover:bg-surface-muted"
      >
        <span className="flex min-w-0 flex-col items-start leading-tight sm:flex-row sm:items-center sm:gap-2">
          <span className="max-w-[9rem] truncate font-medium text-foreground">{current.name}</span>
          <span className="text-[11px] text-subtle sm:hidden">{PERSONAS[current.role].label}</span>
          <Badge variant="accent" className="hidden sm:inline-flex">
            {PERSONAS[current.role].label}
          </Badge>
        </span>
        <ChevronDown aria-hidden className={cn("size-4 shrink-0 text-subtle transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <div
          id="persona-menu"
          className="absolute right-0 z-50 mt-2 max-h-[min(32rem,75vh)] w-[min(21rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-border bg-surface p-1.5 shadow-lg"
        >
          <p className="px-2.5 pb-1 pt-2 text-xs text-subtle">Demo personas. No passwords: pick anyone to see their view.</p>
          {ROLES.map((role) => {
            const group = users.filter((u) => u.role === role);
            if (group.length === 0) return null;
            return (
              <section key={role} aria-label={PERSONAS[role].label} className="pt-1">
                <h2 className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-subtle">{PERSONAS[role].label}</h2>
                <ul>
                  {group.map((u) => {
                    const isCurrent = u.id === current.id;
                    return (
                      <li key={u.id}>
                        <form action={switchAction.bind(null, u.id)}>
                          <button
                            type="submit"
                            aria-current={isCurrent ? "true" : undefined}
                            className={cn(
                              "flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-surface-muted",
                              isCurrent && "bg-accent-soft",
                            )}
                          >
                            <span className="min-w-0">
                              <span className="block truncate font-medium text-foreground">{u.name}</span>
                              {u.partnerName ? <span className="block truncate text-xs text-subtle">{u.partnerName}</span> : null}
                            </span>
                            {isCurrent ? <Check aria-label="Current user" className="size-4 shrink-0 text-accent" /> : null}
                          </button>
                        </form>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
          <div className="mt-1.5 border-t border-border pt-1.5">
            <form action={signOutAction}>
              <button
                type="submit"
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
              >
                <LogOut aria-hidden className="size-4" />
                Back to start
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
