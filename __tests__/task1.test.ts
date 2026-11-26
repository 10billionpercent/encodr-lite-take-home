import { describe, expect, it } from "vitest";
import { sourceUrlSchema } from "@/lib/schemas";

describe("sourceUrlSchema", () => {
  it("accepts a valid HTTPS media URL", () => {
    expect(
      sourceUrlSchema.safeParse("https://cdn.example.com/videos/clip.mp4")
        .success,
    ).toBe(true);
  });

  it("rejects an empty URL", () => {
    const result = sourceUrlSchema.safeParse("");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Source URL is required");
    }
  });

  it("rejects an invalid URL", () => {
    const result = sourceUrlSchema.safeParse("not a url");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Enter a valid URL");
    }
  });

  it("rejects unsupported protocols", () => {
    const result = sourceUrlSchema.safeParse("ftp://cdn.example.com/clip.mp4");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("URL must use HTTP or HTTPS");
    }
  });

  it("rejects URLs without a file path", () => {
    const result = sourceUrlSchema.safeParse("https://cdn.example.com");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "URL must include a file path",
      );
    }
  });
});
