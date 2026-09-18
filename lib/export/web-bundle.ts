import archiver from "archiver";
import { PassThrough } from "stream";
import type { ProjectFull } from "@/lib/types";
import { renderWebViewerHtml } from "./render-html";

/**
 * Builds a self-contained, interactive web-viewer bundle (index.html + a manifest) as a
 * zip buffer — the "embeddable web viewer" / "web link" deliverable from the product
 * spec's export flow. Assets (images/audio) are referenced by their existing S3 URLs
 * rather than copied into the bundle, so the zip stays small; unzip-and-open still works
 * as long as those URLs remain reachable, which is the same assumption the live web
 * viewer already makes.
 */
export async function buildWebViewerBundle(project: ProjectFull): Promise<Buffer> {
  const html = renderWebViewerHtml(project);
  const manifest = {
    name: project.name,
    artist: project.artist ?? null,
    format: project.formatId,
    pageCount: project.pages.length,
    exportedAt: new Date().toISOString(),
  };

  return new Promise((resolve, reject) => {
    const archive = archiver("zip", { zlib: { level: 9 } });
    const stream = new PassThrough();
    const chunks: Buffer[] = [];

    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    archive.on("error", reject);

    archive.pipe(stream);
    archive.append(html, { name: "index.html" });
    archive.append(JSON.stringify(manifest, null, 2), { name: "manifest.json" });
    archive.append(
      "This bundle is self-contained except for images/audio, which load from your Booklet Studio asset storage. Open index.html in any browser.",
      { name: "README.txt" }
    );
    archive.finalize();
  });
}
