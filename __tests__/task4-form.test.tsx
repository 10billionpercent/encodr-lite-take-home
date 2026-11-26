import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CreateJobForm from "@/components/create-job-form";
import { ApiError } from "@/lib/client/api";

const mockMutateAsync = vi.fn();

vi.mock("@/lib/client/hooks", () => ({
  useCreateJob: () => ({
    mutateAsync: mockMutateAsync,
  }),
}));

describe("CreateJobForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the source URL and title fields", () => {
    render(<CreateJobForm />);

    expect(screen.getByLabelText("Source URL")).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create job" }),
    ).toBeInTheDocument();
  });

  it("shows a validation error for an invalid source URL", async () => {
    const user = userEvent.setup();

    render(<CreateJobForm />);

    const sourceUrl = screen.getByLabelText("Source URL");

    await user.clear(sourceUrl);
    await user.type(sourceUrl, "not a URL");
    await user.click(screen.getByRole("button", { name: "Create job" }));

    expect(await screen.findByText("Enter a valid URL")).toBeInTheDocument();
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it("submits the values when the form is valid", async () => {
    const user = userEvent.setup();

    mockMutateAsync.mockResolvedValueOnce({});

    render(<CreateJobForm />);

    await user.clear(screen.getByLabelText("Source URL"));
    await user.type(
      screen.getByLabelText("Source URL"),
      "https://cdn.example.com/videos/my-video.mp4",
    );

    await user.type(screen.getByLabelText("Title"), "My video");

    await user.click(screen.getByRole("button", { name: "Create job" }));

    await vi.waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        sourceUrl: "https://cdn.example.com/videos/my-video.mp4",
        title: "My video",
      });
    });
  });

  it("resets the form after successful creation", async () => {
    const user = userEvent.setup();

    mockMutateAsync.mockResolvedValueOnce({});

    render(<CreateJobForm />);

    await user.clear(screen.getByLabelText("Source URL"));
    await user.type(
      screen.getByLabelText("Source URL"),
      "https://cdn.example.com/videos/my-video.mp4",
    );

    await user.type(screen.getByLabelText("Title"), "My video");

    await user.click(screen.getByRole("button", { name: "Create job" }));

    await vi.waitFor(() => {
      expect(screen.getByLabelText("Title")).toHaveValue("");
      expect(screen.getByLabelText("Source URL")).toHaveValue("");
    });
  });

  it("shows a generic error when job creation fails", async () => {
    const user = userEvent.setup();

    mockMutateAsync.mockRejectedValueOnce(new Error("Server is unavailable"));

    render(<CreateJobForm />);

    await user.type(
      screen.getByLabelText("Source URL"),
      "https://cdn.example.com/videos/my-video.mp4",
    );

    await user.click(screen.getByRole("button", { name: "Create job" }));

    expect(
      await screen.findByText("Server is unavailable"),
    ).toBeInTheDocument();
  });

  it("shows a server validation error under the source URL field", async () => {
    const user = userEvent.setup();

    mockMutateAsync.mockRejectedValueOnce(
      new ApiError(422, "Validation failed", {
        sourceUrl: ["URL must include a file path"],
      }),
    );

    render(<CreateJobForm />);

    await user.type(
      screen.getByLabelText("Source URL"),
      "https://cdn.example.com/videos/my-video.mp4",
    );

    await user.click(screen.getByRole("button", { name: "Create job" }));

    expect(
      await screen.findByText("URL must include a file path"),
    ).toBeInTheDocument();
  });
});
