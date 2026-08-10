/**
 * Story text pipeline: idea → plan (title/moral/metadata) → page-by-page script.
 *
 * Two structured OpenRouter calls with graceful fallbacks so a text-model hiccup
 * never fails the whole book. All narration is short and age-graded.
 */

import { generateJson } from "../../ai/provider";
import { isAiConfigured } from "../../ai/models";
import type { StoryCharacter } from "./character";
import { STORY_AGE_RANGES, type StoryAgeRange, type StoryPlan, type StoryPageScript } from "./types";

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

function fallbackPlan(idea: string, ageRange: StoryAgeRange): StoryPlan {
  const title = cap(idea.trim()).slice(0, 60) || "A Little Adventure";
  return {
    title,
    subtitle: "A Picture Story for Children",
    logline: idea.trim(),
    moral: "kindness and courage",
    setting: "a colorful, friendly world",
    ageRange,
    tone: "warm and gentle",
    description: `A charming illustrated picture book for children ages ${ageRange}, following a lovable character through ${idea.trim()}.`,
    keywords: ["kids picture book", "children's story", "bedtime story", "illustrated", "ages " + ageRange],
    generatedBy: "fallback",
  };
}

/** Expand the idea into a title, moral, setting, and KDP metadata. */
export async function planStory(idea: string, ageRange: StoryAgeRange): Promise<StoryPlan> {
  const fb = fallbackPlan(idea, ageRange);
  if (!isAiConfigured()) return fb;

  try {
    const { data, model } = await generateJson<Omit<StoryPlan, "ageRange" | "generatedBy">>({
      system:
        "You are a children's picture-book editor. Reply with JSON only. Keep everything age-appropriate, wholesome, and simple.",
      prompt: `Story idea: "${idea}". Target age: ${ageRange}.
Plan a picture book. Return JSON:
{"title": string (catchy, <= 8 words),
 "subtitle": string (short),
 "logline": string (one sentence),
 "moral": string (the gentle lesson),
 "setting": string (where it happens),
 "tone": string,
 "description": string (2-3 sentences for the KDP back-cover / listing),
 "keywords": [5 short KDP search phrases]}`,
      temperature: 0.7,
      maxTokens: 700,
      validate: (raw) => {
        const o = raw as Record<string, unknown>;
        const str = (v: unknown, d: string) => (typeof v === "string" && v.trim() ? v.trim() : d);
        const keywords = Array.isArray(o.keywords)
          ? (o.keywords.filter((k) => typeof k === "string").slice(0, 7) as string[])
          : fb.keywords;
        return {
          title: str(o.title, fb.title).slice(0, 80),
          subtitle: str(o.subtitle, fb.subtitle).slice(0, 120),
          logline: str(o.logline, fb.logline),
          moral: str(o.moral, fb.moral),
          setting: str(o.setting, fb.setting),
          tone: str(o.tone, fb.tone),
          description: str(o.description, fb.description),
          keywords: keywords.length ? keywords : fb.keywords,
        };
      },
    });
    return { ...data, ageRange, generatedBy: model };
  } catch {
    return fb;
  }
}

function fallbackPages(plan: StoryPlan, count: number): StoryPageScript[] {
  const beats = [
    "at home, happy and curious at the start of the day",
    "setting off on a small adventure",
    "discovering something new and exciting",
    "meeting a friendly companion",
    "facing a small problem to solve",
    "trying hard and being brave",
    "getting help from a friend",
    "solving the problem with kindness",
    "celebrating with everyone",
    "heading home, tired and happy",
    "sharing what was learned",
    "falling asleep, content and safe",
  ];
  return Array.from({ length: count }, (_, i) => {
    const beat = beats[i % beats.length];
    return {
      text: `And so the story of ${plan.setting} continued, page by page.`,
      scenePrompt: beat,
    };
  });
}

/**
 * Write the page-by-page script: `count` illustrated pages, each with short
 * narration and a scene description for the image model.
 */
export async function writePages(
  idea: string,
  plan: StoryPlan,
  character: StoryCharacter,
  count: number
): Promise<StoryPageScript[]> {
  const fb = fallbackPages(plan, count);
  if (!isAiConfigured()) return fb;

  try {
    const { data } = await generateJson<StoryPageScript[]>({
      system:
        "You write children's picture books. Reply with JSON only — an array. Each page's narration is 1-2 short, simple sentences suitable for the target age. The scene must describe only setting/action/emotion (never restate the character's appearance — that is fixed elsewhere).",
      prompt: `Idea: "${idea}". Title: "${plan.title}". Moral: ${plan.moral}. Setting: ${plan.setting}. Age: ${plan.ageRange}. Main character name: ${character.name}.
Write exactly ${count} pages that tell a complete story with a clear beginning, middle, and end following the moral.
Return JSON array of length ${count}: [{"text": string (narration), "scenePrompt": string (what happens on this page: place, action, emotion)}]`,
      temperature: 0.8,
      maxTokens: 2600,
      validate: (raw) => {
        if (!Array.isArray(raw)) throw new Error("pages not an array");
        const pages = raw
          .map((p) => {
            const o = p as Record<string, unknown>;
            const text = typeof o.text === "string" ? o.text.trim() : "";
            const scenePrompt = typeof o.scenePrompt === "string" ? o.scenePrompt.trim() : "";
            return { text, scenePrompt };
          })
          .filter((p) => p.scenePrompt.length > 0);
        if (pages.length < Math.min(4, count)) throw new Error("too few pages");
        return pages;
      },
    });

    // Normalize to exactly `count` pages: trim overflow, pad shortfall from fallback.
    const pages = data.slice(0, count);
    while (pages.length < count) pages.push(fb[pages.length]);
    return pages;
  } catch {
    return fb;
  }
}
