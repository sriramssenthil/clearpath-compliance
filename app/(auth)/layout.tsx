import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/ui/wordmark";

function CardFallback() {
  return <div aria-busy="true" aria-label="Loading" className="h-96 animate-pulse border border-border bg-surface-muted" />;
}

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Wordmark />
          <Link href="/" className="text-sm text-muted hover:text-foreground">
            Back to home
          </Link>
        </div>
      </header>
      <main id="main" className="bg-grid flex flex-1 justify-center px-4 py-12 sm:py-20">
        <div className="w-full max-w-md">
          <Suspense fallback={<CardFallback />}>{children}</Suspense>
        </div>
      </main>
      <footer className="border-t border-border">
        <p className="mx-auto max-w-6xl px-4 py-5 text-sm text-subtle sm:px-6">Demo with a fictional company and fictional data. Not legal advice.</p>
      </footer>
    </div>
  );
}
