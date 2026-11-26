import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { fetchRun } from "@/lib/client/hooks";
import { useRunPolling } from "@/lib/client/use-run-polling";
import type { EncodeRun } from "@/lib/types";

vi.mock("@/lib/client/hooks", () => ({
  fetchRun: vi.fn(),
}));

function makeRun(overrides: Partial<EncodeRun> = {}): EncodeRun {
  return {
    id: "run_1",
    jobId: "job_1",
    stage: "DOWNLOADING",
    progressPct: 35,
    message: "Downloading source video...",
    ...overrides,
  };
}

describe("useRunPolling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does nothing when runId is null", () => {
    renderHook(() => useRunPolling(null));

    expect(fetchRun).not.toHaveBeenCalled();
  });

  it("fetches the run immediately when given a runId", async () => {
    vi.mocked(fetchRun).mockResolvedValueOnce(makeRun());

    const { result } = renderHook(() => useRunPolling("run_1"));

    expect(fetchRun).toHaveBeenCalledTimes(1);
    expect(fetchRun).toHaveBeenCalledWith("run_1");

    await act(async () => {});

    expect(result.current.run?.stage).toBe("DOWNLOADING");
    expect(result.current.run?.progressPct).toBe(35);
  });

  it("polls again after one second", async () => {
    vi.mocked(fetchRun).mockResolvedValue(makeRun());

    renderHook(() => useRunPolling("run_1"));

    await act(async () => {});

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(fetchRun).toHaveBeenCalledTimes(2);
  });

  it("does not start another poll while a request is in flight", async () => {
    vi.mocked(fetchRun).mockResolvedValueOnce(makeRun());

    let resolvePollingRequest!: (run: EncodeRun) => void;

    const pendingPollingRequest = new Promise<EncodeRun>((resolve) => {
      resolvePollingRequest = resolve;
    });

    vi.mocked(fetchRun).mockReturnValueOnce(pendingPollingRequest);

    const { unmount } = renderHook(() => useRunPolling("run_1"));

    // Initial fetch resolves
    await act(async () => {});

    expect(fetchRun).toHaveBeenCalledTimes(1);

    // Advance by 1 second. The first polling request starts and stays pending.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(fetchRun).toHaveBeenCalledTimes(2);

    // Advance 3 more seconds while the polling request is still pending.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    // No overlapping requests should have been started.
    expect(fetchRun).toHaveBeenCalledTimes(2);

    // Resolve the pending request so it doesn't remain hanging.
    await act(async () => {
      resolvePollingRequest(makeRun());
      await pendingPollingRequest;
    });

    unmount();
  });

  it("updates the run and appends new messages to the log without consecutive duplicates", async () => {
    vi.mocked(fetchRun)
      .mockResolvedValueOnce(
        makeRun({ message: "Downloading source video..." }),
      )
      .mockResolvedValueOnce(
        makeRun({ message: "Downloading source video..." }),
      )
      .mockResolvedValueOnce(
        makeRun({
          stage: "TRANSCODING",
          progressPct: 60,
          message: "Transcoding video...",
        }),
      );

    const { result } = renderHook(() => useRunPolling("run_1"));

    await act(async () => {});

    expect(result.current.log).toEqual(["Downloading source video..."]);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(result.current.log).toEqual(["Downloading source video..."]);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(result.current.run?.stage).toBe("TRANSCODING");
    expect(result.current.run?.progressPct).toBe(60);
    expect(result.current.log).toEqual([
      "Downloading source video...",
      "Transcoding video...",
    ]);
  });

  it("stops polling when the run completes", async () => {
    const onFinished = vi.fn();

    vi.mocked(fetchRun).mockResolvedValue(
      makeRun({
        stage: "COMPLETED",
        progressPct: 100,
        message: "Encoding complete!",
      }),
    );

    const { result } = renderHook(() => useRunPolling("run_1", onFinished));

    await act(async () => {});

    expect(result.current.polling).toBe(false);
    expect(onFinished).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(fetchRun).toHaveBeenCalledTimes(1);
  });

  it("stops polling when the run fails", async () => {
    const onFinished = vi.fn();

    vi.mocked(fetchRun).mockResolvedValue(
      makeRun({
        stage: "FAILED",
        progressPct: 50,
        message: "Encoding failed",
        error: "Invalid source video",
      }),
    );

    const { result } = renderHook(() => useRunPolling("run_1", onFinished));

    await act(async () => {});

    expect(result.current.run?.stage).toBe("FAILED");
    expect(result.current.polling).toBe(false);
    expect(onFinished).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(fetchRun).toHaveBeenCalledTimes(1);
  });

  it("stores a fetch error when the request fails", async () => {
    vi.mocked(fetchRun).mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useRunPolling("run_1"));

    await act(async () => {});

    expect(result.current.fetchError).toBe("Network error");
  });

  it("cleans up polling when the hook unmounts", async () => {
    vi.mocked(fetchRun).mockResolvedValue(makeRun());

    const { unmount } = renderHook(() => useRunPolling("run_1"));

    await act(async () => {});

    expect(fetchRun).toHaveBeenCalledTimes(1);

    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(fetchRun).toHaveBeenCalledTimes(1);
  });

  it("stops polling the old run when runId changes", async () => {
    vi.mocked(fetchRun).mockResolvedValue(makeRun());

    const { rerender } = renderHook(({ runId }) => useRunPolling(runId), {
      initialProps: { runId: "run_1" as string | null },
    });

    await act(async () => {});

    rerender({ runId: "run_2" });

    await act(async () => {});

    expect(fetchRun).toHaveBeenCalledWith("run_2");

    const callsBeforeTimer = vi.mocked(fetchRun).mock.calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    const callsAfterTimer = vi.mocked(fetchRun).mock.calls.length;

    expect(callsAfterTimer).toBe(callsBeforeTimer + 1);
    expect(vi.mocked(fetchRun).mock.calls.at(-1)?.[0]).toBe("run_2");
  });

  it("ignores an in-flight request after unmount", async () => {
    const onFinished = vi.fn();

    let resolveRequest!: (run: EncodeRun) => void;

    const pendingRequest = new Promise<EncodeRun>((resolve) => {
      resolveRequest = resolve;
    });

    vi.mocked(fetchRun).mockReturnValue(pendingRequest);

    const { unmount } = renderHook(() => useRunPolling("run_1", onFinished));

    expect(fetchRun).toHaveBeenCalledTimes(1);

    unmount();

    await act(async () => {
      resolveRequest(
        makeRun({
          stage: "COMPLETED",
          progressPct: 100,
          message: "Finished!",
        }),
      );

      await pendingRequest;
    });

    expect(onFinished).not.toHaveBeenCalled();
  });
});
