import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/** Narrow bordered panel used by every sign-in, sign-up and invite screen. */
export function AuthCard({ title, description, children, footer }: { title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <section aria-labelledby="auth-title" className="border border-border bg-surface">
      <div className="px-6 pt-7 sm:px-8">
        <h1 id="auth-title" className="text-2xl tracking-[-0.03em]">
          {title}
        </h1>
        {description ? <div className="mt-2 text-sm leading-relaxed text-muted">{description}</div> : null}
      </div>
      <div className="px-6 pb-7 pt-6 sm:px-8">{children}</div>
      {footer ? <div className="border-t border-border px-6 py-4 text-sm text-muted sm:px-8">{footer}</div> : null}
    </section>
  );
}

/** Form-level message. Field-level errors sit under their inputs instead. */
export function FormMessage({ tone = "danger", children, className }: { tone?: "danger" | "info"; children: ReactNode; className?: string }) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 border px-3 py-2.5 text-sm",
        tone === "danger" ? "border-danger-line bg-danger-soft text-danger" : "border-info-line bg-info-soft text-info",
        className,
      )}
    >
      <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}
