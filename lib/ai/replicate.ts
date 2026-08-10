/**
 * Shared Replicate FLUX Schnell text-to-image helper.
 *
 * Used by the Cover Generator. Returns PNG bytes. Existing generators keep their
 * own copies untouched; new code can use this.
 */

const FLUX_SCHNELL = "black-forest-labs/flux-schnell";

export function isReplicateConfigured(): boolean {
  return Boolean(process.env.REPLICATE_API_TOKEN);
}

interface Prediction {
  status: string;
  output?: string[] | string;
  error?: string;
  urls?: { get?: string };
}

export async function fluxSchnell(opts: {
  prompt: string;
  seed: number;
  aspectRatio?: string;
}): Promise<Uint8Array> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error("REPLICATE_API_TOKEN not set");

  const res = await fetch(`https://api.replicate.com/v1/models/${FLUX_SCHNELL}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "wait",
    },
    body: JSON.stringify({
      input: {
        prompt: opts.prompt,
        aspect_ratio: opts.aspectRatio ?? "2:3",
        num_outputs: 1,
        output_format: "png",
        megapixels: "1",
        seed: opts.seed,
      },
    }),
  });
  if (!res.ok) throw new Error(`Replicate ${res.status}: ${(await res.text()).slice(0, 200)}`);

  let pred = (await res.json()) as Prediction;
  for (let i = 0; pred.status !== "succeeded" && pred.urls?.get && i < 60; i++) {
    if (pred.status === "failed" || pred.status === "canceled") break;
    await new Promise((r) => setTimeout(r, 1500));
    pred = (await (await fetch(pred.urls.get, { headers: { Authorization: `Bearer ${token}` } })).json()) as Prediction;
  }
  if (pred.status !== "succeeded") throw new Error(`Replicate failed: ${pred.error ?? pred.status}`);

  const url = Array.isArray(pred.output) ? pred.output[0] : pred.output;
  if (!url) throw new Error("Replicate returned no image");
  return new Uint8Array(await (await fetch(url)).arrayBuffer());
}
