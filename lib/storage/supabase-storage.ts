/**
 * Supabase Storage provider for book PDFs.
 *
 * Used for the MVP (no card needed). Mirrors the same small interface as the R2
 * provider so we can swap to Cloudflare R2 later by changing one import in
 * `lib/storage/index.ts`. All access is server-side via the service-role client;
 * the bucket is private and downloads use short-lived signed URLs.
 */

import { getSupabaseAdminClient } from "../supabase/admin";

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "books";

/** Whether storage is usable (same requirements as the admin client). */
export function isStorageConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/** Canonical object key for a book's PDF parts. */
export function bookObjectKey(
  userId: string,
  bookId: string,
  part: "interior" | "cover"
): string {
  return `${userId}/${bookId}/${part}.pdf`;
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

/** Upload (or overwrite) any object. */
export async function putBytes(
  key: string,
  body: Uint8Array | Buffer,
  contentType: string
): Promise<void> {
  const admin = getSupabaseAdminClient();
  const { error } = await admin.storage.from(BUCKET).upload(key, Buffer.from(body), {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
}

/** Delete objects, used for best-effort rollback of partially committed artifacts. */
export async function deleteBytes(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  const admin = getSupabaseAdminClient();
  const { error } = await admin.storage.from(BUCKET).remove(keys);
  if (error) throw new Error(`Storage delete failed: ${error.message}`);
}

/** Upload (or overwrite) a book PDF. */
export async function putBookPdf(key: string, body: Uint8Array | Buffer): Promise<void> {
  return putBytes(key, body, "application/pdf");
}

/** Download an object's bytes (server-side, e.g. to bundle into a ZIP). */
export async function getBytes(key: string): Promise<Uint8Array> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.storage.from(BUCKET).download(key);
  if (error || !data) throw new Error(`Storage download failed: ${error?.message ?? "no data"}`);
  return new Uint8Array(await data.arrayBuffer());
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

/** Create a short-lived signed download URL. */
export async function getBookSignedUrl(
  key: string,
  expiresInSec = 300
): Promise<string> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(key, expiresInSec);
  if (error || !data?.signedUrl) {
    throw new Error(`Signed URL failed: ${error?.message ?? "unknown"}`);
  }
  return data.signedUrl;
}
