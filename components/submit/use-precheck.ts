"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ActionResult } from "@/lib/workflow/action-helpers";
import type { PrecheckResult } from "@/lib/workflow/types";

export type PrecheckRunner = (content: string) => Promise<ActionResult<PrecheckResult>>;

/** Honest description of what the server does, advanced on a timer while the call is in flight. */
export const STAGES = [
  "Matching your asset to the rules that apply...",
  "Reading it the way a reviewer would...",
  "Checking every quote against your text...",
] as const;
const STAGE_MS = 3200;

export interface PrecheckState {
  phase: "idle" | "running" | "done" | "error";
  result: PrecheckResult | null;
  /** The exact text that was sent for the current result. */
  checkedText: string | null;
  /** Product, channel and states the result was produced for. */
  checkedKey: string | null;
  error: string | null;
  stage: number;
}

const INITIAL: PrecheckState = { phase: "idle", result: null, checkedText: null, checkedKey: null, error: null, stage: 0 };

export function usePrecheck(runner: PrecheckRunner) {
  const [state, setState] = useState<PrecheckState>(INITIAL);
  const runId = useRef(0);
  const runnerRef = useRef(runner);
  useEffect(() => {
    runnerRef.current = runner;
  }, [runner]);

  const running = state.phase === "running";
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setState((s) => (s.phase === "running" && s.stage < STAGES.length - 1 ? { ...s, stage: s.stage + 1 } : s)), STAGE_MS);
    return () => clearInterval(t);
  }, [running]);

  const run = useCallback(async (text: string, key = "") => {
    const id = ++runId.current;
    // A previous result stays visible (and marked stale) while a re-run is in flight.
    setState((s) => ({ ...s, phase: "running", error: null, stage: 0 }));
    let res: ActionResult<PrecheckResult>;
    try {
      res = await runnerRef.current(text);
    } catch {
      res = { ok: false, error: "The pre-check could not be reached. Check your connection and try again." };
    }
    if (id !== runId.current) return;
    setState((s) =>
      res.ok
        ? { phase: "done", result: res.data, checkedText: text, checkedKey: key, error: null, stage: 0 }
        : { ...s, phase: "error", error: res.error, stage: 0 },
    );
  }, []);

  const reset = useCallback(() => {
    runId.current++;
    setState(INITIAL);
  }, []);

  return { ...state, run, reset };
}

export type PrecheckHandle = ReturnType<typeof usePrecheck>;

/** True when the text (or the asset context) changed after the result on screen was produced. */
export function isStale(pre: Pick<PrecheckState, "checkedText" | "checkedKey">, text: string, key = ""): boolean {
  return pre.checkedText !== null && (pre.checkedText !== text || pre.checkedKey !== key);
}
