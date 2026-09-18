import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({ region: process.env.AWS_REGION });

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

/** Downloads an asset the worker needs to read (e.g. an uploaded lyric document). */
export async function downloadObject(key: string): Promise<Buffer> {
  const res = await s3.send(new GetObjectCommand({ Bucket: process.env.ASSET_BUCKET, Key: key }));
  const stream = res.Body as NodeJS.ReadableStream;
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
