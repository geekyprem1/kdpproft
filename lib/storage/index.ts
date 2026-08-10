/**
 * Active storage provider.
 *
 * Currently Supabase Storage (free, no card). To switch to Cloudflare R2 later,
 * implement the same four exports in `./r2` and change this re-export — no route
 * changes needed.
 */

export {
  isStorageConfigured,
  bookObjectKey,
  coverVariationObjectKey,
  isCanonicalBookObjectKey,
  isCanonicalCoverVariationObjectKey,
  putBookPdf,
  putBytes,
  deleteBytes,
  getBytes,
  getBookArtifactSignedUrl,
  getCoverVariationSignedUrl,
  getBookSignedUrl,
} from "./supabase-storage";
