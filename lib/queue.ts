import { Queue } from "bullmq";
import IORedis from "ioredis";

/**
 * Shared Redis connection + queue definitions. Imported both by API routes (to enqueue
 * jobs) and by worker/index.ts (to process them). Keep this file free of any Next.js-only
 * APIs so the worker can import it directly under plain `tsx`/`node`.
 */

const globalForRedis = globalThis as unknown as { bookletRedis?: IORedis };

export function getRedisConnection(): IORedis {
  if (!globalForRedis.bookletRedis) {
    const url = process.env.REDIS_URL || "redis://localhost:6379";
    globalForRedis.bookletRedis = new IORedis(url, { maxRetriesPerRequest: null });
  }
  return globalForRedis.bookletRedis;
}

export interface DocumentParseJobPayload {
  jobRowId: string;
}

export interface ExportJobPayload {
  jobRowId: string;
}

export const QUEUE_NAMES = {
  documentParse: "booklet-document-parse",
  export: "booklet-export",
} as const;

const globalForQueues = globalThis as unknown as {
  bookletDocumentParseQueue?: Queue<DocumentParseJobPayload>;
  bookletExportQueue?: Queue<ExportJobPayload>;
};

export function getDocumentParseQueue(): Queue<DocumentParseJobPayload> {
  if (!globalForQueues.bookletDocumentParseQueue) {
    globalForQueues.bookletDocumentParseQueue = new Queue<DocumentParseJobPayload>(QUEUE_NAMES.documentParse, {
      connection: getRedisConnection(),
      defaultJobOptions: { removeOnComplete: 500, removeOnFail: 500, attempts: 2, backoff: { type: "exponential", delay: 5000 } },
    });
  }
  return globalForQueues.bookletDocumentParseQueue;
}

export function getExportQueue(): Queue<ExportJobPayload> {
  if (!globalForQueues.bookletExportQueue) {
    globalForQueues.bookletExportQueue = new Queue<ExportJobPayload>(QUEUE_NAMES.export, {
      connection: getRedisConnection(),
      defaultJobOptions: { removeOnComplete: 200, removeOnFail: 200, attempts: 1 },
    });
  }
  return globalForQueues.bookletExportQueue;
}
