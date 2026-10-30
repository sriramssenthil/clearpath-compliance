"use client";

import { useLinkStatus } from "next/link";

/**
 * Place inside a <Link>: shows a small spinner from the moment it is clicked until the new page renders,
 * so filter links never look unresponsive while a dynamic page loads.
 */
export function LinkPending() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={pending ? "inline-block size-3 animate-spin rounded-full border-2 border-current border-t-transparent" : "hidden"}
    />
  );
}
