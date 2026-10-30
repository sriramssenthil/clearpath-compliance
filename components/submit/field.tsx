import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const INPUT_CLASS =
  "h-10 w-full rounded-md border border-border-strong bg-surface px-3 text-sm placeholder:text-subtle disabled:opacity-60 aria-[invalid=true]:border-danger";

interface Props {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string | null;
  optional?: boolean;
  className?: string;
  children: ReactNode;
}

/** Label, control, hint and inline error in one consistent block. */
export function Field({ label, htmlFor, hint, error, optional, className, children }: Props) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium">
        {label}
        {optional ? <span className="ml-1 font-normal text-subtle">(optional)</span> : null}
      </label>
      {children}
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
      {error ? (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
