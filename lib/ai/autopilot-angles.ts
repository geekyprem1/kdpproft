/**
 * Book Autopilot angle finder. Given one niche/topic, the model proposes 3
 * DISTINCT book angles (each a sellable book in its own right) so Autopilot can
 * spin one idea into three complete ebooks. Falls back to simple deterministic
 * angles if OpenRouter isn't configured.
 */

import { generateJson } from "./provider";
import { isAiConfigured } from "./models";

export interface BookAngle {
  /** Working title for this book. */
  title: string;
  /** The distinct angle/topic this book covers (used as the generation topic). */
  angle: string;
}

export interface AngleInput {
  niche: string;
  audience?: string;
}

function fallback(input: AngleInput): BookAngle[] {
  const n = input.niche.trim();
  return [
    { title: `${n}: The Complete Beginner's Guide`, angle: `A beginner-friendly introduction to ${n}` },
    { title: `The ${n} Daily Practice`, angle: `A practical 30-day action plan for ${n}` },
    { title: `Advanced ${n} Strategies`, angle: `Advanced techniques and deeper mastery of ${n}` },
  ];
}

const str = (s: unknown, max = 160): string =>
  typeof s === "string" ? s.trim().slice(0, max) : "";

export async function generateBookAngles(input: AngleInput): Promise<BookAngle[]> {
  if (!isAiConfigured()) return fallback(input);

  const audience = input.audience?.trim() || "a broad audience";

  try {
    const { data } = await generateJson<Array<{ title?: unknown; angle?: unknown }>>({
      system:
        "You are an Amazon KDP publishing strategist. From a single niche you design " +
        "a coherent 3-book series where each book stands alone AND targets a distinct " +
        "angle (e.g. beginner vs. practice vs. advanced, or three sub-topics). Reply with JSON only.",
      prompt: `Niche / topic: "${input.niche}"
Target audience: ${audience}

Propose EXACTLY 3 distinct, non-overlapping book angles within this niche. Each must be
a complete, sellable book on its own. Vary the angle so a reader could buy all three.

For each book give:
- title: a punchy working title (under 60 characters)
- angle: a ≤140-char description of what THIS book covers (used as the writing brief)

Return JSON of EXACTLY this shape:
{"books":[{"title":"...","angle":"..."}]}`,
      temperature: 0.85,
      maxTokens: 700,
      validate: (raw) => {
        const o = raw as { books?: unknown };
        const list = Array.isArray(o?.books) ? o.books : Array.isArray(raw) ? raw : null;
        if (!list || list.length < 3) throw new Error("need 3 angles");
        return list as Array<{ title?: unknown; angle?: unknown }>;
      },
    });

    const angles = data
      .map((b): BookAngle | null => {
        const title = str(b.title, 120);
        const angle = str(b.angle, 200);
        if (!title || !angle) return null;
        return { title, angle };
      })
      .filter((a): a is BookAngle => a !== null)
      .slice(0, 3);

    return angles.length === 3 ? angles : fallback(input);
  } catch {
    return fallback(input);
  }
}
