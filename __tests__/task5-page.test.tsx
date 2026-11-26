import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Suspense } from "react";
import JobDetailPage from "@/app/(app)/jobs/[id]/page";

const mocks = vi.hoisted(() => ({
  useJob: vi.fn(),
  useStartRun: vi.fn(),
  useRunPolling: vi.fn(),
  refetch: vi.fn(),
  mutateAsync: vi.fn(),
}));

vi.mock("@/lib/client/hooks", () => ({
  useJob: mocks.useJob,
  useStartRun: mocks.useStartRun,
}));

vi.mock("@/lib/client/use-run-polling", () => ({
  useRunPolling: mocks.useRunPolling,
}));

vi.mock("@/components/status-badge", () => ({
  StatusBadge: ({ value }: { value: string }) => (
    <span data-testid="status-badge">{value}</span>
  ),
}));

vi.mock("@/components/progress-bar", () => ({
  ProgressBar: ({ value }: { value: number }) => (
    <div data-testid="progress-bar" data-value={value} />
  ),
}));

const job = {
  id: "job-1",
  title: "Test video",
  sourceUrl: "https://cdn.example.com/videos/clip.mp4",
  status: "NEW",
  createdAt: "2026-01-01T00:00:00.000Z",
};

const runningRun = {
  id: "run-1",
  jobId: "job-1",
  stage: "TRANSCODING",
  progressPct: 65,
  message: "Transcoding video",
};

const failedRun = {
  ...runningRun,
  stage: "FAILED",
  progressPct: 66,
  message: "Encoding failed",
  error: "The source video is corrupt",
};

const completedRun = {
  ...runningRun,
  stage: "COMPLETED",
  progressPct: 100,
  message: "Encoding completed",
  result: {
    durationSec: 12,
    renditions: [
      { label: "1080p", width: 1920, height: 1080, sizeMb: 12.5 },
      { label: "720p", width: 1280, height: 720, sizeMb: 7.2 },
    ],
  },
};

// Create an already-fulfilled Promise for React's use(params).
function createResolvedParams(): Promise<{ id: string }> {
  const value = { id: "job-1" };

  return Object.assign(Promise.resolve(value), {
    status: "fulfilled" as const,
    value,
  });
}

async function renderPage() {
  render(
    <Suspense fallback={null}>
      <JobDetailPage params={createResolvedParams()} />
    </Suspense>,
  );
}

function setup({
  jobData = job,
  jobLoading = false,
  jobError = false,
  run = null,
  polling = false,
  log = [],
  mutationPending = false,
  latestRunId,
}: {
  jobData?: typeof job | null;
  jobLoading?: boolean;
  jobError?: boolean;
  run?: any;
  polling?: boolean;
  log?: string[];
  mutationPending?: boolean;
  latestRunId?: string;
} = {}) {
  const resolvedLatestRunId = latestRunId ?? run?.id;

  mocks.useJob.mockReturnValue({
    data: jobData
      ? { ...jobData, latestRunId: resolvedLatestRunId }
      : undefined,
    isLoading: jobLoading,
    isError: jobError,
    refetch: mocks.refetch,
  });

  mocks.useStartRun.mockReturnValue({
    isPending: mutationPending,
    mutateAsync: mocks.mutateAsync,
  });

  mocks.useRunPolling.mockReturnValue({
    run,
    polling,
    log,
    fetchError: null,
  });
}

beforeEach(() => {
  vi.clearAllMocks();

  mocks.mutateAsync.mockResolvedValue({ runId: "run-2" });

  setup();
});

