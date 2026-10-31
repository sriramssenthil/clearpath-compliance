import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import {
  ArrowRight,
  ClipboardCheck,
  FileSearch,
  Handshake,
  Landmark,
  Megaphone,
  ScrollText,
  Send,
  ShieldCheck,
  UserRoundCheck,
  type LucideIcon,
} from "lucide-react";
import { findUserByEmail, isDemoMode, switchPersona } from "@/lib/auth";
import { PERSONAS, ROLES, type Role } from "@/lib/personas";
import { Button, buttonVariants } from "@/components/ui/button";
import { Wordmark } from "@/components/ui/wordmark";
import { PendingSubmit } from "@/components/ui/pending-submit";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const REPO_URL = "https://github.com/sriramssenthil/clearpath-compliance";

const ROLE_ICONS: Record<Role, LucideIcon> = {
  marketer: Megaphone,
  affiliate: Handshake,
  reviewer: ClipboardCheck,
  lead: Landmark,
};

const STEPS: { title: string; body: string; icon: LucideIcon }[] = [
  { title: "Submit", body: "Paste the asset and say which product, channel and states it targets.", icon: Send },
  { title: "Automated pre-check", body: "Rules and an AI pass flag issues, each with a quote, a citation and a suggested fix.", icon: FileSearch },
  { title: "Human review", body: "A reviewer accepts or dismisses each finding and decides: approve, request changes or reject.", icon: UserRoundCheck },
  { title: "Audit trail", body: "Every version, finding and decision is recorded and can never be edited.", icon: ScrollText },
];

const PATH: { who: string; role: Role; action: string }[] = [
  { who: "Jordan", role: "affiliate", action: "Load the risky example in New submission and run the pre-check." },
  { who: "Jordan", role: "affiliate", action: "Submit it." },
  { who: "Priya", role: "reviewer", action: "Open the review queue, accept or dismiss the findings, and request changes." },
  { who: "Jordan", role: "affiliate", action: "Switch back and resubmit as version 2." },
  { who: "Priya", role: "reviewer", action: "Read the diff against version 1, then approve." },
  { who: "Sofia", role: "lead", action: "Check the dashboard and the rules library." },
];

async function lookupPersonaUsers(): Promise<Record<Role, { id: number; name: string } | null>> {
  const entries = await Promise.all(
    ROLES.map(async (role) => {
      try {
        return [role, await findUserByEmail(PERSONAS[role].primaryEmail)] as const;
      } catch (err) {
        console.error(`landing: could not load demo user for ${role}`, err);
        return [role, null] as const;
      }
    }),
  );
  return Object.fromEntries(entries) as Record<Role, { id: number; name: string } | null>;
}

function PersonaCard({ role, user }: { role: Role; user: { id: number; name: string } | null }) {
  const persona = PERSONAS[role];
  const Icon = ROLE_ICONS[role];
  return (
    <Card className="flex flex-col transition-colors hover:border-border-strong">
      <CardHeader>
        <div className="mb-2 grid size-9 place-items-center border border-border-strong text-accent">
          <Icon aria-hidden className="size-[18px]" />
        </div>
        <CardTitle>{persona.label}</CardTitle>
        <CardDescription>{persona.description}</CardDescription>
      </CardHeader>
      <CardBody className="flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-subtle">Try this</p>
        <p className="mt-1 text-sm text-foreground">{persona.tryThis}</p>
      </CardBody>
      <div className="px-5 pb-5">
        {user ? (
          <form action={switchPersona.bind(null, user.id)}>
            <PendingSubmit variant={role === "affiliate" ? "primary" : "secondary"} className="w-full" pendingLabel={`Opening as ${user.name}...`}>
              Explore as {user.name}
              <ArrowRight aria-hidden className="size-4" />
            </PendingSubmit>
          </form>
        ) : (
          <Button disabled variant="secondary" className="w-full">
            Unavailable
          </Button>
        )}
      </div>
    </Card>
  );
}

