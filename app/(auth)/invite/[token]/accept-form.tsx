"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, INPUT_CLASS } from "@/components/submit/field";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/password-rules";
import { acceptInviteAction } from "../../actions";
import { EMPTY_FORM_STATE } from "../../form-state";
import { FormMessage } from "../../_components/auth-card";

export function AcceptInviteForm({ token, email }: { token: string; email: string }) {
  const [state, action, pending] = useActionState(acceptInviteAction.bind(null, token), EMPTY_FORM_STATE);
  const fe = state.fieldErrors ?? {};

  return (
    <form action={action} noValidate className="space-y-5" aria-busy={pending}>
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      <Field label="Email" htmlFor="email" hint="Fixed to the address this invite was created for.">
        <input id="email" name="email" type="email" autoComplete="email" value={email} readOnly className={`${INPUT_CLASS} text-muted`} />
      </Field>
      <Field label="Full name" htmlFor="name" error={fe.name}>
        <input id="name" name="name" autoComplete="name" required maxLength={100} defaultValue={state.values?.name} aria-invalid={fe.name ? true : undefined} className={INPUT_CLASS} />
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
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Creating account..." : "Create account and sign in"}
      </Button>
    </form>
  );
}
