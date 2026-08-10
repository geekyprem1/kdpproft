/**
 * Route-level billing guard: feature gating + credit reservation, with typed
 * errors the API routes map to 402 (no credits) / 403 (plan locked).
 */

import { NextResponse } from "next/server";
import { canUseFeature, requiredPlanFor, type Feature, type Plan } from "./plans";
import { getOrCreateSubscription, planKeyOf } from "./subscription";
import { InsufficientCreditsError } from "./credits";
import { assertWithinCaps, CapReachedError } from "./caps";

export class FeatureLockedError extends Error {
  feature: Feature;
  requiredPlan: Plan;
  constructor(feature: Feature) {
    super("Feature locked");
    this.name = "FeatureLockedError";
    this.feature = feature;
    this.requiredPlan = requiredPlanFor(feature);
  }
}

/**
 * Throw FeatureLockedError if the user's plan can't use this feature, or
 * CapReachedError if a fair-use daily/monthly cap is hit. Caps apply to everyone
 * (including Unlimited) to bound ongoing cost against one-time payments.
 */
export async function assertFeature(userId: string, feature: Feature): Promise<void> {
  const sub = await getOrCreateSubscription(userId);
  if (!canUseFeature(planKeyOf(sub), feature, sub.entitlements)) throw new FeatureLockedError(feature);
  await assertWithinCaps(userId, feature);
}

/** Map a billing error to a standard JSON response, or null if not a billing error. */
export function billingErrorResponse(err: unknown): NextResponse | null {
  if (err instanceof FeatureLockedError) {
    return NextResponse.json(
      { error: `${err.requiredPlan.name} required for this feature.`, upgrade: true, requiredPlan: err.requiredPlan.key },
      { status: 403 }
    );
  }
  if (err instanceof InsufficientCreditsError) {
    return NextResponse.json(
      { error: "Not enough credits.", upgrade: true, requiredCredits: err.required, currentCredits: err.current },
      { status: 402 }
    );
  }
  if (err instanceof CapReachedError) {
    const label = err.scope === "image" ? "image book" : "book";
    return NextResponse.json(
      {
        error: `Fair-use limit reached: max ${err.limit} ${label}s per ${err.window}. Please try again later.`,
        capReached: true,
        scope: err.scope,
        window: err.window,
        limit: err.limit,
      },
      { status: 429 }
    );
  }
  return null;
}
