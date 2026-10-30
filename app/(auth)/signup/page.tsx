import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { PERSONAS } from "@/lib/personas";
import { AuthCard, FormMessage } from "../_components/auth-card";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Create an account" };

async function loadPartners() {
  const { db, tables } = await import("@/lib/db");
  return db.select({ id: tables.partners.id, name: tables.partners.name }).from(tables.partners).orderBy(asc(tables.partners.name));
}

/** Same pattern as the login page: the form paints from the static shell; the session-aware version replaces it. */
export default function SignupPage() {
  return (
    <Suspense fallback={<SignupCard partners={[]} demoUserName={null} />}>
      <SignupWithSession />
    </Suspense>
  );
}

async function SignupWithSession() {
  const user = await getCurrentUser();
  if (user && !user.isDemo) redirect(PERSONAS[user.role].defaultRoute);
  const partners = await loadPartners();
  return <SignupCard partners={partners} demoUserName={user?.isDemo ? user.name : null} />;
}

function SignupCard({ partners, demoUserName }: { partners: { id: number; name: string }[]; demoUserName: string | null }) {
  return (
    <AuthCard
      title="Create an account"
      description="Submit your own marketing assets for compliance review. Reviewer and lead accounts are by invitation from a compliance lead."
      footer={
        <p>
          Already have an account?{" "}
          <Link href="/login" className="text-foreground underline underline-offset-4 hover:text-accent">
            Sign in
          </Link>
          .
        </p>
      }
    >
      {demoUserName ? (
        <FormMessage tone="info" className="mb-5">
          You are exploring as {demoUserName}, a demo persona. Creating an account replaces that session.
        </FormMessage>
      ) : null}
      <SignupForm partners={partners} />
    </AuthCard>
  );
}
