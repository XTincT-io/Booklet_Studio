import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
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
