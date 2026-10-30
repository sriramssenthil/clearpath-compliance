"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FilePlus, FileText, LayoutDashboard, ListChecks, Scale, Users, type LucideIcon } from "lucide-react";
import type { NavItem, NavKey } from "@/lib/personas";
import { cn } from "@/lib/utils";

const ICONS: Record<NavKey, LucideIcon> = {
  submissions: FileText,
  new: FilePlus,
  queue: ListChecks,
  dashboard: LayoutDashboard,
  rules: Scale,
  team: Users,
};

/** Primary navigation. Highlights the most specific matching link (so /submissions/new does not also light up /submissions). */
export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const active = items
    .filter((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];

  return (
    <nav aria-label="Primary" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:overflow-visible sm:px-0">
      <ul className="flex items-center gap-1">
        {items.map((item) => {
          const Icon = ICONS[item.key];
          const isActive = active?.key === item.key;
          return (
            <li key={item.key} className="shrink-0">
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex h-9 items-center gap-2 border-b px-2.5 text-sm transition-colors",
                  isActive ? "border-foreground text-foreground" : "border-transparent text-muted hover:text-foreground",
                )}
              >
                <Icon aria-hidden className="size-4" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
