/**
 * OpenRouter model registry. Primary + fallback are configurable via env so
 * swapping models is a config change, not a code change.
 */

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export function primaryModel(): string {
  return process.env.OPENROUTER_PRIMARY_MODEL || "google/gemini-2.5-flash";
}

export function fallbackModel(): string {
  return process.env.OPENROUTER_FALLBACK_MODEL || "deepseek/deepseek-v4-flash";
}

/**
 * Model for vision/multimodal tasks (e.g. the storybook character-consistency
 * judge). Kept separate from the primary text model because reasoning text models
 * like GLM/DeepSeek reject image input ("No endpoints found that support image
 * input"). Defaults to a known multimodal model; override with STORY_VISION_MODEL.
 */
export function visionModel(): string {
  return process.env.STORY_VISION_MODEL || "google/gemini-2.5-flash";
}

export function isAiConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

/** Ordered list of models to try: primary first, then fallback. */
export function modelChain(): string[] {
  const chain = [primaryModel()];
  const fb = fallbackModel();
  if (fb && fb !== chain[0]) chain.push(fb);
  return chain;
}
