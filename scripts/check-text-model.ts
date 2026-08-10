/**
 * Confirms the configured art-director model actually answers.
 *
 *   node --env-file=.env.local --import tsx scripts/check-text-model.ts
 *
 * Worth running after changing OPENROUTER_PRIMARY_MODEL: a wrong or unavailable
 * slug does not error loudly, it just falls through to the fallback model, so the
 * covers would silently be briefed by something other than what you chose.
 *
 * Costs a fraction of a cent and makes no image calls.
 */

import { generateCoverV2Brief } from "../lib/cover-v2/brief";
import { primaryModel, fallbackModel, isAiConfigured } from "../lib/ai/models";

async function main(): Promise<void> {
  if (!isAiConfigured()) {
    console.error("✗ OPENROUTER_API_KEY is missing");
    process.exit(1);
  }

  const wanted = primaryModel();
  console.log(`configured primary : ${wanted}`);
  console.log(`configured fallback: ${fallbackModel()}\n`);

  const started = Date.now();
  const brief = await generateCoverV2Brief({
    title: "Quiet Mornings",
    subtitle: "A Field Guide to Slow Days",
    author: "Prem Sharma",
    genre: "business",
    trim: "6x9",
    style: "clean_modern",
  });
  const seconds = ((Date.now() - started) / 1000).toFixed(1);

  console.log(`brief written by   : ${brief.model}  (${seconds}s)`);
  if (brief.model === "template") {
    console.log("\n✗ Both models failed — the brief came from the hardcoded template.");
    console.log("  Check the model slug and that your OpenRouter key can access it.");
    process.exitCode = 1;
    return;
  }
  if (brief.model !== wanted) {
    console.log(`\n! Not your primary model. "${wanted}" did not answer usably, so the`);
    console.log("  fallback was used. Verify the slug exists in the OpenRouter catalog.");
    process.exitCode = 1;
  } else {
    console.log("\n✓ Your chosen model is writing the briefs.");
  }

  console.log(`\n  concept   : ${brief.concept}`);
  console.log(`  typography: ${brief.typographyInstruction}`);
  console.log(`  palette   : ${brief.palette.join(", ")}`);
  console.log(`  mood      : ${brief.mood}`);
}

main().catch((e) => {
  console.error("check failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
