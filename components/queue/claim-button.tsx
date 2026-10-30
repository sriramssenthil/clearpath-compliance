"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { claimAction } from "@/app/(app)/queue/actions";

/** Claims an unassigned submission. Errors stay next to the button; the list refreshes through revalidation. */
export function ClaimButton({ submissionId, code }: { submissionId: number; code: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="relative z-10 flex flex-col items-start gap-1">
      <Button
        size="sm"
        variant="secondary"
        disabled={pending}
        aria-label={`Claim ${code}`}
        onClick={() => {
          setError(null);
          start(async () => {
            const res = await claimAction(submissionId);
            if (!res.ok) setError(res.error);
          });
        }}
      >
        {pending ? "Claiming..." : "Claim"}
      </Button>
      {error ? (
        <p role="alert" className="max-w-48 text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
