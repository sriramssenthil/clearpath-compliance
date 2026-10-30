import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";
import { findInviteByToken, inviteState } from "@/lib/auth/invites";
import { getCurrentUser } from "@/lib/auth";
import { roleLabel } from "@/lib/personas";
import { buttonVariants } from "@/components/ui/button";
import { AuthCard, FormMessage } from "../../_components/auth-card";
import { AcceptInviteForm } from "./accept-form";

export const metadata: Metadata = { title: "Accept invite", robots: { index: false } };

const INVALID_COPY = {
  missing: { title: "This invite link is not valid", body: "Check that you copied the whole link, or ask the person who invited you for a new one." },
  expired: { title: "This invite has expired", body: "Invite links work for 7 days. Ask the person who invited you to send a new one." },
  used: { title: "This invite has already been used", body: "Each invite link creates one account. If it was yours, sign in with the email it was sent to." },
} as const;

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  await connection();
  const invite = await findInviteByToken(token);
  const state = invite ? inviteState(invite) : "missing";

  if (!invite || state !== "valid") {
    const copy = INVALID_COPY[state === "valid" ? "missing" : state];
    return (
      <AuthCard title={copy.title} description={copy.body}>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/login" className={buttonVariants({ variant: "primary", className: "flex-1" })}>
            Sign in
          </Link>
          <Link href="/" className={buttonVariants({ variant: "secondary", className: "flex-1" })}>
            Go to the home page
          </Link>
        </div>
      </AuthCard>
    );
  }

  const user = await getCurrentUser();
  const role = roleLabel(invite.role);
  return (
    <AuthCard
      title="Join ClearPath Review"
      description={
        <p>
          <span className="text-foreground">{invite.inviterName ?? "A compliance lead"}</span> invited you as{" "}
          <span className="text-foreground">{role}</span>
          {invite.partnerName ? (
            <>
              {" "}
              for <span className="text-foreground">{invite.partnerName}</span>
            </>
          ) : null}
          . Choose your name and a password to finish setting up the account.
        </p>
      }
      footer={<p>This link works once and expires on {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(invite.expiresAt)}.</p>}
    >
      {user ? (
        <FormMessage tone="info" className="mb-5">
          You are signed in as {user.name}. Accepting this invite signs you in to the new account instead.
        </FormMessage>
      ) : null}
      <AcceptInviteForm token={token} email={invite.email} />
    </AuthCard>
  );
}
