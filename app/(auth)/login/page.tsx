import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, isDemoMode } from "@/lib/auth";
import { safeNextPath } from "@/lib/auth/session";
import { PERSONAS } from "@/lib/personas";
import { AuthCard, FormMessage } from "../_components/auth-card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * The form is part of the static shell (rendered as the Suspense fallback), so it paints immediately even
 * on a slow connection. The session-aware version (redirect when signed in, demo note, `next`) replaces it.
 */
export default function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<LoginCard next={null} demoUserName={null} />}>
      <LoginWithSession searchParams={searchParams} />
    </Suspense>
  );
}

async function LoginWithSession({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const next = safeNextPath(typeof sp.next === "string" ? sp.next : null);
  const user = await getCurrentUser();
  if (user && !user.isDemo) redirect(next ?? PERSONAS[user.role].defaultRoute);
  return <LoginCard next={next} demoUserName={user?.isDemo ? user.name : null} />;
}

function LoginCard({ next, demoUserName }: { next: string | null; demoUserName: string | null }) {
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
      {demoUserName ? (
        <FormMessage tone="info" className="mb-5">
          You are exploring as {demoUserName}, a demo persona. Signing in replaces that session.
        </FormMessage>
      ) : null}
      {next ? <p className="mb-5 text-sm text-muted">Sign in to continue where you left off.</p> : null}
      <LoginForm next={next} />
    </AuthCard>
  );
}
