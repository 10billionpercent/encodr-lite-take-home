
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { api } from "@/lib/client/api";
import { useCreateJob, jobKeys } from "@/lib/client/hooks";
import type { Job } from "@/lib/types";
import { createElement } from "react";

vi.mock("@/lib/client/api", () => ({
  api: {
    post: vi.fn(),
  },
}));

describe("useCreateJob", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();

    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  it("POSTs the form values to /api/jobs", async () => {
    const createdJob: Job = {
      id: "j_test",
      title: "My video",
      sourceUrl: "https://cdn.example.com/videos/clip.mp4",
      status: "NEW",
      createdAt: new Date().toISOString(),
    };

    vi.mocked(api.post).mockResolvedValue(createdJob);

    const { result } = renderHook(() => useCreateJob(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        sourceUrl: "https://cdn.example.com/videos/clip.mp4",
        title: "My video",
      });
    });

    expect(api.post).toHaveBeenCalledWith("/api/jobs", {
      sourceUrl: "https://cdn.example.com/videos/clip.mp4",
      title: "My video",
    });
  });

  it("invalidates the jobs query after successfully creating a job", async () => {
    const createdJob: Job = {
      id: "j_test",
      title: "My video",
      sourceUrl: "https://cdn.example.com/videos/clip.mp4",
      status: "NEW",
      createdAt: new Date().toISOString(),
    };

    vi.mocked(api.post).mockResolvedValue(createdJob);

    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateJob(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        sourceUrl: "https://cdn.example.com/videos/clip.mp4",
        title: "My video",
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: jobKeys.all,
    });
  });

  it("does not invalidate jobs when creation fails", async () => {
    vi.mocked(api.post).mockRejectedValue(new Error("Server error"));

    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateJob(), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          sourceUrl: "https://cdn.example.com/videos/clip.mp4",
          title: "My video",
        }),
      ).rejects.toThrow("Server error");
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
