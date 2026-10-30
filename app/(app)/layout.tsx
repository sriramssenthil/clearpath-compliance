import { Suspense, type ReactNode } from "react";
import { listDemoUsers, requireUser, signOut, switchPersona } from "@/lib/auth";
import { Wordmark } from "@/components/ui/wordmark";
import { navFor } from "@/lib/personas";
import { NavLinks } from "./_components/nav-links";
import { PersonaMenu } from "./_components/persona-menu";

function DemoBanner() {
  return (
    <div role="note" className="border-b border-warning-line bg-warning-soft px-4 py-1 text-center text-xs text-warning">
      Demo environment: fictional company and data. Not legal advice.
    </div>
  );
}

function PageFallback() {
  return (
    <div aria-busy="true" aria-label="Loading" className="space-y-4">
      <div className="h-7 w-56 animate-pulse rounded-md bg-surface-muted" />
      <div className="h-4 w-80 max-w-full animate-pulse rounded-md bg-surface-muted" />
      <div className="h-48 animate-pulse rounded-lg bg-surface-muted" />
    </div>
  );
}

function ShellFallback() {
  return (
    <>
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-14 max-w-6xl items-center px-4 sm:px-6">
          <Wordmark />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <PageFallback />
      </main>
    </>
  );
}

// The session read happens here, behind a Suspense boundary, so the banner and fallback stay in the static shell.
async function Shell({ children }: { children: ReactNode }) {
  const user = await requireUser();
  // Only a demo persona gets the persona switcher; real accounts never see (or load) the demo list.
  const users = user.isDemo ? await listDemoUsers() : [];
  const items = navFor(user.role);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 pt-2 sm:h-14 sm:flex-nowrap sm:py-0 sm:px-6">
          <Wordmark />
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="hidden sm:block">
              <NavLinks items={items} />
            </div>
            <PersonaMenu
              users={users.map((u) => ({ id: u.id, name: u.name, role: u.role, partnerName: u.partnerName }))}
              current={{ id: user.id, name: user.name, email: user.email, role: user.role, partnerName: user.partnerName, isDemo: user.isDemo }}
              switchAction={switchPersona}
              signOutAction={signOut}
            />
          </div>
          <div className="order-last w-full pb-2 sm:hidden">
            <NavLinks items={items} />
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <Suspense fallback={<PageFallback />}>{children}</Suspense>
      </main>
    </>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <DemoBanner />
      <Suspense fallback={<ShellFallback />}>
        <Shell>{children}</Shell>
      </Suspense>
    </div>
  );
}
