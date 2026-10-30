import type { Metadata } from "next";
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

export default async function SignupPage() {
  const user = await getCurrentUser();
  if (user && !user.isDemo) redirect(PERSONAS[user.role].defaultRoute);
  const partners = await loadPartners();

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
      {user?.isDemo ? (
        <FormMessage tone="info" className="mb-5">
          You are exploring as {user.name}, a demo persona. Creating an account replaces that session.
        </FormMessage>
      ) : null}
      <SignupForm partners={partners} />
    </AuthCard>
  );
}
