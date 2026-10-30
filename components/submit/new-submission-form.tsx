"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Info, Lightbulb, Trash2 } from "lucide-react";
import { CHANNELS, PRODUCTS, type Channel, type Product } from "@/lib/compliance/types";
import type { ExampleAsset } from "@/lib/seed/examples";
import type { Role } from "@/lib/personas";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { createSubmissionAction, precheckAction } from "@/app/(app)/submissions/actions";
import { ExampleMenu } from "./example-menu";
import { FileDrop } from "./file-drop";
import { fileKey, prepareFile, toFormData, type PreparedFile } from "./prepare-file";
import { Field, INPUT_CLASS } from "./field";
import { CHANNEL_LABEL, MAX_CONTENT, MIN_CONTENT, PRODUCT_LABEL } from "./options";
import { StatePicker } from "./state-picker";
import { SubmitBar } from "./submit-bar";
import { isStale, usePrecheck } from "./use-precheck";
import { Workspace } from "./workspace";

interface Draft {
  title: string;
  product: Product;
  channel: Channel;
  states: string[];
  launchDate: string;
  priority: "standard" | "expedited";
  priorityReason: string;
  notes: string;
  content: string;
}

const EMPTY: Draft = {
  title: "",
  product: "personal_loan",
  channel: "email",
  states: [],
  launchDate: "",
  priority: "standard",
  priorityReason: "",
  notes: "",
  content: "",
};

const draftKey = (userId: number) => `clearpath.draft.v1.${userId}`;

function readDraft(userId: number): Draft | null {
  try {
    const raw = localStorage.getItem(draftKey(userId));
    if (!raw) return null;
    const d = { ...EMPTY, ...JSON.parse(raw) } as Draft;
    if (!PRODUCTS.includes(d.product) || !CHANNELS.includes(d.channel) || !Array.isArray(d.states)) return null;
    return d;
  } catch {
    return null;
  }
}

const isBlank = (d: Draft) => !d.title && !d.content && !d.notes && !d.priorityReason && !d.launchDate && d.states.length === 0;

type Errors = Partial<Record<"title" | "content" | "priorityReason" | "form", string>>;

/** Maps the service's first validation message to the field it is about. */
function fieldFor(message: string): keyof Errors {
  if (/title/i.test(message)) return "title";
  if (/asset text|sentence|file|PDF|image|character limit/i.test(message)) return "content";
  if (/expedited|reason/i.test(message)) return "priorityReason";
  return "form";
}

export interface MasterOption {
  id: number;
  code: string;
  title: string;
  product: string;
}

