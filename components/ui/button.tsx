import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-transparent text-foreground border-foreground hover:bg-foreground hover:text-background",
  secondary: "bg-surface text-foreground border-border-strong hover:border-foreground hover:bg-surface-muted",
  ghost: "bg-transparent text-muted border-transparent hover:bg-surface-muted hover:text-foreground",
  danger: "bg-danger-soft text-danger border-danger-line hover:bg-danger hover:text-background",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-9 px-4 text-sm",
  lg: "h-11 px-5 text-sm",
};

interface VariantOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}

/** Class string for the button look; use it on <Link> or <a> to get a link that looks like a button. */
export function buttonVariants({ variant = "primary", size = "md", className }: VariantOptions = {}) {
  return cn(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border font-medium transition-colors",
    "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantOptions {}

export function Button({ variant, size, className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonVariants({ variant, size, className })} {...props} />;
}
