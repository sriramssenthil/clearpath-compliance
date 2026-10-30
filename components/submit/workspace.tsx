"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AssetEditor } from "./asset-editor";
import { HighlightedText } from "./highlighted-text";
import { MIN_CONTENT } from "./options";
import { PrecheckPanel } from "./precheck-panel";
import { appendText, replaceQuote, sortByPosition, validSpan } from "./segments";
import { isStale, type PrecheckHandle } from "./use-precheck";

interface Props {
  text: string;
  onTextChange: (v: string) => void;
  pre: PrecheckHandle;
  disabled?: boolean;
  textError?: string | null;
  /** Changes whenever the product, channel or states change, which also outdates a result. */
  contextKey?: string;
  toolbar?: ReactNode;
}

const EMPTY: Record<number, string> = {};

/** Asset editor and pre-check results side by side (stacked on small screens), wired together. */
export function Workspace({ text, onTextChange, pre, disabled, textError, contextKey = "", toolbar }: Props) {
  const [view, setView] = useState<"edit" | "highlight">("edit");
  const [activeKey, setActiveKey] = useState<number | null>(null);
  const [noteState, setNoteState] = useState<{ owner: unknown; map: Record<number, string> }>({ owner: null, map: {} });
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const pulse = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<{ id: string } | null>(null);
  const [, setTick] = useState(0);

  const analysis = pre.result?.analysis ?? null;
  const sorted = useMemo(() => sortByPosition(analysis?.findings ?? []), [analysis]);
  const stale = isStale(pre, text, contextKey);
  const running = pre.phase === "running";
  const canRun = text.trim().length >= MIN_CONTENT;
  const anyLocated = Boolean(analysis) && sorted.some((f) => validSpan(analysis!.content, f) !== null);
  const canHighlight = anyLocated && !stale;
  const labels = useMemo(
    () => sorted.map((f) => ({ ...f, label: pre.result?.ruleInfo[f.ruleCode]?.title ?? f.ruleCode })),
    [sorted, pre.result],
  );

  // Per-card notes belong to one result; a new result starts clean.
  const notes = noteState.owner === analysis ? noteState.map : EMPTY;
  const setNote = (key: number, msg: string) =>
    setNoteState({ owner: analysis, map: { ...(noteState.owner === analysis ? noteState.map : EMPTY), [key]: msg } });

  // A stale result cannot be highlighted against edited text, so fall back to the editor.
  const effectiveView = canHighlight ? view : "edit";

  const emphasize = useCallback((key: number) => {
    setActiveKey(key);
    if (pulse.current) clearTimeout(pulse.current);
    pulse.current = setTimeout(() => setActiveKey(null), 2400);
  }, []);
  useEffect(() => () => void (pulse.current && clearTimeout(pulse.current)), []);

  // Scroll after the view switch has rendered, since the target may not exist yet.
  useEffect(() => {
    if (!pending.current) return;
    const { id } = pending.current;
    pending.current = null;
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  const scrollTo = (id: string) => {
    pending.current = { id };
    setTick((t) => t + 1); // make sure the effect above runs even when nothing else changes
  };

  const showInText = (key: number) => {
    setView("highlight");
    emphasize(key);
    scrollTo(`finding-mark-${key}`);
  };

  const selectFromText = (key: number) => {
    emphasize(key);
    scrollTo(`finding-card-${key}`);
  };

  const apply = (key: number, mode: "replace" | "append") => {
    const f = sorted[key];
    if (!f?.suggestion) return;
    const edit = mode === "replace" ? replaceQuote(text, f.quote, f.suggestion) : appendText(text, f.suggestion);
    if (!edit) {
      setNote(key, "That quoted text is no longer in the editor. Use Append to end or Copy instead.");
      return;
    }
    onTextChange(edit.text);
    setView("edit");
    setNote(
      key,
      mode === "replace" ? "Replaced in the editor. Re-run the pre-check to confirm." : "Added to the end of the text. Re-run the pre-check to confirm.",
    );
  };

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <AssetEditor
        ref={editorRef}
        value={text}
        onChange={onTextChange}
        disabled={disabled}
        error={textError}
        view={effectiveView}
        onViewChange={setView}
        canHighlight={canHighlight}
        highlightHint={
          !analysis ? "Run the pre-check first" : stale ? "Re-run the pre-check to highlight the current text" : "No findings point to a specific spot in the text"
        }
        highlighted={analysis ? <HighlightedText content={analysis.content} findings={labels} activeKey={activeKey} onSelect={selectFromText} /> : null}
        running={running}
        hasResult={Boolean(analysis)}
        canRun={canRun}
        onRun={() => pre.run(text, contextKey)}
        toolbar={toolbar}
      />
      <PrecheckPanel
        pre={pre}
        sorted={sorted}
        stale={stale}
        canRun={canRun}
        activeKey={activeKey}
        notes={notes}
        onRun={() => pre.run(text, contextKey)}
        onReplace={(i) => apply(i, "replace")}
        onAppend={(i) => apply(i, "append")}
        onShow={showInText}
      />
    </div>
  );
}
