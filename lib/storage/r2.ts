/**
 * Cloudflare R2 storage client (S3-compatible).
 *
 * Foundation only. Provides upload + signed-URL helpers for generated assets
 * and PDFs. Not used by the PDF gate (which writes to local /output) — wired
 * into the pipeline in later phases.
 */

import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let s3: S3Client | null = null;

/** Whether R2 credentials are present. */
export function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET
  );
}

/** Canonical object key for a book's PDF parts. */
export function bookObjectKey(
  userId: string,
  bookId: string,
  part: "interior" | "cover"
): string {
  return `books/${userId}/${bookId}/${part}.pdf`;
}

/** Canonical object key for one generated cover variation. */
export function coverVariationObjectKey(
  userId: string,
  coverId: string,
  variation: number
): string {
  if (!Number.isInteger(variation) || variation < 0) {
    throw new Error("Cover variation must be a non-negative integer");
  }
  return `covers/${userId}/${coverId}/${variation}.png`;
}

export function isCanonicalBookObjectKey(
  key: string,
  userId: string,
  bookId: string,
  part: "interior" | "cover"
): boolean {
  return key === bookObjectKey(userId, bookId, part);
}

export function isCanonicalCoverVariationObjectKey(
  key: string,
  userId: string,
  coverId: string,
  variation: number
): boolean {
  return key === coverVariationObjectKey(userId, coverId, variation);
}

function getClient(): S3Client {
  if (!s3) {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    if (!accountId || !accessKeyId || !secretAccessKey) {
      throw new Error("Missing R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY");
    }
    s3 = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
  }
  return s3;
}

function bucket(): string {
  const b = process.env.R2_BUCKET;
  if (!b) throw new Error("Missing R2_BUCKET");
  return b;
}

export async function uploadObject(
  key: string,
  body: Uint8Array | Buffer,
  contentType: string
): Promise<void> {
  await getClient().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

export async function getDownloadUrl(key: string, expiresInSec = 3600): Promise<string> {
  return getSignedUrl(
    getClient(),
    new GetObjectCommand({ Bucket: bucket(), Key: key }),
    { expiresIn: expiresInSec }
  );
}

// ── Unified storage-provider interface (matches lib/storage/supabase-storage) ──
// To switch from Supabase Storage to R2 later, point lib/storage/index.ts here.

export const isStorageConfigured = isR2Configured;

export async function putBytes(key: string, body: Uint8Array | Buffer, contentType: string): Promise<void> {
  await uploadObject(key, Buffer.from(body), contentType);
}

export async function putBookPdf(key: string, body: Uint8Array | Buffer): Promise<void> {
  await uploadObject(key, Buffer.from(body), "application/pdf");
}

export async function getBookArtifactSignedUrl(
  key: string,
  userId: string,
  bookId: string,
  part: "interior" | "cover",
  expiresInSec = 300
): Promise<string> {
  if (!isCanonicalBookObjectKey(key, userId, bookId, part)) {
    throw new Error("Refusing to sign a non-canonical book object key");
  }
  return getBookSignedUrl(key, expiresInSec);
}

export async function getCoverVariationSignedUrl(
  key: string,
  userId: string,
  coverId: string,
  variation: number,
  expiresInSec = 300
): Promise<string> {
  if (!isCanonicalCoverVariationObjectKey(key, userId, coverId, variation)) {
    throw new Error("Refusing to sign a non-canonical cover object key");
  }
  return getBookSignedUrl(key, expiresInSec);
}

export async function getBookSignedUrl(key: string, expiresInSec = 300): Promise<string> {
  return getDownloadUrl(key, expiresInSec);
}
