"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useJob, useStartRun } from "@/lib/client/hooks";
import { StatusBadge } from "@/components/status-badge";
import { useRunPolling } from "@/lib/client/use-run-polling";
import { ProgressBar } from "@/components/progress-bar";

// The header (title, source URL, status badge, loading and not-found states) is provided.
//
// ---------------------------------------------------------------------------
// TASK 5 — TODO(candidate): build the run panel where the placeholder is.
// ---------------------------------------------------------------------------
//
// This is the most substantial screen in the exercise. Build it in this order:
//
//   1. A "Start encode" button that calls the provided useStartRun(job.id) mutation and keeps
//      the returned `runId` in state. Disable it while a run is in flight.
//
//   2. Live progress, driven by your useRunPolling(runId) hook:
//        - the current stage (<StatusBadge value={run.stage} />),
//        - a percentage bar (<ProgressBar value={run.progressPct} />),
//        - the log — the messages collected so far, newest last.
//      A run takes about 12 seconds, so you'll see the whole thing without waiting long.
//
//   3. The FAILED case. Create a job with the source URL
//        https://cdn.example.com/videos/corrupt.mp4
//      and it will fail partway. Show the error message clearly (a red panel, `failed` on the
//      progress bar) and offer a Retry that starts a fresh run.
//
//   4. The COMPLETED case. `run.result` arrives with the final poll: show the duration and a
//      small table of renditions (label / resolution / size). Plain and readable beats fancy.
//
// A note on state: at any moment this screen is in exactly one of — idle, running, failed,
// completed. Try to make that explicit in how you write it, rather than juggling several
// booleans that could contradict each other (`isRunning && isFailed` should be impossible to
// express, not merely unlikely). Say what you chose in the README.
//
// We are NOT grading visual design. Correct behaviour and readable code are what count.

type RunPanelState = "idle" | "running" | "failed" | "completed";

export default function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const jobQuery = useJob(id);
  const [runId, setRunId] = useState<string | null>(null);

  const startRun = useStartRun(id);
  const activeRunId = runId ?? jobQuery.data?.latestRunId ?? null;
  const polling = useRunPolling(activeRunId, () => jobQuery.refetch());

  const panelState: RunPanelState =
    polling.run?.error || polling.run?.stage === "FAILED"
      ? "failed"
      : polling.run?.stage === "COMPLETED"
        ? "completed"
        : startRun.isPending || polling.polling || polling.run !== null
          ? "running"
          : "idle";

  const handleStartRun = async () => {
    try {
      const res = await startRun.mutateAsync();
      setRunId(res.runId);
    } catch (e) {
      console.error(e);
    }
  };

  if (jobQuery.isLoading) {
    return <p className="text-sm text-neutral-500">Loading job…</p>;
  }

  if (jobQuery.isError || !jobQuery.data) {
    return (
      <div className="text-sm text-red-600">
        Job not found.{" "}
        <Link href="/jobs" className="underline">
          Back to jobs
        </Link>
      </div>
    );
  }

  const job = jobQuery.data;

  return (
    <div className="space-y-6">
      <Link href="/jobs" className="text-sm text-neutral-500 hover:underline">
        ← All jobs
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold">{job.title}</h1>
          <p className="truncate text-sm text-neutral-500">{job.sourceUrl}</p>
        </div>
        <StatusBadge value={job.status} />
      </div>
      {panelState === "failed" && (
        <p className="rounded-md border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-500 shadow-[0_0_12px_rgba(239,68,68,0.32)]">
          {polling.run?.error}
        </p>
      )}
      <button
        onClick={handleStartRun}
        disabled={
          startRun.isPending ||
          panelState === "running" ||
          (activeRunId !== null && polling.run === null)
        }
        className="w-[352px] rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {panelState === "failed"
          ? "Retry encoding"
          : panelState === "running"
            ? "Encoding..."
            : "Start encoding"}
      </button>

      <div className="flex items-center gap-4">
        {activeRunId && (
          <div className="w-full">
            {polling.run ? (
              <>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-neutral-500">
                        PROGRESS
                      </p>
                      <h1 className="truncate text-xl font-semibold mb-2">
                        {Number((polling.run?.progressPct ?? 0).toFixed(2))}%
                      </h1>
                    </div>

                    <StatusBadge value={polling.run?.stage ?? "QUEUED"} />
                  </div>
                  <ProgressBar value={polling.run?.progressPct ?? 0} />
                  {panelState === "completed" && (
                    <p className="text-md text-neutral-500 mt-2">
                      Completed in {polling.run.result?.durationSec} seconds
                    </p>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-col items-start gap-4">
                    <div className="w-full min-w-0">
                      {polling.log && polling.log.length > 0 && (
                        <>
                          <p className="truncate text-sm text-neutral-500 mt-4 mb-4">
                            LOGS
                          </p>

                          <ul className="w-full divide-y divide-neutral-200 rounded-md border border-neutral-200">
                            {polling.log.map((log) => (
                              <li
                                key={log}
                                className="px-4 py-3 hover:bg-neutral-900"
                              >
                                <p className="text-sm">{log}</p>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}

                      {polling.run.result?.renditions &&
                        polling.run.result.renditions.length > 0 && (
                          <>
                            <p className="truncate text-sm text-neutral-500 mt-6 mb-4">
                              RENDITIONS
                            </p>

                            <ul className="w-full divide-y divide-neutral-200 rounded-md border border-neutral-200">
                              {polling.run.result.renditions.map((r) => (
                                <li
                                  key={r.label}
                                  className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-neutral-900"
                                >
                                  <div className="min-w-0">
                                    <p className="font-medium">
                                      {r.label} ( {r.width} × {r.height})
                                    </p>
                                  </div>

                                  <p className="shrink-0 text-sm text-neutral-500">
                                    {r.sizeMb} MB
                                  </p>
                                </li>
                              ))}
                            </ul>
                          </>
                        )}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-neutral-500">Loading run…</p>
            )}{" "}
          </div>
        )}
      </div>
    </div>
  );
}
