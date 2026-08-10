/**
 * Cover V2 image-provider dispatcher.
 *
 * Two providers now back the picker: Cloudflare Workers AI (the default, covered by
 * the startup credit) and Replicate (Ideogram, a paid opt-in typography specialist).
 * A model id that starts with "@cf/" is Cloudflare; anything else is a Replicate
 * slug. Text verification always runs on Cloudflare regardless of which provider
 * drew the image, so it is re-exported unchanged.
 */

import * as cloudflare from "./cloudflare";
import * as replicate from "./replicate";

export { transcribeImageText } from "./cloudflare";

export interface GenerateImageOptions {
  model: string;
  prompt: string;
  width: number;
  height: number;
}

export function isCloudflareModel(model: string): boolean {
  return model.startsWith("@cf/");
}

export async function generateImage(opts: GenerateImageOptions): Promise<Uint8Array> {
  if (isCloudflareModel(opts.model)) return cloudflare.generateImage(opts);
  return replicate.generateImage(opts);
}
