export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading submission" className="space-y-5">
      <div className="h-4 w-40 animate-pulse rounded bg-surface-muted" />
      <div className="h-8 w-2/3 animate-pulse rounded-md bg-surface-muted" />
      <div className="h-24 animate-pulse rounded-lg bg-surface-muted" />
      <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
        <div className="h-96 animate-pulse rounded-lg bg-surface-muted" />
        <div className="h-96 animate-pulse rounded-lg bg-surface-muted" />
      </div>
    </div>
  );
}
