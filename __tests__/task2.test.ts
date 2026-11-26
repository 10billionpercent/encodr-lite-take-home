import { beforeEach, describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/jobs/route";
import { issueToken } from "@/lib/server/auth";
import { __resetStore } from "@/lib/server/store";

const token = issueToken("u_demo");

function authenticatedRequest(url: string, options: RequestInit = {}) {
  return new Request(url, {
    ...options,
    headers: {
      authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
}

beforeEach(() => {
  __resetStore();
});

describe("GET /api/jobs", () => {
  it("rejects unauthenticated requests", async () => {
    const request = new Request("http://localhost:3000/api/jobs");

    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it("returns an empty array when there are no jobs", async () => {
    const request = authenticatedRequest("http://localhost:3000/api/jobs");

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });
});

describe("POST /api/jobs", () => {
  it("rejects unauthenticated job creation", async () => {
    const request = new Request("http://localhost:3000/api/jobs", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sourceUrl: "https://cdn.example.com/videos/clip.mp4",
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it("creates a job with valid input", async () => {
    const request = authenticatedRequest("http://localhost:3000/api/jobs", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sourceUrl: "https://cdn.example.com/videos/clip.mp4",
        title: "My video",
      }),
    });

    const response = await POST(request);
    const job = await response.json();

    expect(response.status).toBe(201);
    expect(job.sourceUrl).toBe("https://cdn.example.com/videos/clip.mp4");
    expect(job.title).toBe("My video");
    expect(job.id).toBeDefined();
  });

  it("creates a job without a title", async () => {
    const request = authenticatedRequest("http://localhost:3000/api/jobs", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sourceUrl: "https://cdn.example.com/videos/clip.mp4",
      }),
    });

    const response = await POST(request);
    const job = await response.json();

    expect(response.status).toBe(201);
    expect(job.sourceUrl).toBe("https://cdn.example.com/videos/clip.mp4");
    expect(job.title).toBe("clip.mp4");
  });

  it("returns validation errors for a missing source URL", async () => {
    const request = authenticatedRequest("http://localhost:3000/api/jobs", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        title: "My video",
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.detail).toBe("Validation failed");
    expect(body.fieldErrors.sourceUrl).toBeDefined();
  });

  it("returns validation errors for an invalid source URL", async () => {
    const request = authenticatedRequest("http://localhost:3000/api/jobs", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sourceUrl: "not a url",
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.detail).toBe("Validation failed");
    expect(body.fieldErrors.sourceUrl).toBeDefined();
  });
});
