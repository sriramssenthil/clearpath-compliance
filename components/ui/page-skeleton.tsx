/** Shown instantly on navigation (route loading.tsx files) while a dynamic page renders. */
export function PageSkeleton({ label = "Loading" }: { label?: string }) {
  return (
    <div aria-busy="true" aria-label={label} className="space-y-4">
      <div className="h-7 w-56 animate-pulse bg-surface-muted" />
      <div className="h-4 w-80 max-w-full animate-pulse bg-surface-muted" />
      <div className="grid gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse border border-border bg-surface-muted" />
        ))}
      </div>
      <div className="h-64 animate-pulse border border-border bg-surface-muted" />
    </div>
  );
}
