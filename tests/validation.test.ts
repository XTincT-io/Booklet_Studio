import { describe, it, expect } from "vitest";
import {
  signupSchema,
  createProjectSchema,
  addMemberSchema,
  exportJobSchema,
  trackEventSchema,
  ssoConfigSchema,
} from "@/lib/validation";

describe("signupSchema", () => {
  it("accepts a minimal valid signup", () => {
    const result = signupSchema.safeParse({ email: "artist@example.com", password: "longenough" });
    expect(result.success).toBe(true);
  });

  it("rejects a password under 8 characters", () => {
    const result = signupSchema.safeParse({ email: "artist@example.com", password: "short" });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed email", () => {
    const result = signupSchema.safeParse({ email: "not-an-email", password: "longenough" });
    expect(result.success).toBe(false);
  });

  it("normalizes email case (real bug: mixed-case emails from an admin invite vs. login would otherwise never match)", () => {
    const result = signupSchema.safeParse({ email: "Artist@Example.COM", password: "longenough" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("artist@example.com");
  });

  it("rejects a missing password", () => {
    const result = signupSchema.safeParse({ email: "artist@example.com" });
    expect(result.success).toBe(false);
  });

  it("accepts a blank name field rather than rejecting it (real bug: React's controlled inputs send '' for an empty optional field, not undefined)", () => {
    const result = signupSchema.safeParse({ email: "artist@example.com", password: "longenough", name: "" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBeUndefined(); // blank input should normalize to undefined, not store ""
  });
});

describe("createProjectSchema", () => {
  it("requires a valid formatId from the known set", () => {
    expect(createProjectSchema.safeParse({ orgId: "org_1", formatId: "cd" }).success).toBe(true);
    expect(createProjectSchema.safeParse({ orgId: "org_1", formatId: "vinyl" }).success).toBe(true);
    expect(createProjectSchema.safeParse({ orgId: "org_1", formatId: "not-a-real-format" }).success).toBe(false);
  });

  it("allows name/artist to be omitted (defaults applied by the route)", () => {
    expect(createProjectSchema.safeParse({ orgId: "org_1", formatId: "blank" }).success).toBe(true);
  });
});

describe("addMemberSchema", () => {
  it("only accepts the four known roles", () => {
    for (const role of ["ADMIN", "DESIGNER", "COLLABORATOR", "VIEWER"]) {
      expect(addMemberSchema.safeParse({ email: "a@b.com", role }).success).toBe(true);
    }
    expect(addMemberSchema.safeParse({ email: "a@b.com", role: "SUPERADMIN" }).success).toBe(false);
  });
});

describe("exportJobSchema", () => {
  it("only accepts the three known export types", () => {
    for (const type of ["PDF", "WEB_BUNDLE", "IMAGES"]) {
      expect(exportJobSchema.safeParse({ type }).success).toBe(true);
    }
    expect(exportJobSchema.safeParse({ type: "DOCX" }).success).toBe(false);
  });
});

describe("trackEventSchema", () => {
  // This one guards the single unauthenticated, public-internet-facing endpoint in the
  // app — worth being extra explicit about what it rejects.
  it("accepts the three known analytics event types", () => {
    for (const type of ["view", "hotspot_open", "audio_play"]) {
      expect(trackEventSchema.safeParse({ projectId: "proj_1", type }).success).toBe(true);
    }
  });

  it("rejects an arbitrary event type", () => {
    expect(trackEventSchema.safeParse({ projectId: "proj_1", type: "arbitrary_event" }).success).toBe(false);
  });

  it("rejects a missing projectId", () => {
    expect(trackEventSchema.safeParse({ type: "view" }).success).toBe(false);
  });

  it("pageId is optional and accepts explicit null (not just an omitted field)", () => {
    // Both the exported web-viewer bundle's vanilla JS and the React Preview Viewer send
    // an explicit `null` for pageId in some cases, not just omit the field — this exact
    // distinction was a real bug (plain .optional() rejects null, only allows undefined).
    expect(trackEventSchema.safeParse({ projectId: "proj_1", type: "view" }).success).toBe(true);
    expect(trackEventSchema.safeParse({ projectId: "proj_1", pageId: "page_1", type: "view" }).success).toBe(true);
    expect(trackEventSchema.safeParse({ projectId: "proj_1", pageId: null, type: "view" }).success).toBe(true);
  });
});

describe("ssoConfigSchema", () => {
  it("requires a valid issuer URL", () => {
    expect(ssoConfigSchema.safeParse({ issuer: "not-a-url", clientId: "abc", clientSecret: "secret" }).success).toBe(false);
    expect(ssoConfigSchema.safeParse({ issuer: "https://idp.example.com", clientId: "abc", clientSecret: "secret" }).success).toBe(true);
  });

  it("allows an empty clientSecret (the 'keep current secret' update case)", () => {
    const result = ssoConfigSchema.safeParse({ issuer: "https://idp.example.com", clientId: "abc", clientSecret: "" });
    expect(result.success).toBe(true);
  });
});
