import { beforeEach, describe, expect, it } from "vitest";
import {
  computeRun,
  FAIL_URL,
  __resetStore,
  type RunRecord,
} from "@/lib/server/store";

describe("computeRun", () => {
  const startTime = 100_000;

  const createRecord = (
    sourceUrl = "https://cdn.example.com/videos/clip.mp4",
  ): RunRecord => ({
    id: "r_test",
    jobId: "j_test",
    sourceUrl,
    startedAt: startTime,
  });

  beforeEach(() => {
    __resetStore();
  });

  it("returns QUEUED at 0ms", () => {
    const record = createRecord();

    const run = computeRun(record, startTime);

    expect(run.stage).toBe("QUEUED");
    expect(run.progressPct).toBe(0);
    expect(run.result).toBeUndefined();
    expect(run.error).toBeUndefined();
  });

  it("returns DOWNLOADING at 2000ms", () => {
    const record = createRecord();

    const run = computeRun(record, startTime + 2_000);

    expect(run.stage).toBe("DOWNLOADING");
    expect(run.progressPct).toBeGreaterThan(0);
    expect(run.result).toBeUndefined();
    expect(run.error).toBeUndefined();
  });

  it("returns TRANSCODING at 6000ms", () => {
    const record = createRecord();

    const run = computeRun(record, startTime + 6_000);

    expect(run.stage).toBe("TRANSCODING");
    expect(run.progressPct).toBeGreaterThan(0);
    expect(run.result).toBeUndefined();
    expect(run.error).toBeUndefined();
  });

  it("returns COMPLETED with a result at 12000ms", () => {
    const record = createRecord();

    const run = computeRun(record, startTime + 12_000);

    expect(run.stage).toBe("COMPLETED");
    expect(run.progressPct).toBe(100);
    expect(run.result).toBeDefined();
    expect(run.result?.renditions).toHaveLength(3);
    expect(run.error).toBeUndefined();
  });

  it("returns FAILED with an error for the corrupt source at 8000ms", () => {
    const record = createRecord(FAIL_URL);

    const run = computeRun(record, startTime + 8_000);

    expect(run.stage).toBe("FAILED");
    expect(run.error).toBeTruthy();
    expect(run.result).toBeUndefined();
    expect(run.progressPct).toBeLessThan(100);
  });

  it("stays FAILED after the completion time for a corrupt source", () => {
    const record = createRecord(FAIL_URL);

    const run = computeRun(record, startTime + 15_000);

    expect(run.stage).toBe("FAILED");
    expect(run.error).toBeTruthy();
    expect(run.result).toBeUndefined();
  });

  it("freezes progress when a corrupt source fails", () => {
    const record = createRecord(FAIL_URL);

    const failedAt8s = computeRun(record, startTime + 8_000);
    const failedAt10s = computeRun(record, startTime + 10_000);

    expect(failedAt10s.stage).toBe("FAILED");
    expect(failedAt10s.progressPct).toBe(failedAt8s.progressPct);
  });

  it("caps progress at 100% after completion", () => {
    const record = createRecord();

    const run = computeRun(record, startTime + 15_000);

    expect(run.stage).toBe("COMPLETED");
    expect(run.progressPct).toBe(100);
    expect(run.result).toBeDefined();
  });

  it("returns QUEUED with 0% progress before the run starts", () => {
    const record = createRecord();

    const run = computeRun(record, startTime - 10_000);

    expect(run.stage).toBe("QUEUED");
    expect(run.progressPct).toBe(0);
    expect(run.result).toBeUndefined();
    expect(run.error).toBeUndefined();
  });
});
