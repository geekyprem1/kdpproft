/**
 * Subscriptions — plan state per user. Provider-agnostic: only a provider NAME
 * and opaque ids are stored.
 */

import { getSupabaseAdminClient } from "../supabase/admin";
import { PLANS, type PlanKey, planKeyFromName } from "./plans";

export interface Subscription {
  id: string;
  user_id: string;
  plan_name: string;
  plan_type: string;
  monthly_credits: number;
  credits_remaining: number;
  status: string;
  provider: string;
  renews_at: string | null;
  /** Feature flags owned outside the plan tier (JVZoo offers). Migration 0018. */
  entitlements?: Record<string, boolean | string>;
}

export async function getOrCreateSubscription(userId: string): Promise<Subscription> {
  const admin = getSupabaseAdminClient();
  const { data } = await admin.from("subscriptions").select("*").eq("user_id", userId).single();
  if (data) return data as Subscription;

  const free = PLANS.free;
  const { data: created, error } = await admin
    .from("subscriptions")
    .insert({
      user_id: userId,
      plan_name: free.name,
      plan_type: free.type,
      monthly_credits: free.monthlyCredits,
      credits_remaining: free.monthlyCredits,
      status: "active",
      provider: "none",
    })
    .select("*")
    .single();
  if (error || !created) throw new Error(error?.message ?? "could not create subscription");

  // record the trial grant in the ledger
  await admin.from("credit_transactions").insert({
    user_id: userId,
    amount: free.monthlyCredits,
    reason: "signup_bonus",
    balance_after: free.monthlyCredits,
  });
  return created as Subscription;
}

export function planKeyOf(sub: Subscription): PlanKey {
  return planKeyFromName(sub.plan_name);
}

/**
 * Apply an offer's non-credit delivery: merge entitlements and (optionally) set
 * the base plan tier. Credits are granted separately via the credit ledger so
 * the amount stays explicit and audited. Merge is additive — buying more offers
 * only ever turns entitlements on, never off.
 */
export async function applyOfferMeta(
  userId: string,
  meta: { plan?: PlanKey; entitlements?: Record<string, boolean | string> }
): Promise<void> {
  const admin = getSupabaseAdminClient();
  const sub = await getOrCreateSubscription(userId);

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (meta.entitlements && Object.keys(meta.entitlements).length > 0) {
    update.entitlements = { ...(sub.entitlements ?? {}), ...meta.entitlements };
  }
  if (meta.plan) {
    const plan = PLANS[meta.plan];
    update.plan_name = plan.name;
    update.plan_type = plan.type;
    update.monthly_credits = plan.monthlyCredits;
    update.status = "active";
  }

  // Nothing to change (credits-only offer) → skip the write.
  if (Object.keys(update).length === 1) return;

  const { error } = await admin.from("subscriptions").update(update).eq("user_id", userId);
  if (error) throw new Error(error.message);
}

/** Assign/upgrade a plan and grant its monthly credits. */
export async function changePlan(
  userId: string,
  planKey: PlanKey,
  opts?: { provider?: string; providerCustomerId?: string; providerTransactionId?: string }
): Promise<Subscription> {
  const admin = getSupabaseAdminClient();
  const sub = await getOrCreateSubscription(userId);
  const plan = PLANS[planKey];
  const newRemaining = sub.credits_remaining + plan.monthlyCredits;
  const renewsAt = plan.type === "free" ? null : new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();

  const { data, error } = await admin
    .from("subscriptions")
    .update({
      plan_name: plan.name,
      plan_type: plan.type,
      monthly_credits: plan.monthlyCredits,
      credits_remaining: newRemaining,
      status: "active",
      provider: opts?.provider ?? sub.provider,
      provider_customer_id: opts?.providerCustomerId ?? null,
      provider_transaction_id: opts?.providerTransactionId ?? null,
      renews_at: renewsAt,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "plan change failed");

  await admin.from("credit_transactions").insert({
    user_id: userId, amount: plan.monthlyCredits, reason: "grant", balance_after: newRemaining, ref_type: "plan_change",
  });
  await admin.from("billing_audit_log").insert({ user_id: userId, action: "plan_change", detail: { plan: planKey, credits: plan.monthlyCredits } });
  return data as Subscription;
}
