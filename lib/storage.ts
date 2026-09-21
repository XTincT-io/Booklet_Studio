import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({ region: process.env.AWS_REGION });

// No layer of the upload pipeline (presigned PUT URLs don't support a size cap the way
// presigned POST policies do) currently limits how large a file someone can upload.
// This is the one place that actually matters for it: the worker fully buffers a
// downloaded file into memory before parsing it, so an arbitrarily large "lyrics.txt"
// would be a real way to crash the worker process (OOM), not just a theoretical one.
const MAX_DOWNLOAD_BYTES = 25 * 1024 * 1024; // 25MB — generous for any real lyric/liner-note document

export async function createUploadUrl(orgId: string, filename: string, contentType: string) {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `orgs/${orgId}/${Date.now()}-${safeName}`;

  const command = new PutObjectCommand({
    Bucket: process.env.ASSET_BUCKET,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 900 });
  const publicUrl = `${process.env.ASSET_PUBLIC_BASE_URL}/${key}`;

  return { uploadUrl, publicUrl, key };
}

/**
 * Direct server-side upload — used by the worker process to store generated exports
 * (PDFs, web-viewer bundles) that don't go through the browser's presigned-PUT flow.
 */
export async function uploadBuffer(orgId: string, filename: string, contentType: string, body: Buffer): Promise<{ publicUrl: string; key: string }> {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `orgs/${orgId}/exports/${Date.now()}-${safeName}`;

  await s3.send(new PutObjectCommand({ Bucket: process.env.ASSET_BUCKET, Key: key, ContentType: contentType, Body: body }));

  return { publicUrl: `${process.env.ASSET_PUBLIC_BASE_URL}/${key}`, key };
}

/** Downloads an asset the worker needs to read (e.g. an uploaded lyric document). Refuses anything over MAX_DOWNLOAD_BYTES rather than buffering an arbitrarily large file into memory. */
export async function downloadObject(key: string): Promise<Buffer> {
  // Check declared size first — avoids even starting the download for an obviously
  // oversized file. Not fully trustworthy on its own (a misbehaving/malicious client
  // could theoretically lie about Content-Length), which is why the streaming loop below
  // also enforces the cap independently as it reads.
  const head = await s3.send(new HeadObjectCommand({ Bucket: process.env.ASSET_BUCKET, Key: key }));
  if (head.ContentLength && head.ContentLength > MAX_DOWNLOAD_BYTES) {
    throw new Error(`File is too large (${Math.round(head.ContentLength / 1024 / 1024)}MB) — the limit is ${MAX_DOWNLOAD_BYTES / 1024 / 1024}MB.`);
  }

  const res = await s3.send(new GetObjectCommand({ Bucket: process.env.ASSET_BUCKET, Key: key }));
  const stream = res.Body as NodeJS.ReadableStream;
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of stream) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buf.length;
    if (totalBytes > MAX_DOWNLOAD_BYTES) {
      throw new Error(`File is too large — the limit is ${MAX_DOWNLOAD_BYTES / 1024 / 1024}MB.`);
    }
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}
