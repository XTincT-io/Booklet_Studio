import { describe, it, expect } from "vitest";
import { renderWebViewerHtml, renderPrintHtml } from "@/lib/export/render-html";
import type { ProjectFull } from "@/lib/types";

/**
 * The page-update route (PATCH /api/projects/[id]/pages/[pageId]) and the project-update
 * route (PATCH /api/projects/[id]) both store `blocks`/`theme` as opaque JSON straight
 * from the request body — neither validates its shape against a schema. Combined with
 * /p/[slug] serving this renderer's output as unescaped text/html to unauthenticated
 * public visitors, that makes this renderer the actual security boundary: it must never
 * trust that any field is the type or shape it's supposed to be. These tests prove that,
 * for every interpolation point, rather than just asserting it by reading the source.
 */

function baseProject(overrides: Partial<ProjectFull> = {}): ProjectFull {
  return {
    id: "proj_1",
    name: "Test Album",
    artist: "Test Artist",
    formatId: "cd",
    status: "DRAFT",
    theme: { id: "t1", bg: "#000", text: "#fff", fontHeading: "Inter", fontBody: "Inter", texture: "grain" } as never,
    metadata: {} as never,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    pages: [],
    ...overrides,
  };
}

const XSS_PAYLOAD = '"><script>alert(document.cookie)</script>';

describe("renderWebViewerHtml — attribute-breakout XSS resistance", () => {
  it("escapes a malicious color value on a text block rather than breaking out of the style attribute", () => {
    const project = baseProject({
      pages: [{ id: "page_1", name: "P1", order: 0, blocks: [
        { id: "b1", type: "text", x: 0, y: 0, w: 10, h: 10, z: 1, hidden: false, content: "hi", fontFamily: "Inter", fontSize: 12, fontWeight: "400", align: "left", color: XSS_PAYLOAD } as never,
      ] }],
    });
    const html = renderWebViewerHtml(project);
    expect(html).not.toContain("<script>alert(document.cookie)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes a malicious fontWeight/align/fill/fit value", () => {
    const project = baseProject({
      pages: [{ id: "page_1", name: "P1", order: 0, blocks: [
        { id: "b1", type: "text", x: 0, y: 0, w: 10, h: 10, z: 1, hidden: false, content: "hi", fontFamily: "Inter", fontSize: 12, fontWeight: XSS_PAYLOAD, align: XSS_PAYLOAD, color: "#fff" } as never,
        { id: "b2", type: "shape", x: 0, y: 0, w: 10, h: 10, z: 1, hidden: false, shape: "rect", fill: XSS_PAYLOAD, opacity: 1 } as never,
        { id: "b3", type: "image", x: 0, y: 0, w: 10, h: 10, z: 1, hidden: false, src: "https://example.com/a.png", fit: XSS_PAYLOAD, opacity: 1 } as never,
      ] }],
    });
    const html = renderWebViewerHtml(project);
    expect(html).not.toContain(XSS_PAYLOAD);
  });

  it("escapes a malicious hotspot note/label/linkedAudioId", () => {
    const project = baseProject({
      pages: [{ id: "page_1", name: "P1", order: 0, blocks: [
        { id: "b1", type: "hotspot", x: 0, y: 0, w: 10, h: 10, z: 1, hidden: false, label: XSS_PAYLOAD, note: XSS_PAYLOAD, linkedAudioId: XSS_PAYLOAD, timestamp: 0 } as never,
      ] }],
    });
    const html = renderWebViewerHtml(project);
    expect(html).not.toContain(XSS_PAYLOAD);
  });

  it("escapes a malicious project.theme.bg value", () => {
    const project = baseProject({ theme: { id: "t1", bg: XSS_PAYLOAD, text: "#fff", fontHeading: "Inter", fontBody: "Inter", texture: "none" } as never, pages: [{ id: "page_1", name: "P1", order: 0, blocks: [] }] });
    const html = renderWebViewerHtml(project);
    expect(html).not.toContain(XSS_PAYLOAD);
  });

  it("coerces a non-numeric x/y/w/h/z/fontSize to a safe fallback instead of interpolating it raw", () => {
    const project = baseProject({
      pages: [{ id: "page_1", name: "P1", order: 0, blocks: [
        { id: "b1", type: "text", x: XSS_PAYLOAD, y: 0, w: 10, h: 10, z: 1, hidden: false, content: "hi", fontFamily: "Inter", fontSize: XSS_PAYLOAD, fontWeight: "400", align: "left", color: "#fff" } as never,
      ] }],
    });
    const html = renderWebViewerHtml(project);
    expect(html).not.toContain(XSS_PAYLOAD);
  });

  it("escapes project name/artist in the <title> tag", () => {
    const project = baseProject({ name: XSS_PAYLOAD, artist: XSS_PAYLOAD, pages: [] });
    const html = renderWebViewerHtml(project);
    expect(html).not.toContain(XSS_PAYLOAD);
  });

  it("same guarantees hold for the print/PDF renderer, not just the web viewer", () => {
    const project = baseProject({
      pages: [{ id: "page_1", name: "P1", order: 0, blocks: [
        { id: "b1", type: "text", x: 0, y: 0, w: 10, h: 10, z: 1, hidden: false, content: "hi", fontFamily: "Inter", fontSize: 12, fontWeight: "400", align: "left", color: XSS_PAYLOAD } as never,
      ] }],
    });
    const html = renderPrintHtml(project);
    expect(html).not.toContain(XSS_PAYLOAD);
  });
});