export function NewSubmissionForm({ userId, role, masters = [] }: { userId: number; role: Role; masters?: MasterOption[] }) {
  const [parentId, setParentId] = useState<number | null>(null);
  const router = useRouter();
  const [f, setF] = useState<Draft>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [restored, setRestored] = useState(false);
  const [exampleNote, setExampleNote] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [file, setFile] = useState<PreparedFile | null>(null);
  const [exampleLoading, setExampleLoading] = useState(false);
  const hydrated = useRef(false);
  const pre = usePrecheck((content) => precheckAction({ product: f.product, channel: f.channel, states: f.states, content }, toFormData(file)));
  const resetPre = pre.reset;

  // Restore after mount (localStorage does not exist on the server); then keep it saved.
  useEffect(() => {
    const t = setTimeout(() => {
      const d = readDraft(userId);
      if (d && !isBlank(d)) {
        setF(d);
        setRestored(true);
      }
      hydrated.current = true;
    }, 0);
    return () => clearTimeout(t);
  }, [userId]);

  useEffect(() => {
    if (!hydrated.current) return;
    const t = setTimeout(() => {
      try {
        if (isBlank(f)) localStorage.removeItem(draftKey(userId));
        else localStorage.setItem(draftKey(userId), JSON.stringify(f));
      } catch {
        /* storage unavailable: the draft is a convenience only */
      }
    }, 500);
    return () => clearTimeout(t);
  }, [f, userId]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setF((prev) => ({ ...prev, [key]: value }));
    setConfirmOpen(false);
    setErrors((e) => (e[key as keyof Errors] || e.form ? { ...e, [key]: undefined, form: undefined } : e));
  };

  const changeFile = (next: PreparedFile | null) => {
    setFile(next);
    setConfirmOpen(false);
    setErrors((e) => (e.content || e.form ? { ...e, content: undefined, form: undefined } : e));
  };

  const loadExample = async (ex: ExampleAsset) => {
    setF((prev) => ({ ...prev, title: ex.title, product: ex.product, channel: ex.channel, states: [...ex.states], content: ex.content }));
    if (file) URL.revokeObjectURL(file.previewUrl);
    setFile(null);
    if (ex.image) {
      // Image examples load the real file into the uploader, exactly as if it had been dropped in.
      setExampleLoading(true);
      try {
        const blob = await fetch(ex.image.src).then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))));
        const res = await prepareFile(new File([blob], ex.image.filename, { type: blob.type }));
        if (res.ok) setFile(res.file);
        else setErrors({ content: res.error });
      } catch {
        setErrors({ content: "The example image could not be loaded. Try again, or pick another example." });
      } finally {
        setExampleLoading(false);
      }
    }
    resetPre();
    setErrors({});
    setConfirmOpen(false);
    setRestored(false);
    const mine = role === "affiliate";
    setExampleNote(
      ex.isAffiliate === mine
        ? null
        : ex.isAffiliate
          ? "This example was written as an affiliate partner's asset. It loads fine, but rules that apply only to affiliate submissions will not be checked for you."
          : "This example was written as an in-house marketing asset. It loads fine; affiliate-only rules still apply to your submissions and may add findings.",
    );
  };

  const discard = () => {
    setF(EMPTY);
    if (file) URL.revokeObjectURL(file.previewUrl);
    setFile(null);
    resetPre();
    setErrors({});
    setConfirmOpen(false);
    setRestored(false);
    setExampleNote(null);
    try {
      localStorage.removeItem(draftKey(userId));
    } catch {
      /* ignore */
    }
  };

  const analysis = pre.result?.analysis ?? null;
  const contextKey = JSON.stringify([f.product, f.channel, f.states, fileKey(file)]);
  const stale = isStale(pre, f.content, contextKey);
  const flagged = analysis?.findings.length ?? 0;
  const items = (n: number) => `${n} ${n === 1 ? "item" : "items"}`;
  const confirmMessage =
    confirmOpen && analysis
      ? stale
        ? `You edited the text since the last check; compliance will see the latest version.${flagged > 0 ? ` The last check flagged ${items(flagged)}.` : ""}`
        : `Submit with ${flagged} flagged ${flagged === 1 ? "item" : "items"}? Compliance will see ${flagged === 1 ? "it" : "them"}.`
      : null;

  const validate = (): Errors => {
    const e: Errors = {};
    if (f.title.trim().length < 3) e.title = "Give the submission a title (3+ characters).";
    const len = f.content.trim().length;
    if (!file && len < MIN_CONTENT) e.content = "Paste at least a sentence or two of the asset text, or attach the ad as an image or PDF.";
    else if (len > MAX_CONTENT) e.content = `The text is over the ${MAX_CONTENT.toLocaleString("en-US")} character limit.`;
    if (f.priority === "expedited" && !f.priorityReason.trim()) e.priorityReason = "Expedited reviews need a reason (for example a launch date).";
    return e;
  };

  const send = async () => {
    setSubmitting(true);
    const res = await createSubmissionAction({
      title: f.title,
      product: f.product,
      channel: f.channel,
      states: f.states,
      content: f.content,
      launchDate: f.launchDate || null,
      priority: f.priority,
      priorityReason: f.priority === "expedited" ? f.priorityReason : null,
      notes: f.notes.trim() || null,
      parentId: masters.some((m) => m.id === parentId && m.product === f.product) ? parentId : null,
    }, toFormData(file)).catch(() => ({ ok: false as const, error: "Could not reach the server. Your draft is safe; try again." }));
    if (!res.ok) {
      setSubmitting(false);
      setConfirmOpen(false);
      setErrors({ [fieldFor(res.error)]: res.error });
      return;
    }
    try {
      localStorage.removeItem(draftKey(userId));
    } catch {
      /* ignore */
    }
    router.push(`/submissions/${res.data.id}`);
  };

  const onSubmit = () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) {
      document.getElementById(e.title ? "title" : e.priorityReason ? "priority-reason" : "asset-content")?.focus();
      return;
    }
    if (analysis && (stale || flagged > 0)) setConfirmOpen(true);
    else void send();
  };

  const pristine = isBlank(f) && !restored && !file && !exampleLoading;
  const fieldIssue = errors.title || errors.priorityReason || errors.content;

  return (
    <div className="space-y-6">
      {pristine ? (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-accent-line bg-accent-soft p-4">
          <div className="flex items-start gap-3">
            <Lightbulb aria-hidden className="mt-0.5 size-5 shrink-0 text-accent" />
            <div>
              <p className="text-sm font-medium">New here? Load an example ad to see the pre-check in action.</p>
              <p className="mt-0.5 text-sm text-muted">It fills in the form with realistic copy that has a few typical problems. Nothing is sent until you submit.</p>
            </div>
          </div>
          <ExampleMenu onPick={(ex) => void loadExample(ex)} variant="primary" />
        </div>
      ) : null}

      {restored ? (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm">
          <span className="text-muted">We restored your unsent draft from this device.</span>
          <Button size="sm" variant="ghost" onClick={discard}>
            <Trash2 aria-hidden className="size-3.5" />
            Discard draft
          </Button>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardDescription>What the asset is and where it will run. The pre-check uses the product, channel and states to choose which rules apply.</CardDescription>
        </CardHeader>
        <CardBody className="grid gap-5 md:grid-cols-6">
          <Field label="Title" htmlFor="title" error={errors.title} className="md:col-span-6">
            <input
              id="title"
              className={INPUT_CLASS}
              value={f.title}
              maxLength={120}
              aria-invalid={Boolean(errors.title)}
              onChange={(e) => set("title", e.target.value)}
              placeholder="e.g. October personal loan email, variant B"
            />
          </Field>
          <Field label="Product" htmlFor="product" className="md:col-span-3">
            <select id="product" className={INPUT_CLASS} value={f.product} onChange={(e) => set("product", e.target.value as Product)}>
              {PRODUCTS.map((p) => (
                <option key={p} value={p}>
                  {PRODUCT_LABEL[p]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Channel" htmlFor="channel" className="md:col-span-3">
            <select id="channel" className={INPUT_CLASS} value={f.channel} onChange={(e) => set("channel", e.target.value as Channel)}>
              {CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {CHANNEL_LABEL[c]}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Target states"
            hint="Some rules apply only to certain states, for example California. Leave as nationwide if the asset is not state-specific."
            className="md:col-span-6"
          >
            <StatePicker value={f.states} onChange={(v) => set("states", v)} />
          </Field>
          <Field label="Target launch date" htmlFor="launch" optional className="md:col-span-3">
            <input id="launch" type="date" className={INPUT_CLASS} value={f.launchDate} onChange={(e) => set("launchDate", e.target.value)} />
          </Field>
          <fieldset className="space-y-1.5 md:col-span-3">
            <legend className="text-sm font-medium">Priority</legend>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["standard", "Standard", "Response within 72 hours"],
                  ["expedited", "Expedited", "Response within 24 hours"],
                ] as const
              ).map(([value, label, sub]) => (
                <label
                  key={value}
                  className={cn(
                    "cursor-pointer rounded-md border px-3 py-1.5 text-sm has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
                    f.priority === value ? "border-accent bg-accent-soft" : "border-border-strong hover:bg-surface-muted",
                  )}
                >
                  <input type="radio" name="priority" value={value} checked={f.priority === value} onChange={() => set("priority", value)} className="sr-only" />
                  <span className="block font-medium leading-5">{label}</span>
                  <span className="block text-xs text-muted">{sub}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {f.priority === "expedited" ? (
            <Field label="Why does this need to be expedited?" htmlFor="priority-reason" error={errors.priorityReason} className="md:col-span-6">
              <input
                id="priority-reason"
                className={INPUT_CLASS}
                value={f.priorityReason}
                maxLength={500}
                aria-invalid={Boolean(errors.priorityReason)}
                onChange={(e) => set("priorityReason", e.target.value)}
                placeholder="e.g. Campaign goes live Friday"
              />
            </Field>
          ) : null}
          <Field label="Notes for the reviewer" htmlFor="notes" optional hint="Context that is not in the text: audience, where it appears, what changed since the last approved version." className="md:col-span-6">
            <textarea id="notes" rows={3} maxLength={2000} className={cn(INPUT_CLASS, "h-auto py-2")} value={f.notes} onChange={(e) => set("notes", e.target.value)} />
          </Field>
          {masters.some((m) => m.product === f.product) ? (
            <Field
              label="Variant of an approved asset"
              htmlFor="parent"
              optional
              hint="Pick the approved master if this is a campaign variant. When only greetings, names or button labels differ, compliance can fast-track it."
              className="md:col-span-6"
            >
              <select
                id="parent"
                className={INPUT_CLASS}
                value={parentId !== null && masters.some((m) => m.id === parentId && m.product === f.product) ? String(parentId) : ""}
                onChange={(e) => setParentId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Not a variant</option>
                {masters
                  .filter((m) => m.product === f.product)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.code}: {m.title}
                    </option>
                  ))}
              </select>
            </Field>
          ) : null}
        </CardBody>
      </Card>

      {exampleNote ? (
        <p role="note" className="flex items-start gap-2 rounded-md border border-info-line bg-info-soft px-3 py-2 text-sm text-info">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
          {exampleNote}
        </p>
      ) : null}

      <Workspace
        text={f.content}
        onTextChange={(v) => set("content", v)}
        pre={pre}
        disabled={submitting}
        textError={errors.content}
        contextKey={contextKey}
        toolbar={pristine ? undefined : <ExampleMenu onPick={(ex) => void loadExample(ex)} disabled={submitting || exampleLoading} />}
        hasFile={Boolean(file)}
        fileSlot={
          exampleLoading ? (
            <p role="status" className="rounded-md border border-dashed border-border-strong px-4 py-6 text-center text-sm text-muted">
              Loading the example image...
            </p>
          ) : (
            <FileDrop value={file} onChange={changeFile} disabled={submitting} />
          )
        }
      />

      <SubmitBar
        label="Submit to compliance"
        pendingLabel="Submitting..."
        submitting={submitting}
        confirmMessage={confirmMessage}
        error={errors.form ?? (fieldIssue ? "Fix the field marked above to submit." : null)}
        hint={analysis ? null : "Tip: run the pre-check first to fix issues before compliance sees the asset."}
        onSubmit={onSubmit}
        onConfirm={() => void send()}
        onCancelConfirm={() => setConfirmOpen(false)}
        left={
          isBlank(f) ? null : (
            <span className="flex items-center gap-3">
              Draft saved on this device{file ? " (the attached file is not saved with it)" : ""}
              <button type="button" onClick={discard} disabled={submitting} className="font-medium text-muted underline underline-offset-2 hover:text-foreground">
                Discard draft
              </button>
            </span>
          )
        }
      />
    </div>
  );
}
