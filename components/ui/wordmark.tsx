import Link from "next/link";
import { ShieldCheck } from "lucide-react";

/** Serif small-caps wordmark with a mark: the product's identity in the header of every page. */
export function Wordmark({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex shrink-0 items-center gap-2.5 text-foreground" aria-label="ClearPath Review home">
      <ShieldCheck aria-hidden className="size-5" strokeWidth={2} />
      <span className="font-display text-[15px] uppercase tracking-[0.16em]">ClearPath</span>
      <span className="hidden border-l border-border-strong pl-2.5 text-[13px] text-muted sm:inline">Review</span>
    </Link>
  );
}
