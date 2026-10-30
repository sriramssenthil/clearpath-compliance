"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, INPUT_CLASS } from "@/components/submit/field";
import { signInAction } from "../actions";
import { EMPTY_FORM_STATE } from "../form-state";
import { FormMessage } from "../_components/auth-card";

export function LoginForm({ next }: { next: string | null }) {
  const [state, action, pending] = useActionState(signInAction, EMPTY_FORM_STATE);
  const fe = state.fieldErrors ?? {};

  return (
    <form action={action} noValidate className="space-y-5" aria-busy={pending}>
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Field label="Email" htmlFor="email" error={fe.email}>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          defaultValue={state.values?.email}
          aria-invalid={fe.email ? true : undefined}
          className={INPUT_CLASS}
        />
      </Field>
      <Field label="Password" htmlFor="password" error={fe.password}>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={fe.password ? true : undefined}
          className={INPUT_CLASS}
        />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}