async function PersonaCards() {
  // Defer to request time so the database is never queried during prerender.
  await connection();
  if (!isDemoMode()) {
    return (
      <div className="flex flex-col gap-4 border border-border bg-surface px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">Demo personas are turned off on this site. Create an account to submit your own assets, or sign in.</p>
        <div className="flex shrink-0 gap-3">
          <Link href="/signup" className={buttonVariants({ variant: "primary" })}>
            Create an account
          </Link>
          <Link href="/login" className={buttonVariants({ variant: "secondary" })}>
            Sign in
          </Link>
        </div>
      </div>
    );
  }
  const users = await lookupPersonaUsers();
  const anyMissing = ROLES.some((r) => !users[r]);
  return (
    <>
      {anyMissing ? (
        <p role="status" className="mb-4 border border-warning-line bg-warning-soft px-3 py-2 text-sm text-warning">
          The demo database is not reachable or has not been seeded yet, so these roles cannot be opened right now. Try again shortly.
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ROLES.map((role) => (
          <PersonaCard key={role} role={role} user={users[role]} />
        ))}
      </div>
    </>
  );
}

function PersonaCardsFallback() {
  return (
    <div aria-busy="true" aria-label="Loading roles" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {ROLES.map((r) => (
        <div key={r} className="h-72 animate-pulse border border-border bg-surface-muted" />
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="relative z-10 border-b border-border bg-background">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Wordmark />
          <nav aria-label="Page" className="flex items-center gap-4 text-sm text-muted sm:gap-5">
            <a href="#how" className="hidden hover:text-foreground md:inline">
              How it works
            </a>
            <a href={REPO_URL} className="hidden hover:text-foreground md:inline">
              Source
            </a>
            <a href="#roles" className="hidden hover:text-foreground sm:inline">
              Explore the demo
            </a>
            <Link href="/login" className="hover:text-foreground">
              Sign in
            </Link>
            <Link href="/signup" className={buttonVariants({ variant: "primary", size: "sm", className: "px-3 sm:px-4" })}>
              <span className="sm:hidden">Sign up</span>
              <span className="hidden sm:inline">Create an account</span>
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="bg-grid hero-glow relative border-b border-border">
          <div className="mx-auto max-w-4xl px-4 pb-20 pt-20 text-center sm:px-6 sm:pt-28">
            <p className="text-sm text-accent">Compliance review for consumer-finance marketing</p>
            <h1 className="mt-5 text-balance text-4xl leading-[1.06] tracking-[-0.03em] sm:text-6xl">
              Confirm the findings.
              <br />
              Skip the full re-read.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-balance text-lg leading-relaxed text-muted">
              Every marketing asset is checked against cited rules before it reaches compliance. Reviewers confirm or dismiss flagged findings instead of
              reading each asset from scratch, and every decision is audited.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a href="#roles" className={buttonVariants({ variant: "primary", size: "lg", className: "px-8" })}>
                Try it as a reviewer or a marketer
                <ArrowRight aria-hidden className="size-4" />
              </a>
              <a href={REPO_URL} className={buttonVariants({ variant: "ghost", size: "lg", className: "px-6" })}>
                Read the source
              </a>
            </div>
            <div className="mx-auto mt-12 flex max-w-2xl items-start gap-3 border border-border bg-surface/80 px-4 py-3 text-left text-sm backdrop-blur">
              <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
              <p className="text-foreground">
                <strong className="font-medium">The AI only flags. Humans decide.</strong> <span className="text-muted">It cannot approve an asset, clear a finding or change a status,
                and everything it reads, including the submitted text, is treated as untrusted data.</span>
              </p>
            </div>
          </div>
        </section>

        <section aria-labelledby="how" className="border-b border-border">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <h2 id="how" className="text-3xl tracking-[-0.03em]">
              From submission to audit trail
            </h2>
            <ol className="mt-8 grid border border-border sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step, i) => (
                <li key={step.title} className="border-b border-border p-6 last:border-b-0 sm:border-r sm:[&:nth-child(2n)]:border-r-0 lg:border-b-0 lg:border-r lg:[&:nth-child(2n)]:border-r lg:last:border-r-0">
                  <div className="flex items-center justify-between text-subtle">
                    <span className="font-mono text-xs">0{i + 1}</span>
                    <step.icon aria-hidden className="size-4" />
                  </div>
                  <h3 className="mt-6 text-base">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section aria-labelledby="roles" className="mx-auto max-w-6xl scroll-mt-4 px-4 py-14 sm:px-6">
          <h2 id="roles" className="text-3xl tracking-[-0.03em]">
            Explore with a demo persona
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            No sign-up and no password: each persona is a fictional person with seeded history, and you can switch between them at any time from the menu in
            the top right. Anyone can open these personas, so do not paste anything real into them.
          </p>
          <p className="mb-8 mt-2 max-w-2xl text-sm text-muted">
            Want to check your own ads?{" "}
            <Link href="/signup" className="text-foreground underline underline-offset-4 hover:text-accent">
              Create an account
            </Link>{" "}
            to upload them under your own name. While demo personas are on, anyone exploring as a reviewer can read the review queue, so do not upload
            anything confidential. Already have an account?{" "}
            <Link href="/login" className="text-foreground underline underline-offset-4 hover:text-accent">
              Sign in
            </Link>
            .
          </p>
          <Suspense fallback={<PersonaCardsFallback />}>
            <PersonaCards />
          </Suspense>
        </section>

        <section aria-labelledby="path" className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <div className="border border-border bg-surface">
            <div className="border-b border-border px-6 py-5 sm:px-8">
              <h2 id="path" className="text-2xl tracking-[-0.03em]">
                Suggested 3-minute path
              </h2>
              <p className="mt-1 text-sm text-muted">One asset, one revision cycle, every role. Start by choosing Affiliate partner above.</p>
            </div>
            <ol>
              {PATH.map((step, i) => (
                <li key={i} className="grid grid-cols-[2.5rem_1fr] items-baseline gap-3 border-b border-border px-6 py-4 last:border-b-0 sm:grid-cols-[2.5rem_11rem_1fr] sm:px-8">
                  <span className="font-mono text-xs text-subtle">0{i + 1}</span>
                  <p className="text-sm">
                    <span className="text-foreground">{step.who}</span>
                    <span className="text-subtle"> ({PERSONAS[step.role].label.toLowerCase()})</span>
                  </p>
                  <p className="col-span-2 text-sm text-muted sm:col-span-1">{step.action}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-subtle sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>Demo with a fictional company and fictional data. Not legal advice.</p>
          <Link href={REPO_URL} className="text-muted underline underline-offset-4 hover:text-foreground">
            github.com/sriramssenthil/clearpath-compliance
          </Link>
        </div>
      </footer>
    </div>
  );
}
