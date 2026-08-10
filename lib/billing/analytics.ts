/**
 * Platform analytics (backend only — no admin UI yet). Service-role queries with
 * lightweight in-JS aggregation.
 */

import { getSupabaseAdminClient } from "../supabase/admin";
import { PLANS, planKeyFromName } from "./plans";

export interface PlatformAnalytics {
  mostUsedGenerator: { action: string; count: number } | null;
  creditsConsumed: number;
  topNiches: Array<{ topic: string; count: number }>;
  estimatedRevenue: number;
  planDistribution: Record<string, number>;
}

export async function platformAnalytics(): Promise<PlatformAnalytics> {
  const admin = getSupabaseAdminClient();
  const [{ data: usage }, { data: subs }] = await Promise.all([
    admin.from("usage_events").select("action, credits, status, meta").order("created_at", { ascending: false }).limit(2000),
    admin.from("subscriptions").select("plan_name"),
  ]);

  const events = (usage ?? []) as Array<{ action: string; credits: number; status: string; meta: { topic?: string } }>;
  const byAction = new Map<string, number>();
  const byTopic = new Map<string, number>();
  let creditsConsumed = 0;
  for (const e of events) {
    byAction.set(e.action, (byAction.get(e.action) ?? 0) + 1);
    if (e.status === "completed") creditsConsumed += e.credits;
    const topic = e.meta?.topic?.toString().trim();
    if (topic) byTopic.set(topic, (byTopic.get(topic) ?? 0) + 1);
  }
  const mostUsed = [...byAction.entries()].sort((a, b) => b[1] - a[1])[0];
  const topNiches = [...byTopic.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([topic, count]) => ({ topic, count }));

  const planDistribution: Record<string, number> = {};
  let estimatedRevenue = 0;
  for (const s of (subs ?? []) as Array<{ plan_name: string }>) {
    planDistribution[s.plan_name] = (planDistribution[s.plan_name] ?? 0) + 1;
    estimatedRevenue += PLANS[planKeyFromName(s.plan_name)].price;
  }

  return {
    mostUsedGenerator: mostUsed ? { action: mostUsed[0], count: mostUsed[1] } : null,
    creditsConsumed,
    topNiches,
    estimatedRevenue,
    planDistribution,
  };
}
