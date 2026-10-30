"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { claimAction } from "@/app/(app)/submissions/[id]/actions";

export function ClaimButton({ submissionId }: { submissionId: number }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        disabled={pending}
        title="Assigns this review to you. Accepting or dismissing any finding also claims it automatically."
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await claimAction(submissionId);
            if (!res.ok) setError(res.error);
          })
        }
      >
        {pending ? "Claiming..." : "Claim this review"}
      </Button>
      {error ? <p role="alert" className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
