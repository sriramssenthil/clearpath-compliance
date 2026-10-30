"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, INPUT_CLASS } from "@/components/submit/field";
import { cn } from "@/lib/utils";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/password-rules";
import { signUpAction } from "../actions";
import { COMPANY_TYPES, EMPTY_FORM_STATE, NEW_PARTNER } from "../form-state";
import { FormMessage } from "../_components/auth-card";

const ACCOUNT_TYPES = [
  { value: "marketer", label: "ClearPath marketing team", hint: "In-house marketer. You see the assets you submit." },
  { value: "affiliate", label: "Affiliate partner", hint: "Outside partner. You see your company's submissions." },
] as const;

export function SignupForm({ partners }: { partners: { id: number; name: string }[] }) {
  const [state, action, pending] = useActionState(signUpAction, EMPTY_FORM_STATE);
  const fe = state.fieldErrors ?? {};
  const v = state.values ?? {};
  const [accountType, setAccountType] = useState(v.accountType ?? "");
  const [partnerId, setPartnerId] = useState(v.partnerId ?? "");

  return (
    <form action={action} noValidate className="space-y-5" aria-busy={pending}>
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}

      <Field label="Full name" htmlFor="name" error={fe.name}>
        <input id="name" name="name" autoComplete="name" required maxLength={100} defaultValue={v.name} aria-invalid={fe.name ? true : undefined} className={INPUT_CLASS} />
      </Field>
      <Field label="Work email" htmlFor="email" error={fe.email}>
        <input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          defaultValue={v.email}
          aria-invalid={fe.email ? true : undefined}
          className={INPUT_CLASS}
        />
      </Field>
      <Field label="Password" htmlFor="password" hint={`At least ${PASSWORD_MIN_LENGTH} characters. Avoid common passwords.`} error={fe.password}>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN_LENGTH}
          aria-invalid={fe.password ? true : undefined}
          className={INPUT_CLASS}
        />
      </Field>

      <fieldset className="space-y-2">
        <legend className="mb-1.5 block text-sm font-medium">I am on the</legend>
        {ACCOUNT_TYPES.map((t) => (
          <label
            key={t.value}
            className={cn(
              "flex cursor-pointer items-start gap-3 border px-3 py-2.5 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring",
              accountType === t.value ? "border-foreground bg-surface-muted" : "border-border-strong hover:border-foreground",
            )}
          >
            <input
              type="radio"
              name="accountType"
              value={t.value}
              checked={accountType === t.value}
              onChange={() => setAccountType(t.value)}
              className="mt-1 size-4 shrink-0 accent-[var(--accent)]"
            />
            <span>
              <span className="block text-sm font-medium text-foreground">{t.label}</span>
              <span className="block text-xs text-muted">{t.hint}</span>
            </span>
          </label>
        ))}
        {fe.accountType ? (
          <p role="alert" className="text-xs font-medium text-danger">
            {fe.accountType}
          </p>
        ) : null}
      </fieldset>

      {accountType === "affiliate" ? (
        <div className="space-y-5 border-l border-border-strong pl-4">
          <Field label="Company" htmlFor="partnerId" error={fe.partnerId}>
            <select
              id="partnerId"
              name="partnerId"
              value={partnerId}
              onChange={(e) => setPartnerId(e.target.value)}
              aria-invalid={fe.partnerId ? true : undefined}
              className={INPUT_CLASS}
            >
              <option value="">Choose your company</option>
              {partners.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.name}
                </option>
              ))}
              <option value={NEW_PARTNER}>My company is not listed</option>
            </select>
          </Field>
          {partnerId === NEW_PARTNER ? (
            <>
              <Field label="Company name" htmlFor="companyName" error={fe.companyName}>
                <input
                  id="companyName"
                  name="companyName"
                  autoComplete="organization"
                  maxLength={100}
                  defaultValue={v.companyName}
                  aria-invalid={fe.companyName ? true : undefined}
                  className={INPUT_CLASS}
                />
              </Field>
              <Field label="Partner type" htmlFor="companyType" error={fe.companyType}>
                <select id="companyType" name="companyType" defaultValue={v.companyType ?? ""} aria-invalid={fe.companyType ? true : undefined} className={INPUT_CLASS}>
                  <option value="">Choose a type</option>
                  {COMPANY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
            </>
          ) : null}
        </div>
      ) : null}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Creating account..." : "Create account"}
      </Button>
    </form>
  );
}
