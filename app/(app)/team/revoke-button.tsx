"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { revokeInviteAction } from "./actions";

export function RevokeButton({ inviteId, email }: { inviteId: number; email: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="inline-flex flex-col items-end gap-1">
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        aria-label={`Revoke invite for ${email}`}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await revokeInviteAction(inviteId);
            if (!res.ok) setError(res.error);
          })
        }
      >
        {pending ? "Revoking..." : "Revoke"}
      </Button>
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
