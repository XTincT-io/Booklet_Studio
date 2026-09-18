import { describe, it, expect } from "vitest";
import { guessMimeType } from "@/lib/parsing";

describe("guessMimeType", () => {
  it("detects known extensions regardless of the browser-provided mimeType", () => {
    expect(guessMimeType("lyrics.txt", "application/octet-stream")).toBe("text/plain");
    expect(guessMimeType("liner-notes.pdf", "application/octet-stream")).toBe("application/pdf");
    expect(guessMimeType("tracklist.docx", "application/octet-stream")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
  });

  it("trusts a correct browser-provided mimeType even with no/odd extension", () => {
    expect(guessMimeType("lyrics", "text/plain")).toBe("text/plain");
    expect(guessMimeType("notes", "application/pdf")).toBe("application/pdf");
  });

  it("flags legacy .doc as a distinct, unsupported type rather than silently mis-parsing it", () => {
    expect(guessMimeType("old-lyrics.doc", "application/msword")).toBe("application/msword");
  });

  it("returns null for anything it can't identify", () => {
    expect(guessMimeType("photo.png", "image/png")).toBeNull();
    expect(guessMimeType("archive.zip", "application/zip")).toBeNull();
  });
});
