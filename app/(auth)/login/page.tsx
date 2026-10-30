import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, isDemoMode } from "@/lib/auth";
import { safeNextPath } from "@/lib/auth/session";
import { PERSONAS } from "@/lib/personas";
import { AuthCard, FormMessage } from "../_components/auth-card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const next = safeNextPath(typeof sp.next === "string" ? sp.next : null);
  const user = await getCurrentUser();
  if (user && !user.isDemo) redirect(next ?? PERSONAS[user.role].defaultRoute);
  const demo = isDemoMode();

  return (
    <AuthCard
      title="Sign in"
      description="Use the email and password for your ClearPath Review account."
      footer={
        <p>
          New here?{" "}
          <Link href="/signup" className="text-foreground underline underline-offset-4 hover:text-accent">
            Create an account
          </Link>
          {demo ? (
            <>
              {" "}
              or{" "}
              <Link href="/#roles" className="text-foreground underline underline-offset-4 hover:text-accent">
                explore with a demo persona
              </Link>
            </>
          ) : null}
          .
        </p>
      }
    >
      {user?.isDemo ? (
        <FormMessage tone="info" className="mb-5">
          You are exploring as {user.name}, a demo persona. Signing in replaces that session.
        </FormMessage>
      ) : null}
      {next ? <p className="mb-5 text-sm text-muted">Sign in to continue where you left off.</p> : null}
      <LoginForm next={next} />
    </AuthCard>
  );
}
