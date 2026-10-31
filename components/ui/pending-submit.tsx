"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "./button";

/** Submit button for server-action forms: disables and shows `pendingLabel` while the action runs. */
export function PendingSubmit({ children, pendingLabel, ...props }: ButtonProps & { pendingLabel: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} aria-busy={pending} {...props}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
