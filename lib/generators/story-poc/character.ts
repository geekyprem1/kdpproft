/**
 * Storybook POC — character bible, descriptor, scenes, and prompt builders.
 * The character is fixed per the POC spec (friendly green dragon, red scarf,
 * yellow belly). The bible can be enriched by OpenRouter, with a hardcoded
 * fallback that always honors the required features.
 */

import { generateJson } from "../../ai/provider";
import { isAiConfigured } from "../../ai/models";

export interface CharacterBible {
  name: string;
  species: string;
  build: string;
  colors: { body: string; belly: string; accessory: string };
  features: string[];
  accessory: string;
  descriptor: string; // compiled, fixed-wording prompt fragment
  generatedBy: string;
}

const ART_STYLE =
  "soft watercolor children's book illustration, full color, gentle rounded outlines, warm palette";

const FALLBACK: CharacterBible = {
  name: "Ember",
  species: "dragon",
  build: "small, round, friendly",
  colors: { body: "emerald green", belly: "yellow", accessory: "red" },
  features: ["oversized friendly eyes", "small rounded wings", "stubby tail"],
  accessory: "a red scarf",
  descriptor:
    "a small round friendly emerald-green dragon with a yellow belly, oversized friendly eyes, small rounded wings, and a stubby tail, wearing a red scarf",
  generatedBy: "fallback",
};

export const SCENES: string[] = [
  "walking through a lush green forest",
  "helping a small rabbit",
  "reading a book under a big tree",
  "playing near a sparkling river",
  "talking with animal friends in a meadow",
  "watching the sunset from a hilltop",
];

/** Build (or enrich) the character bible. Always green dragon / red scarf / yellow belly. */
export async function buildBible(): Promise<CharacterBible> {
  if (!isAiConfigured()) return FALLBACK;
  try {
    const { data, model } = await generateJson<Omit<CharacterBible, "descriptor" | "generatedBy">>({
      system: "You design children's book characters. Reply with JSON only.",
      prompt: `Design a character bible for a friendly green dragon with a RED scarf and a YELLOW belly, for a kids' picture book.
Return JSON: {"name": string, "species": "dragon", "build": string, "colors": {"body": "green", "belly": "yellow", "accessory": "red"}, "features": [string,string,string], "accessory": "a red scarf"}`,
      temperature: 0.6,
      maxTokens: 400,
      validate: (raw) => {
        const o = raw as Record<string, unknown>;
        if (typeof o.name !== "string") throw new Error("name");
        const features = Array.isArray(o.features) ? (o.features.filter((f) => typeof f === "string") as string[]) : [];
        if (features.length < 1) throw new Error("features");
        return {
          name: o.name,
          species: "dragon",
          build: typeof o.build === "string" ? o.build : FALLBACK.build,
          colors: { body: "emerald green", belly: "yellow", accessory: "red" },
          features,
          accessory: "a red scarf",
        } as Omit<CharacterBible, "descriptor" | "generatedBy">;
      },
    });
    const descriptor = `a ${data.build} friendly emerald-green ${data.species} with a yellow belly, ${data.features.join(", ")}, wearing ${data.accessory}`;
    return { ...data, descriptor, generatedBy: model };
  } catch {
    return FALLBACK;
  }
}

export function referencePrompt(bible: CharacterBible): string {
  return `${ART_STYLE}. Full-body character reference of ${bible.descriptor}. Neutral standing pose, facing forward, plain white background, centered, single character, no text.`;
}

export function scenePrompt(bible: CharacterBible, scene: string): string {
  return `Keep this exact character unchanged — ${bible.descriptor}. Same colors, same design. Show the character ${scene}. ${ART_STYLE}. Single character, friendly mood, no text, no watermark.`;
}
