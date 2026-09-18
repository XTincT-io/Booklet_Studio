import type { Job } from "bullmq";
import { db } from "@/lib/db";
import { uploadBuffer } from "@/lib/storage";
import { renderProjectToPdf } from "@/lib/export/pdf";
import { buildWebViewerBundle } from "@/lib/export/web-bundle";
import { hasFeature } from "@/lib/entitlements";
import { captureError } from "@/lib/monitoring";
import { loadProjectFull } from "@/lib/project-full";
import type { ExportJobPayload } from "@/lib/queue";

export async function processExportJob(job: Job<ExportJobPayload>): Promise<void> {
  const row = await db.exportJob.findUnique({ where: { id: job.data.jobRowId } });
  if (!row) return;

  await db.exportJob.update({ where: { id: row.id }, data: { status: "PROCESSING" } });

  try {
    const [project, org] = await Promise.all([
      loadProjectFull(row.projectId),
      db.org.findUnique({ where: { id: row.orgId } }),
    ]);
    if (!project) throw new Error("Project no longer exists.");
    const highRes = org ? hasFeature(org.tier, "hq_export") : false;

    const safeName = project.name.replace(/\s+/g, "_");
    let publicUrl: string;

    if (row.type === "PDF") {
      const pdfBuffer = await renderProjectToPdf(project, { highRes });
      ({ publicUrl } = await uploadBuffer(row.orgId, `${safeName}.pdf`, "application/pdf", pdfBuffer));
    } else if (row.type === "WEB_BUNDLE") {
      const zipBuffer = await buildWebViewerBundle(project);
      ({ publicUrl } = await uploadBuffer(row.orgId, `${safeName}_web.zip`, "application/zip", zipBuffer));
    } else {
      // IMAGES: per-page PNG export, using the same print-safe HTML as the PDF export
      // (lib/export/render-html.ts) so all three export types stay visually consistent.
      const { renderPageImages } = await import("@/lib/export/images");
      const zipBuffer = await renderPageImages(project, { highRes });
      ({ publicUrl } = await uploadBuffer(row.orgId, `${safeName}_images.zip`, "application/zip", zipBuffer));
    }

    await db.exportJob.update({ where: { id: row.id }, data: { status: "DONE", resultUrl: publicUrl, errorMessage: null } });
  } catch (err) {
    captureError(err, { source: "worker:export", jobRowId: row.id, type: row.type });
    await db.exportJob.update({
      where: { id: row.id },
      data: { status: "FAILED", errorMessage: err instanceof Error ? err.message : "Export failed." },
    });
  }
}
