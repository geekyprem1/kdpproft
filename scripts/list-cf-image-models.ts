/**
 * Lists every text-to-image model this Cloudflare account can reach, with its
 * pricing note. Used to decide whether a stronger text-rendering model (GPT Image,
 * Ideogram, Seedream …) is available inside the Workers AI credit rather than
 * needing a separate paid provider.
 *
 *   node --env-file=.env.local --import tsx scripts/list-cf-image-models.ts
 */

const ACCOUNT = (process.env.CLOUDFLARE_ACCOUNT_ID ?? "").trim();
const TOKEN = (process.env.CLOUDFLARE_AI_TOKEN ?? "").trim();

interface Model {
  name?: string;
  description?: string;
  task?: { name?: string };
  properties?: Array<{ property_id?: string; value?: string }>;
}

async function main() {
  if (!ACCOUNT || !TOKEN) {
    console.error("Cloudflare env missing");
    process.exit(1);
  }

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/ai/models/search?per_page=500`,
    { headers: { Authorization: `Bearer ${TOKEN}` } }
  );
  if (!res.ok) {
    console.error(`HTTP ${res.status}`);
    process.exit(1);
  }

  const json = (await res.json()) as { result?: Model[] };
  const all = json.result ?? [];

  const images = all.filter((m) => /text-to-image|image-to-image/i.test(m.task?.name ?? ""));
  console.log(`── Text-to-image models available (${images.length}) ──\n`);
  for (const m of images) {
    const price = m.properties?.find((p) => p.property_id === "price" || p.property_id === "unit_pricing")?.value;
    console.log(`${m.name}`);
    if (price) console.log(`   price: ${price}`);
    console.log("");
  }

  // Anything from a vendor known for strong in-image typography is worth a bench.
  const strongText = all.filter((m) =>
    /gpt-image|ideogram|seedream|recraft|imagen|nano-banana|qwen-image|phoenix|lucid/i.test(m.name ?? "")
  );
  console.log(`── Candidates known for text rendering (${strongText.length}) ──\n`);
  for (const m of strongText) {
    console.log(`${m.name}  [${m.task?.name ?? "?"}]`);
    const price = m.properties?.find((p) => p.property_id === "price" || p.property_id === "unit_pricing")?.value;
    if (price) console.log(`   price: ${price}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
