import type { ProjectFull } from "@/lib/types";
import { renderPrintHtml } from "./render-html";

const FORMAT_DIMENSIONS: Record<string, { w: number; h: number }> = {
  blank: { w: 800, h: 1000 },
  cd: { w: 592, h: 592 },
  cassette: { w: 864, h: 340 },
  vinyl: { w: 600, h: 600 },
};

/**
 * Renders a project to a high-resolution, print-safe PDF using headless Chromium.
 * Runs in the worker process, never inline in an API route — a multi-page booklet with
 * embedded images can take several seconds, which is fine for a queued job but not for
 * a request/response cycle.
 *
 * Requires the `puppeteer` package's bundled Chromium (downloaded on `npm install`).
 * If you're deploying the worker somewhere that blocks that download (locked-down CI,
 * some serverless targets), swap this for `puppeteer-core` + `@sparticuz/chromium` and
 * point `executablePath` at the layer's binary instead.
 */
export async function renderProjectToPdf(project: ProjectFull, options?: { highRes?: boolean }): Promise<Buffer> {
  const puppeteer = await import("puppeteer");
  const dims = FORMAT_DIMENSIONS[project.formatId] ?? FORMAT_DIMENSIONS.blank;
  const html = renderPrintHtml(project);
  const deviceScaleFactor = options?.highRes ? 2 : 1; // Free tier gets a standard-res PDF; hq_export tiers get 2x

  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: dims.w, height: dims.h, deviceScaleFactor });
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      width: `${dims.w}px`,
      height: `${dims.h}px`,
      printBackground: true,
      margin: { top: "0", bottom: "0", left: "0", right: "0" },
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}
