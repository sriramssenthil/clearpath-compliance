"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { resetDemoAction } from "@/app/(app)/dashboard/actions";

/** Destructive demo control: needs an explicit second step before anything is deleted. */
export function ResetDemo() {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    start(async () => {
      const res = await resetDemoAction();
      if (res.ok) {
        setMessage({ ok: true, text: `Demo data reset: ${res.data.submissions} submissions, ${res.data.findings} findings and ${res.data.auditEvents} audit events regenerated.` });
        setConfirming(false);
      } else {
        setMessage({ ok: false, text: res.error });
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      {confirming ? (
        <div role="group" aria-label="Confirm reset" className="space-y-2 rounded-md border border-danger-line bg-danger-soft p-3 text-sm">
          <p className="text-danger">
            This deletes every submission, finding, decision and audit event and regenerates the sample history. Rules and product facts are re-seeded from the repository. It cannot be undone.
          </p>
          <div className="flex gap-2">
            <Button type="submit" variant="danger" size="sm" disabled={pending}>
              {pending ? "Resetting..." : "Yes, reset demo data"}
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="secondary" onClick={() => { setMessage(null); setConfirming(true); }}>
          Reset demo data
        </Button>
      )}
      {message ? (
        <p role={message.ok ? "status" : "alert"} className={message.ok ? "text-sm text-success" : "text-sm text-danger"}>
          {message.text}
        </p>
      ) : null}
    </form>
  );
}
