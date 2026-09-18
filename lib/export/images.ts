import archiver from "archiver";
import { PassThrough } from "stream";
import type { ProjectFull } from "@/lib/types";
import { renderPrintHtml } from "./render-html";

const FORMAT_DIMENSIONS: Record<string, { w: number; h: number }> = {
  blank: { w: 800, h: 1000 },
  cd: { w: 592, h: 592 },
  cassette: { w: 864, h: 340 },
  vinyl: { w: 600, h: 600 },
};

/**
 * Renders each page to a high-res PNG (device scale 2x) and zips them — the "image
 * assets" export option alongside PDF and the web-viewer bundle. Shares the exact same
 * print-safe HTML as the PDF export (lib/export/render-html.ts) so all three export
 * types stay visually consistent.
 */
export async function renderPageImages(project: ProjectFull, options?: { highRes?: boolean }): Promise<Buffer> {
  const puppeteer = await import("puppeteer");
  const dims = FORMAT_DIMENSIONS[project.formatId] ?? FORMAT_DIMENSIONS.blank;
  const html = renderPrintHtml(project);
  const deviceScaleFactor = options?.highRes ? 2 : 1;

  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: dims.w, height: dims.h, deviceScaleFactor });
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pageHandles = await page.$$(".bs-print-page");
    const pngBuffers: { name: string; buffer: Buffer }[] = [];
    for (let i = 0; i < pageHandles.length; i++) {
      const buffer = await pageHandles[i].screenshot({ type: "png" });
      pngBuffers.push({ name: `page-${String(i + 1).padStart(2, "0")}.png`, buffer: Buffer.from(buffer) });
    }

    return new Promise((resolve, reject) => {
      const archive = archiver("zip", { zlib: { level: 9 } });
      const stream = new PassThrough();
      const chunks: Buffer[] = [];
      stream.on("data", (chunk) => chunks.push(chunk));
      stream.on("end", () => resolve(Buffer.concat(chunks)));
      archive.on("error", reject);
      archive.pipe(stream);
      for (const { name, buffer } of pngBuffers) archive.append(buffer, { name });
      archive.finalize();
    });
  } finally {
    await browser.close();
  }
}
