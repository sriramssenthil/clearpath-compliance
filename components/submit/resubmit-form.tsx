"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AssetInfo } from "@/lib/compliance/feature-types";
import type { Channel, Product } from "@/lib/compliance/types";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { precheckForSubmissionAction, resubmitAction, type FileMode } from "@/app/(app)/submissions/actions";
import { FileDrop } from "./file-drop";
import { fileKey, toFormData, type PreparedFile } from "./prepare-file";
import { CHANNEL_LABEL, MAX_CONTENT, MIN_CONTENT, PRODUCT_LABEL } from "./options";
import { SubmitBar } from "./submit-bar";
import { Button } from "@/components/ui/button";
import { stateName } from "./us-states";
import { isStale, usePrecheck } from "./use-precheck";
import { Workspace } from "./workspace";

interface Props {
  submissionId: number;
  title: string;
  product: Product;
  channel: Channel;
  states: string[];
  /** The previous version's typed text (not its transcription). */
  initialContent: string;
  /** The previous version's file, kept by default. */
  currentAsset?: AssetInfo | null;
}

export function ResubmitForm({ submissionId, title, product, channel, states, initialContent, currentAsset = null }: Props) {
  const router = useRouter();
  const [text, setText] = useState(initialContent);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<FileMode>(currentAsset ? "keep" : "none");
  const [newFile, setNewFile] = useState<PreparedFile | null>(null);
  const pre = usePrecheck((content) => precheckForSubmissionAction(submissionId, content, mode, toFormData(mode === "new" ? newFile : null)));

  const hasFile = (mode === "keep" && currentAsset !== null) || (mode === "new" && newFile !== null);
  const contextKey = JSON.stringify([mode, fileKey(newFile)]);
  const analysis = pre.result?.analysis ?? null;
  const stale = isStale(pre, text, contextKey);
  const flagged = analysis?.findings.length ?? 0;
  const unchanged = text.trim() === initialContent.trim() && (currentAsset ? mode === "keep" : mode !== "new");
  const tooShort = !hasFile && text.trim().length < MIN_CONTENT;
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
    const res = await resubmitAction(submissionId, text, mode, toFormData(mode === "new" ? newFile : null)).catch(() => ({ ok: false as const, error: "Could not reach the server. Your edits are still here; try again." }));
    if (!res.ok) {
      setSubmitting(false);
      setConfirmOpen(false);
      setError(res.error);
      return;
    }
    router.push(`/submissions/${submissionId}?resubmitted=${res.data.resolved}`);
  };

  const onSubmit = () => {
    if (unchanged)
      return setError(
        currentAsset
          ? "The text and the file are identical to the version compliance reviewed. Make your changes before resubmitting."
          : "The text is identical to the version compliance reviewed. Make your changes before resubmitting.",
      );
    if (tooShort) return setError("Paste at least a sentence or two of the asset text, or attach the ad as an image or PDF.");
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

      <Workspace
        text={text}
        onTextChange={onText}
        pre={pre}
        disabled={submitting}
        contextKey={contextKey}
        hasFile={hasFile}
        fileSlot={
          <div className="space-y-2">
            <FileDrop
              value={mode === "new" ? newFile : null}
              onChange={(f) => {
                setNewFile(f);
                setMode(f ? "new" : "none");
                setError(null);
                setConfirmOpen(false);
              }}
              disabled={submitting}
              kept={mode === "keep" && currentAsset ? { info: currentAsset, url: `/api/assets/${currentAsset.id}` } : null}
              onRemoveKept={() => {
                setMode("none");
                setError(null);
                setConfirmOpen(false);
              }}
            />
            {currentAsset && mode !== "keep" ? (
              <p className="text-xs text-muted">
                {mode === "none" ? "The new version will have no file. " : "This file replaces the previous one. "}
                <button
                  type="button"
                  className="font-medium text-accent hover:underline"
                  disabled={submitting}
                  onClick={() => {
                    if (newFile) URL.revokeObjectURL(newFile.previewUrl);
                    setNewFile(null);
                    setMode("keep");
                    setConfirmOpen(false);
                  }}
                >
                  Keep the previous file ({currentAsset.filename})
                </button>
              </p>
            ) : null}
          </div>
        }
      />

      <SubmitBar
        label="Submit new version"
        pendingLabel="Submitting..."
        submitting={submitting}
        confirmMessage={confirmMessage}
        error={error}
        hint={unchanged ? "Edit the text or replace the file to address the feedback, then submit the new version." : analysis ? null : "Tip: run the pre-check to see which of the requested changes are fixed."}
        onSubmit={onSubmit}
        onConfirm={() => void send()}
        onCancelConfirm={() => setConfirmOpen(false)}
        secondary={
          text.trim() || hasFile ? (
            <Button variant="secondary" onClick={() => pre.run(text, contextKey)} disabled={pre.phase === "running" || submitting}>
              {pre.phase === "running" ? "Checking..." : pre.result ? "Re-run pre-check" : "Run pre-check"}
            </Button>
          ) : null
        }
      />
    </div>
  );
}
