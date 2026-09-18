/**
 * DOCX/PDF/TXT text extraction for the "auto-extract lyric/liner text" flow (product
 * spec §4). Runs inside the worker process (worker/processors/parseDocument.ts), never
 * inline in a request — large files shouldn't block the API thread.
 */

export type ParsableMimeType =
  | "text/plain"
  | "application/pdf"
  | "application/vnd.openxmlformats-officedocument.wordprocessingml.document" // .docx
  | "application/msword"; // legacy .doc — best-effort, see note below

export function guessMimeType(filename: string, providedMimeType: string): ParsableMimeType | null {
  const lower = filename.toLowerCase();
  if (providedMimeType === "text/plain" || lower.endsWith(".txt")) return "text/plain";
  if (providedMimeType === "application/pdf" || lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (lower.endsWith(".doc")) return "application/msword";
  return null;
}

/** Extracts plain text from a document buffer. Throws on unsupported/corrupt files. */
export async function extractText(buffer: Buffer, mimeType: ParsableMimeType): Promise<string> {
  switch (mimeType) {
    case "text/plain":
      return buffer.toString("utf8").trim();

    case "application/pdf": {
      // pdf-parse has no native deps and is good enough for lyric/liner-note sheets
      // (text-layer PDFs). Scanned/image-only PDFs will return empty text — the caller
      // surfaces that as a friendly "couldn't find readable text" error rather than
      // silently populating an empty block.
      const pdfParse = (await import("pdf-parse")).default;
      const result = await pdfParse(buffer);
      return result.text.trim();
    }

    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      return result.value.trim();
    }

    case "application/msword":
      // Legacy binary .doc has no lightweight pure-JS parser. Ask the user to re-save
      // as .docx/.pdf/.txt instead of silently returning garbage.
      throw new Error("Legacy .doc files aren't supported — please re-save as .docx, .pdf, or .txt and try again.");

    default:
      throw new Error("Unsupported file type for text extraction.");
  }
}
