"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Channel, Product } from "@/lib/compliance/types";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { precheckForSubmissionAction, resubmitAction } from "@/app/(app)/submissions/actions";
import { CHANNEL_LABEL, MAX_CONTENT, MIN_CONTENT, PRODUCT_LABEL } from "./options";
import { SubmitBar } from "./submit-bar";
import { stateName } from "./us-states";
import { isStale, usePrecheck } from "./use-precheck";
import { Workspace } from "./workspace";

interface Props {
  submissionId: number;
  title: string;
  product: Product;
  channel: Channel;
  states: string[];
  initialContent: string;
}

export function ResubmitForm({ submissionId, title, product, channel, states, initialContent }: Props) {
  const router = useRouter();
  const [text, setText] = useState(initialContent);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const pre = usePrecheck((content) => precheckForSubmissionAction(submissionId, content));

  const analysis = pre.result?.analysis ?? null;
  const stale = isStale(pre, text);
  const flagged = analysis?.findings.length ?? 0;
  const unchanged = text.trim() === initialContent.trim();
  const tooShort = text.trim().length < MIN_CONTENT;
  const tooLong = text.length > MAX_CONTENT;
  const items = (n: number) => `${n} ${n === 1 ? "item" : "items"}`;

  const confirmMessage =
    confirmOpen && analysis
      ? stale
        ? `You edited the text since the last check; compliance will see the latest version.${flagged > 0 ? ` The last check flagged ${items(flagged)}.` : ""}`
        : `Submit a new version with ${items(flagged)} still flagged? Compliance will see ${flagged === 1 ? "it" : "them"}.`
      : null;

  const onText = (v: string) => {
    setText(v);
    setError(null);
    setConfirmOpen(false);
  };

  const send = async () => {
    setSubmitting(true);
    const res = await resubmitAction(submissionId, text).catch(() => ({ ok: false as const, error: "Could not reach the server. Your edits are still here; try again." }));
    if (!res.ok) {
      setSubmitting(false);
      setConfirmOpen(false);
      setError(res.error);
      return;
    }
    router.push(`/submissions/${submissionId}?resubmitted=${res.data.resolved}`);
  };

  const onSubmit = () => {
    if (unchanged) return setError("The text is identical to the version compliance reviewed. Make your changes before resubmitting.");
    if (tooShort) return setError("Paste at least a sentence or two of the asset text.");
    if (tooLong) return setError(`The text is over the ${MAX_CONTENT.toLocaleString("en-US")} character limit.`);
    if (analysis && (stale || flagged > 0)) setConfirmOpen(true);
    else void send();
  };

  const facts: [string, string][] = [
    ["Product", PRODUCT_LABEL[product]],
    ["Channel", CHANNEL_LABEL[channel]],
    ["Target states", states.length ? states.map(stateName).join(", ") : "Nationwide / not state-specific"],
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardBody>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
            {facts.map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs font-medium uppercase tracking-wide text-subtle">{k}</dt>
                <dd className="mt-0.5 text-sm">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-muted">These are fixed for this submission. To change them, withdraw it and start a new submission.</p>
        </CardBody>
      </Card>

      <Workspace text={text} onTextChange={onText} pre={pre} disabled={submitting} />

      <SubmitBar
        label="Submit new version"
        pendingLabel="Submitting..."
        submitting={submitting}
        confirmMessage={confirmMessage}
        error={error}
        hint={unchanged ? "Edit the text to address the feedback, then submit the new version." : analysis ? null : "Tip: run the pre-check to see which of the requested changes are fixed."}
        onSubmit={onSubmit}
        onConfirm={() => void send()}
        onCancelConfirm={() => setConfirmOpen(false)}
      />
    </div>
  );
}
