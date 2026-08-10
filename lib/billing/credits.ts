/**
 * Credit ledger — reserve / refund / grant + usage recording. Balance lives on
 * subscriptions.credits_remaining; credit_transactions is the audit ledger.
 */

import { getSupabaseAdminClient } from "../supabase/admin";
import { getOrCreateSubscription } from "./subscription";
import { isUnlimited } from "./plans";

export class InsufficientCreditsError extends Error {
  required: number;
  current: number;
  constructor(required: number, current: number) {
    super("Insufficient credits");
    this.name = "InsufficientCreditsError";
    this.required = required;
    this.current = current;
  }
}

export async function getBalance(userId: string): Promise<number> {
  return (await getOrCreateSubscription(userId)).credits_remaining;
}

/** Atomic conditional decrement via SQL. Returns new balance, or null if the
 *  balance can't cover the cost (no read-then-write race). */
async function spend(
  userId: string,
  amount: number,
  reason: string,
  ref?: { type?: string; id?: string }
): Promise<number | null> {
  await getOrCreateSubscription(userId); // ensure the row exists, then decrement atomically
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.rpc("spend_credits", {
    p_user: userId, p_amount: amount, p_reason: reason,
    p_ref_type: ref?.type ?? null, p_ref_id: ref?.id ?? null,
  });
  if (error) throw error;
  return (data as number | null);
}

/** Atomic unconditional add (refund/grant/admin). Returns new balance. */
async function add(
  userId: string,
  delta: number,
  reason: string,
  ref?: { type?: string; id?: string }
): Promise<number> {
  await getOrCreateSubscription(userId);
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.rpc("add_credits", {
    p_user: userId, p_delta: delta, p_reason: reason,
    p_ref_type: ref?.type ?? null, p_ref_id: ref?.id ?? null,
  });
  if (error) throw error;
  return (data as number) ?? 0;
}

async function writeAudit(userId: string, action: string, detail: Record<string, unknown>): Promise<void> {
  const { error } = await getSupabaseAdminClient()
    .from("billing_audit_log")
    .insert({ user_id: userId, action, detail });
  // The atomic credit ledger is authoritative. A secondary analytics/audit
  // outage must not make a committed debit/refund look failed to the caller,
  // which could otherwise trigger a duplicate compensation.
  if (error) console.error(`[billing] ${action} audit insert failed:`, error);
}

/**
 * Hold credits before non-job work. Legacy job callers without a job id perform
 * only a preflight; enqueue atomically creates the job and reserves its credits.
 */
export async function reserve(userId: string, cost: number, refType: string, refId?: string): Promise<void> {
  if (cost <= 0) return;
  // Unlimited OTO owners never spend credits — generation is free for them.
  const sub = await getOrCreateSubscription(userId);
  if (isUnlimited(sub.entitlements)) return;
  if (refType === "job" && !refId) {
    const current = await getBalance(userId);
    if (current < cost) throw new InsufficientCreditsError(cost, current);
    return;
  }
  const result = await spend(userId, cost, "reserve", { type: refType, id: refId });
  if (result === null) {
    const current = await getBalance(userId);
    throw new InsufficientCreditsError(cost, current);
  }
  await writeAudit(userId, "reserve", { cost, refType, refId });
}

const UUID_REF = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ledgerRefId = (value?: string): string | undefined =>
  value && UUID_REF.test(value) ? value : undefined;

/** Give reserved credits back (generation failed/partial). */
export async function refund(userId: string, cost: number, refId?: string): Promise<void> {
  if (cost <= 0) return;
  // The SQL ledger column is UUID-typed. Human notes/labels remain in the audit
  // detail but must never be sent to the UUID cast used by add_credits.
  await add(userId, cost, "refund", { type: "refund", id: ledgerRefId(refId) });
  await writeAudit(userId, "refund", { cost, refId });
}

/** Grant credits (launch bonus, promo, JVZoo bonus, manual). */
export async function grant(userId: string, amount: number, reason = "bonus"): Promise<void> {
  if (amount <= 0) return;
  await add(userId, amount, reason);
  await writeAudit(userId, "grant", { amount, reason });
}

/** Remove credits (admin/correction). */
export async function removeCredits(userId: string, amount: number, reason = "admin_adjust"): Promise<void> {
  if (amount <= 0) return;
  await add(userId, -amount, reason);
  await writeAudit(userId, "remove", { amount, reason });
}

/** Record a usage event (analytics + history). */
export async function recordUsage(
  userId: string,
  action: string,
  credits: number,
  status: "completed" | "failed" | "refunded",
  refId?: string,
  meta?: Record<string, unknown>
): Promise<void> {
  const { error } = await getSupabaseAdminClient().from("usage_events").insert({
    user_id: userId, action, credits, status, ref_id: refId ?? null, meta: meta ?? {},
  });
  if (error) throw error;
}
