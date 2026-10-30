import { CopyButton } from "./copy-button";

/** Email-like rendering of a generated feedback draft. */
export function FeedbackEmail({ label, to, subject, body }: { label: string; to: string; subject: string; body: string }) {
  return (
    <section aria-label={label} className="overflow-hidden rounded-lg border border-border bg-surface text-sm">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-surface-muted px-3 py-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</h4>
        <CopyButton text={body} label="Copy email" />
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 border-b border-border px-3 py-2 text-xs">
        <dt className="text-subtle">To</dt>
        <dd className="text-foreground">{to}</dd>
        <dt className="text-subtle">Subject</dt>
        <dd className="text-foreground">{subject}</dd>
      </dl>
      <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap break-words px-3 py-3 font-sans text-[13.5px] leading-relaxed text-foreground">{body}</pre>
    </section>
  );
}
