"use client";

import { useEffect, useState } from "react";
import type { EncodeRun } from "@/lib/types";
import { fetchRun } from "./hooks";
import { isTerminalStage } from "@/lib/types";

export interface RunPollingState {
  /** The latest run state we've received, or null before the first response. */
  run: EncodeRun | null;
  /** True while we're still asking the server for updates. */
  polling: boolean;
  /** A request failed (network, 404, …). Not the same thing as the RUN failing. */
  fetchError: string | null;
  /** Every message we've seen, oldest first — the log the UI renders. */
  log: string[];
}

const initialState: RunPollingState = {
  run: null,
  polling: false,
  fetchError: null,
  log: [],
};

/**
 * TASK 5 — TODO(candidate): poll a run until it finishes.
 *
 * The server does not push anything to us. To show live progress, we ask "what's the state of
 * this run?" roughly once a second, until the run reaches a terminal stage (COMPLETED or FAILED).
 *
 * What this hook must do:
 *   1. When `runId` is null, do nothing at all.
 *   2. When `runId` is set, fetch the run immediately, then keep fetching about once a second.
 *   3. Track the latest run in state, and append each new `message` to `log`
 *      (don't append the same message twice in a row — the same stage repeats across polls).
 *   4. STOP polling once `isTerminalStage(run.stage)` is true, and call `onFinished?.()` so the
 *      page can refresh the job's status.
 *   5. CLEAN UP: when the component unmounts, or when `runId` changes, stop the timer and don't
 *      write to state any more.
 *
 * Point 5 is the one that separates a working version from a correct one, so here's the shape of
 * the answer. A useEffect can return a cleanup function, which React calls before the next run of
 * the effect and when the component unmounts:
 *
 *     useEffect(() => {
 *       let cancelled = false;                    // ← the guard
 *       const id = setInterval(() => {
 *         if (cancelled) return;
 *         // ...do the work
 *       }, 1000);
 *
 *       return () => {                            // ← the cleanup
 *         cancelled = true;
 *         clearInterval(id);
 *       };
 *     }, [runId]);
 *
 * Two separate problems are being solved there, and you need both:
 *   - `clearInterval` stops future ticks. Without it, navigating away leaves a timer hammering
 *     the API forever, and mounting the page a few times gives you several timers at once.
 *   - `cancelled` handles the request that's ALREADY in flight. A fetch started just before
 *     unmount will still resolve afterwards; calling setState at that point updates a component
 *     that no longer exists. Check the flag after every `await` before touching state.
 *
 * To see whether you got it right: add a `console.log` on each poll, start a run, then navigate
 * back to the jobs list before it finishes. The logs should stop. If they don't, the cleanup
 * isn't working — and this is exactly the bug we'll ask you about in the interview.
 */

const appendMessage = (log: string[], msg: string) => {
  if (log[log.length - 1] === msg) return log;
  return [...log, msg];
};

const getErrorMessage = (e: unknown) => {
  return e instanceof Error ? e.message : "Something went wrong";
};

export function useRunPolling(
  runId: string | null,
  onFinished?: () => void,
): RunPollingState {
  const [state, setState] = useState<RunPollingState>(initialState);

  useEffect(() => {
    if (!runId) return;
    // TODO(candidate): start polling here, and return a cleanup function.
    let cancelled = false;
    let polling = true;
    let fetching = false; // extra variable to ensure a request is not fired while another is in flight
    let pollingInterval: ReturnType<typeof setInterval>;

    const fetchInitialRunAndSetupTimer = async () => {
      if (cancelled) return;
      setState(initialState);

      try {
        const initialRun: EncodeRun = await fetchRun(runId);
        if (cancelled) return;

        const isRunFinished = isTerminalStage(initialRun.stage);
        polling = !isRunFinished;

        setState({
          run: initialRun,
          polling: polling,
          fetchError: null,
          log: [initialRun.message],
        });
        if (isRunFinished) onFinished?.();
      } catch (e) {
        polling = false;
        if (cancelled) return;

        setState((prev) => ({
          ...prev,
          polling: polling,
          fetchError: getErrorMessage(e),
        }));
      }

      if (!polling) return;

      pollingInterval = setInterval(async () => {
        if (cancelled || !polling || fetching) return;

        try {
          fetching = true;
          const run: EncodeRun = await fetchRun(runId);

          const isRunFinished = isTerminalStage(run.stage);
          polling = !isRunFinished;

          if (cancelled) return;
          setState((prev) => ({
            run: run,
            polling: polling,
            fetchError: null,
            log: appendMessage(prev.log, run.message),
          }));
          if (isRunFinished) onFinished?.();

          if (!polling) {
            clearInterval(pollingInterval);
            return;
          }
        } catch (e) {
          polling = false;
          clearInterval(pollingInterval);

          if (cancelled) return;

          setState((prev) => ({
            ...prev,
            polling: polling,
            fetchError: getErrorMessage(e),
          }));
        } finally {
          fetching = false;
        }
      }, 1000);
    };
    fetchInitialRunAndSetupTimer();

    return () => {
      cancelled = true;
      polling = false;
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [runId]);

  return state;
}
