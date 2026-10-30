"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { withdrawAction } from "@/app/(app)/submissions/[id]/actions";

/** Withdraw with an inline confirmation step (no modal). */
export function WithdrawControl({ submissionId }: { submissionId: number }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!confirming) {
    return (
      <div className="flex flex-col items-start gap-1">
        <Button variant="secondary" size="sm" onClick={() => setConfirming(true)}>
          Withdraw submission
        </Button>
      </div>
    );
  }
  return (
    <div role="group" aria-label="Confirm withdrawal" className="max-w-sm rounded-md border border-danger-line bg-danger-soft p-3 text-sm">
      <p className="text-foreground">Withdraw this submission? It leaves the review queue and cannot be reopened; you would need to submit a new asset.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button
          variant="danger"
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const res = await withdrawAction(submissionId);
              if (!res.ok) setError(res.error);
              else setConfirming(false);
            })
          }
        >
          {pending ? "Withdrawing..." : "Yes, withdraw"}
        </Button>
        <Button variant="ghost" size="sm" disabled={pending} onClick={() => setConfirming(false)}>
          Keep it
        </Button>
      </div>
      {error ? <p role="alert" className="mt-2 text-xs text-danger">{error}</p> : null}
    </div>
  );
}
