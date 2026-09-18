import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

/**
 * Symmetric encryption for small secrets we must store at rest but never need to
 * search on — currently just SsoConfig.clientSecretEncrypted. Not a general-purpose
 * KMS: it's a single app-wide key (SSO_ENCRYPTION_KEY) with AES-256-GCM per-value IVs.
 * Rotate SSO_ENCRYPTION_KEY by re-saving every org's SSO config with the new key.
 */

function getKey(): Buffer {
  const secret = process.env.SSO_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error("SSO_ENCRYPTION_KEY is not set — required to store or read SSO client secrets.");
  }
  // Derive a 32-byte key from whatever-length secret the operator provides.
  return scryptSync(secret, "booklet-studio-sso", 32);
}

export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(".");
}

export function decryptSecret(payload: string): string {
  const key = getKey();
  const [ivB64, authTagB64, dataB64] = payload.split(".");
  if (!ivB64 || !authTagB64 || !dataB64) throw new Error("Malformed encrypted secret payload.");
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
