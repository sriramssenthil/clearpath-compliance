"use client";

import { useRouter } from "next/navigation";
import type { HTMLAttributes, MouseEvent } from "react";

/**
 * A table row that opens `href` when clicked anywhere outside its own links and controls.
 *
 * Rows used a "stretched link" (an absolutely positioned overlay) for this, but Safari does not make a
 * <tr> the containing block for absolute children, so the overlay escaped the row, covered the page and
 * swallowed clicks on unrelated controls. The title link inside the row stays the keyboard path.
 */
export function ClickableRow({ href, onClick, className, ...rest }: HTMLAttributes<HTMLTableRowElement> & { href: string }) {
  const router = useRouter();
  const handle = (e: MouseEvent<HTMLTableRowElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0) return;
    if ((e.target as HTMLElement).closest("a, button, input, select, textarea, label, summary, [role=button]")) return;
    if (window.getSelection()?.toString()) return; // the user was selecting text, not opening the row
    if (e.metaKey || e.ctrlKey) window.open(href, "_blank", "noopener");
    else router.push(href);
  };
  return <tr {...rest} onClick={handle} className={`cursor-pointer ${className ?? ""}`} />;
}
