import "dotenv/config";
import { Worker } from "bullmq";
import { getRedisConnection, QUEUE_NAMES, type DocumentParseJobPayload, type ExportJobPayload } from "@/lib/queue";
import { processDocumentParseJob } from "./processors/parseDocument";
import { processExportJob } from "./processors/exportProject";

/**
 * Standalone worker process — run alongside `next dev`/`next start` with `npm run worker`.
 * Everything slow or blocking (document text extraction, headless-Chromium rendering)
 * happens here instead of inline in an API route, per the architecture outline in
 * docs/product-spec.md §13.
 */

const connection = getRedisConnection();

const documentParseWorker = new Worker<DocumentParseJobPayload>(
  QUEUE_NAMES.documentParse,
  async (job) => processDocumentParseJob(job),
  { connection, concurrency: 4 }
);

const exportWorker = new Worker<ExportJobPayload>(
  QUEUE_NAMES.export,
  async (job) => processExportJob(job),
  { connection, concurrency: 2 } // headless Chromium is memory-heavy — keep this low
);

for (const worker of [documentParseWorker, exportWorker]) {
  worker.on("failed", (job, err) => {
    console.error(`[worker] ${worker.name} job ${job?.id} failed:`, err.message);
  });
  worker.on("completed", (job) => {
    console.log(`[worker] ${worker.name} job ${job.id} completed`);
  });
}

console.log("Booklet Studio worker started — listening on:", Object.values(QUEUE_NAMES).join(", "));

async function shutdown() {
  console.log("Shutting down worker…");
  await Promise.all([documentParseWorker.close(), exportWorker.close()]);
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