describe("JobDetailPage", () => {
  // Loading and error states

  it("shows loading state while job is loading", async () => {
    setup({ jobLoading: true });
    await renderPage();

    expect(screen.getByText("Loading job…")).toBeInTheDocument();
  });

  it("shows not-found when job query fails", async () => {
    setup({ jobError: true });
    await renderPage();

    expect(screen.getByText("Job not found.")).toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: /back to jobs/i }),
    ).toHaveAttribute("href", "/jobs");
  });

  it("shows not-found when job data is missing", async () => {
    setup({ jobData: null });
    await renderPage();

    expect(screen.getByText("Job not found.")).toBeInTheDocument();
  });

  // Job details

  it("renders job title, source URL and status", async () => {
    await renderPage();

    expect(screen.getByText("Test video")).toBeInTheDocument();

    expect(
      screen.getByText("https://cdn.example.com/videos/clip.mp4"),
    ).toBeInTheDocument();

    expect(screen.getByText("NEW")).toBeInTheDocument();
  });

  // Idle state

  it("shows Start encoding in idle state", async () => {
    await renderPage();

    expect(
      screen.getByRole("button", { name: "Start encoding" }),
    ).toBeEnabled();
  });

  // Starting a run

  it("starts encoding when button is clicked", async () => {
    await renderPage();

    fireEvent.click(
      screen.getByRole("button", { name: "Start encoding" }),
    );

    await waitFor(() => {
      expect(mocks.mutateAsync).toHaveBeenCalledOnce();
    });

    await waitFor(() => {
      expect(mocks.useRunPolling).toHaveBeenLastCalledWith(
        "run-2",
        expect.any(Function),
      );
    });
  });

  it("disables the button while mutation is pending", async () => {
    setup({ mutationPending: true });
    await renderPage();

    expect(
      screen.getByRole("button", { name: "Encoding..." }),
    ).toBeDisabled();
  });

  // Restoring a previous run

  it("restores the latest run when revisiting the job", async () => {
    setup({
      latestRunId: "previous-run",
      run: runningRun,
      polling: true,
    });

    await renderPage();

    expect(mocks.useRunPolling).toHaveBeenCalledWith(
      "previous-run",
      expect.any(Function),
    );

    expect(screen.getByTestId("progress-bar")).toHaveAttribute(
      "data-value",
      "65",
    );
  });

  it("disables Start encoding while an existing run is loading", async () => {
    setup({
      latestRunId: "previous-run",
      run: null,
      polling: false,
    });

    await renderPage();

    expect(
      screen.getByRole("button", { name: "Start encoding" }),
    ).toBeDisabled();
  });

  // Running state

  it("shows stage, percentage and disables button while running", async () => {
    setup({
      run: runningRun,
      polling: true,
    });

    await renderPage();

    expect(screen.getByText("TRANSCODING")).toBeInTheDocument();

    expect(screen.getByTestId("progress-bar")).toHaveAttribute(
      "data-value",
      "65",
    );

    expect(screen.getByText("65%")).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: "Encoding..." }),
    ).toBeDisabled();
  });

  it("renders logs in the correct order", async () => {
    setup({
      run: runningRun,
      polling: true,
      log: ["Queued", "Downloading", "Transcoding video"],
    });

    await renderPage();

    const logItems = screen
      .getAllByRole("list")[0]
      .querySelectorAll("li");

    expect(logItems).toHaveLength(3);
    expect(logItems[0]).toHaveTextContent("Queued");
    expect(logItems[1]).toHaveTextContent("Downloading");
    expect(logItems[2]).toHaveTextContent("Transcoding video");
  });

  // Failed state

  it("shows error panel, FAILED status and Retry button", async () => {
    setup({ run: failedRun });
    await renderPage();

    expect(
      screen.getByText("The source video is corrupt"),
    ).toBeInTheDocument();

    expect(screen.getByText("FAILED")).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: "Retry encoding" }),
    ).toBeEnabled();
  });

  it("starts a new run when Retry is clicked", async () => {
    setup({ run: failedRun });
    await renderPage();

    fireEvent.click(
      screen.getByRole("button", { name: "Retry encoding" }),
    );

    await waitFor(() => {
      expect(mocks.mutateAsync).toHaveBeenCalledOnce();
    });

    await waitFor(() => {
      expect(mocks.useRunPolling).toHaveBeenLastCalledWith(
        "run-2",
        expect.any(Function),
      );
    });
  });

  // Completed state

  it("shows completion duration and 100% progress", async () => {
    setup({ run: completedRun });
    await renderPage();

    expect(
      screen.getByText("Completed in 12 seconds"),
    ).toBeInTheDocument();

    expect(screen.getByTestId("progress-bar")).toHaveAttribute(
      "data-value",
      "100",
    );

    expect(screen.getByText("COMPLETED")).toBeInTheDocument();
  });

  it("renders all completed renditions", async () => {
    setup({ run: completedRun });
    await renderPage();

    expect(screen.getByText(/1080p/)).toBeInTheDocument();
    expect(screen.getByText(/1920 × 1080/)).toBeInTheDocument();
    expect(screen.getByText("12.5 MB")).toBeInTheDocument();

    expect(screen.getByText(/720p/)).toBeInTheDocument();
    expect(screen.getByText(/1280 × 720/)).toBeInTheDocument();
    expect(screen.getByText("7.2 MB")).toBeInTheDocument();
  });

  it("does not render the renditions section when there are no renditions", async () => {
    setup({
      run: {
        ...completedRun,
        result: {
          durationSec: 12,
          renditions: [],
        },
      },
    });

    await renderPage();

    expect(screen.queryByText("RENDITIONS")).not.toBeInTheDocument();
  });

  // Callback

  it("refetches the job when the run finishes", async () => {
    setup({ run: completedRun });
    await renderPage();

    const lastCall = mocks.useRunPolling.mock.calls.at(-1);

    expect(lastCall).toBeDefined();

    const onFinished = lastCall![1];

    expect(onFinished).toEqual(expect.any(Function));

    onFinished();

    expect(mocks.refetch).toHaveBeenCalledOnce();
  });
});