import type { Job } from "bullmq";
import { db } from "@/lib/db";
import { downloadObject } from "@/lib/storage";
import { extractText, guessMimeType } from "@/lib/parsing";
import { captureError } from "@/lib/monitoring";
import type { DocumentParseJobPayload } from "@/lib/queue";

export async function processDocumentParseJob(job: Job<DocumentParseJobPayload>): Promise<void> {
  const row = await db.documentParseJob.findUnique({ where: { id: job.data.jobRowId } });
  if (!row) return; // row was deleted (e.g. project removed) — nothing to do

  await db.documentParseJob.update({ where: { id: row.id }, data: { status: "PROCESSING" } });

  try {
    const mimeType = guessMimeType(row.filename, row.mimeType);
    if (!mimeType) {
      throw new Error("Unsupported file type — please upload a .txt, .pdf, or .docx file.");
    }

    const buffer = await downloadObject(row.assetKey);
    const text = await extractText(buffer, mimeType);

    if (!text) {
      throw new Error("Couldn't find any readable text in that file — if it's a scanned PDF, try pasting the lyrics directly instead.");
    }

    await db.documentParseJob.update({
      where: { id: row.id },
      data: { status: "DONE", resultText: text, errorMessage: null },
    });
  } catch (err) {
    captureError(err, { source: "worker:document-parse", jobRowId: row.id, filename: row.filename });
    await db.documentParseJob.update({
      where: { id: row.id },
      data: { status: "FAILED", errorMessage: err instanceof Error ? err.message : "Text extraction failed." },
    });
  }
}
