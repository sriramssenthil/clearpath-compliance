"use client";

import { useActionState, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, INPUT_CLASS } from "@/components/submit/field";
import { PERSONAS, type Role } from "@/lib/personas";
import { createInviteAction, type CreateInviteResult } from "./actions";

const ROLE_OPTIONS: Role[] = ["reviewer", "lead", "marketer", "affiliate"];

function InviteLink({ result }: { result: Extract<CreateInviteResult, { ok: true }> }) {
  const [copied, setCopied] = useState<"idle" | "copied" | "failed">("idle");
  const link = `${window.location.origin}/invite/${result.token}`;
  return (
    <div role="status" className="space-y-3 border border-success-line bg-success-soft px-4 py-4">
      <p className="text-sm text-success">
        Invite created for <span className="font-medium">{result.email}</span> as {PERSONAS[result.role].label}.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          readOnly
          value={link}
          aria-label="Invite link"
          onFocus={(e) => e.currentTarget.select()}
          className={`${INPUT_CLASS} min-w-0 flex-1 font-mono text-xs`}
        />
        <Button
          variant="secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
              setCopied("copied");
            } catch {
              setCopied("failed");
            }
          }}
        >
          {copied === "copied" ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
          {copied === "copied" ? "Copied" : "Copy link"}
        </Button>
      </div>
      {copied === "failed" ? <p className="text-xs text-warning">Could not copy automatically. Select the link and copy it.</p> : null}
      <p className="text-xs text-muted">
        This link is shown only once: copy it now and send it to them yourself. Email delivery is not wired up in this demo. It expires in 7 days.
      </p>
    </div>
  );
}

export function InviteForm({ partners }: { partners: { id: number; name: string }[] }) {
  const [state, action, pending] = useActionState(createInviteAction, null);
  const [role, setRole] = useState<Role>("reviewer");
  const fe = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  return (
    <div className="space-y-5">
      {state?.ok ? <InviteLink key={state.token} result={state} /> : null}
      <form action={action} noValidate className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.3fr)_auto] sm:items-start" aria-busy={pending}>
        <Field label="Email" htmlFor="invite-email" error={fe.email}>
          <input id="invite-email" name="email" type="email" autoComplete="off" required aria-invalid={fe.email ? true : undefined} className={INPUT_CLASS} />
        </Field>
        <Field label="Role" htmlFor="invite-role" error={fe.role}>
          <select id="invite-role" name="role" value={role} onChange={(e) => setRole(e.target.value as Role)} className={INPUT_CLASS}>
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {PERSONAS[r].label}
              </option>
            ))}
          </select>
        </Field>
        {role === "affiliate" ? (
          <Field label="Partner" htmlFor="invite-partner" error={fe.partnerId}>
            <select id="invite-partner" name="partnerId" defaultValue="" aria-invalid={fe.partnerId ? true : undefined} className={INPUT_CLASS}>
              <option value="">Choose a partner</option>
              {partners.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <div className="hidden sm:block" />
        )}
        <div className="sm:pt-[1.625rem]">
          <Button type="submit" disabled={pending} className="h-10 w-full sm:w-auto">
            {pending ? "Creating..." : "Create invite"}
          </Button>
        </div>
        {state && !state.ok && state.error ? (
          <p role="alert" className="text-sm text-danger sm:col-span-4">
            {state.error}
          </p>
        ) : null}
      </form>
    </div>
  );
}
