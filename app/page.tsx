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
import { findUserByEmail, switchPersona } from "@/lib/auth";
import { PERSONAS, ROLES, type Role } from "@/lib/personas";
import { Button } from "@/components/ui/button";
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
    <Card className="flex flex-col">
      <CardHeader>
        <div className="mb-2 grid size-9 place-items-center rounded-md bg-accent-soft text-accent">
          <Icon aria-hidden className="size-[18px]" />
        </div>
        <CardTitle>{persona.label}</CardTitle>
        <CardDescription>{persona.description}</CardDescription>
      </CardHeader>
      <CardBody className="flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-subtle">Try this</p>
        <p className="mt-1 text-sm text-foreground">{persona.tryThis}</p>
      </CardBody>
      <div className="px-5 pb-5">
        {user ? (
          <form action={switchPersona.bind(null, user.id)}>
            <Button type="submit" variant={role === "affiliate" ? "primary" : "secondary"} className="w-full">
              Explore as {user.name}
              <ArrowRight aria-hidden className="size-4" />
            </Button>
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
  const users = await lookupPersonaUsers();
  const anyMissing = ROLES.some((r) => !users[r]);
  return (
    <>
      {anyMissing ? (
        <p role="status" className="mb-4 rounded-md border border-warning-line bg-warning-soft px-3 py-2 text-sm text-warning">
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
        <div key={r} className="h-72 animate-pulse rounded-lg border border-border bg-surface-muted" />
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <span className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="grid size-7 place-items-center rounded-md bg-accent text-accent-foreground">
              <ShieldCheck aria-hidden className="size-4" />
            </span>
            ClearPath Review
          </span>
          <a href={REPO_URL} className="rounded-md px-2 py-1 text-sm text-muted hover:text-foreground">
            Source on GitHub
          </a>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-4 pb-12 pt-14 sm:px-6 sm:pt-20">
          <p className="text-sm font-medium text-accent">Compliance review for consumer-finance marketing</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight text-balance sm:text-5xl">
            Confirm the findings. Skip the full re-read.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">
            ClearPath Review checks every marketing asset against cited rules before it reaches compliance. Reviewers confirm or dismiss flagged findings
            instead of reading each asset from scratch, marketers and affiliates self-check before they submit, and every decision is audited.
          </p>
          <div className="mt-6 flex max-w-2xl items-start gap-3 rounded-lg border border-accent-line bg-accent-soft px-4 py-3 text-sm">
            <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
            <p className="text-foreground">
              <strong className="font-semibold">The AI only flags. Humans decide.</strong> It cannot approve an asset, clear a finding or change a status,
              and everything it reads, including the submitted text, is treated as untrusted data.
            </p>
          </div>
        </section>

        <section aria-labelledby="how" className="border-y border-border bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
            <h2 id="how" className="text-sm font-semibold uppercase tracking-wide text-subtle">
              How it works
            </h2>
            <ol className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
              {STEPS.map((step, i) => (
                <li key={step.title} className="relative flex gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full border border-border-strong bg-surface-muted text-sm font-semibold text-foreground">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="flex items-center gap-2 font-semibold">
                      {step.title}
                      <step.icon aria-hidden className="size-4 text-subtle" />
                    </h3>
                    <p className="mt-1 text-sm text-muted">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section aria-labelledby="roles" className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <h2 id="roles" className="text-2xl font-semibold tracking-tight">
            Pick a role to explore
          </h2>
          <p className="mb-6 mt-1 max-w-2xl text-sm text-muted">
            No sign-up and no passwords: this is a demo, and you can switch between people at any time from the menu in the top right.
          </p>
          <Suspense fallback={<PersonaCardsFallback />}>
            <PersonaCards />
          </Suspense>
        </section>

        <section aria-labelledby="path" className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <div className="rounded-lg border border-border bg-surface p-6 shadow-card sm:p-8">
            <h2 id="path" className="text-2xl font-semibold tracking-tight">
              Suggested 3-minute path
            </h2>
            <p className="mt-1 text-sm text-muted">One asset, one revision cycle, every role. Start by choosing Affiliate partner above.</p>
            <ol className="mt-6 grid gap-x-10 gap-y-4 md:grid-cols-2">
              {PATH.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">{i + 1}</span>
                  <p className="text-sm">
                    <span className="font-semibold">{step.who}</span>
                    <span className="text-subtle"> ({PERSONAS[step.role].label.toLowerCase()})</span>
                    <span className="text-muted">: {step.action}</span>
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-subtle sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>Demo with a fictional company and fictional data. Not legal advice.</p>
          <Link href={REPO_URL} className="font-medium text-muted underline underline-offset-4 hover:text-foreground">
            github.com/sriramssenthil/clearpath-compliance
          </Link>
        </div>
      </footer>
    </div>
  );
}
