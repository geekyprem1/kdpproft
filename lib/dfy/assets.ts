/**
 * DFY (Done-For-You) asset library — OTO2.
 *
 * Admins upload ready-to-publish files (interiors, covers, bundles); DFY buyers
 * (holders of the `dfy_assets` entitlement) browse and download them. Files live
 * in the private storage bucket under the `dfy/` prefix and are served via
 * short-lived signed URLs. All reads/writes here use the service-role client and
 * must be called only after the appropriate admin / entitlement check upstream.
 */

import { randomUUID } from "crypto";
import { getSupabaseAdminClient } from "../supabase/admin";
import { putBytes, deleteBytes, getBookSignedUrl } from "../storage";

export const DFY_CATEGORIES = [
  "puzzle",
  "coloring",
  "lowcontent",
  "workbook",
  "bundle",
  "general",
] as const;

export type DfyCategory = (typeof DFY_CATEGORIES)[number];

export interface DfyAsset {
  id: string;
  title: string;
  category: string;
  description: string | null;
  file_key: string;
  file_name: string;
  file_size: number;
  content_type: string;
  cover_key: string | null;
  is_published: boolean;
  created_at: string;
}

const DFY_PREFIX = "dfy";

function normalizeName(name: string, fallback: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100) || fallback;
}

/** List assets, newest first. Pass publishedOnly for the buyer-facing catalog. */
export async function listDfyAssets(opts: { publishedOnly?: boolean } = {}): Promise<DfyAsset[]> {
  const admin = getSupabaseAdminClient();
  let query = admin
    .from("dfy_assets")
    .select("id, title, category, description, file_key, file_name, file_size, content_type, cover_key, is_published, created_at")
    .order("created_at", { ascending: false });
  if (opts.publishedOnly) query = query.eq("is_published", true);
  const { data, error } = await query;
  if (error) throw new Error(`Could not list DFY assets: ${error.message}`);
  return (data ?? []) as DfyAsset[];
}

export async function getDfyAsset(id: string): Promise<DfyAsset | null> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("dfy_assets")
    .select("id, title, category, description, file_key, file_name, file_size, content_type, cover_key, is_published, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Could not load DFY asset: ${error.message}`);
  return (data as DfyAsset) ?? null;
}

export interface CreateDfyAssetInput {
  title: string;
  category: string;
  description?: string;
  fileName: string;
  contentType: string;
  bytes: Uint8Array;
  createdBy?: string;
}

/** Upload the file to storage and insert the catalog row. */
export async function createDfyAsset(input: CreateDfyAssetInput): Promise<DfyAsset> {
  const id = randomUUID();
  const safeName = normalizeName(input.fileName, "asset.pdf");
  const fileKey = `${DFY_PREFIX}/${id}/${safeName}`;

  await putBytes(fileKey, input.bytes, input.contentType);

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("dfy_assets")
    .insert({
      id,
      title: input.title,
      category: input.category,
      description: input.description ?? null,
      file_key: fileKey,
      file_name: safeName,
      file_size: input.bytes.byteLength,
      content_type: input.contentType,
      created_by: input.createdBy ?? null,
    })
    .select("id, title, category, description, file_key, file_name, file_size, content_type, cover_key, is_published, created_at")
    .single();

  if (error || !data) {
    // Best-effort cleanup so a failed insert doesn't orphan the uploaded file.
    await deleteBytes([fileKey]).catch(() => {});
    throw new Error(`Could not create DFY asset: ${error?.message ?? "insert failed"}`);
  }
  return data as DfyAsset;
}

/** Toggle publish state. */
export async function setDfyAssetPublished(id: string, published: boolean): Promise<void> {
  const admin = getSupabaseAdminClient();
  const { error } = await admin
    .from("dfy_assets")
    .update({ is_published: published, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`Could not update DFY asset: ${error.message}`);
}

/** Delete the catalog row and its stored file(s). */
export async function deleteDfyAsset(id: string): Promise<void> {
  const asset = await getDfyAsset(id);
  if (!asset) return;
  const keys = [asset.file_key, asset.cover_key].filter((k): k is string => Boolean(k));
  await deleteBytes(keys).catch(() => {});
  const admin = getSupabaseAdminClient();
  const { error } = await admin.from("dfy_assets").delete().eq("id", id);
  if (error) throw new Error(`Could not delete DFY asset: ${error.message}`);
}

/** Short-lived signed download URL for a published asset. */
export async function signDfyDownload(
  id: string,
  expiresInSec = 300
): Promise<{ url: string; fileName: string } | null> {
  const asset = await getDfyAsset(id);
  if (!asset || !asset.is_published) return null;
  const url = await getBookSignedUrl(asset.file_key, expiresInSec);
  return { url, fileName: asset.file_name };
}
