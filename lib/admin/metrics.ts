/**
 * Admin dashboard metrics — service-role aggregates. Reuses subscriptions,
 * usage_events, books and generation_jobs (no new tracking tables).
 */

import { getSupabaseAdminClient } from "../supabase/admin";
import { PLANS, planKeyFromName } from "../billing/plans";

export interface AdminMetrics {
  totalUsers: number;
  activeUsers: number;    // distinct users with a usage event in the last 30 days
  paidUsers: number;      // active, non-free subscriptions
  revenue: number;        // sum of plan prices across paid subs (one-time model → "MRR" proxy)
  creditsConsumed: number;
  booksGenerated: number;
  jobsByStatus: Record<string, number>;
  ticketsByStatus: Record<string, number>;
}

const JOB_STATUSES = ["queued", "processing", "completed", "failed", "cancelled"];
const TICKET_STATUSES = ["open", "pending", "answered", "closed"];

export async function adminMetrics(): Promise<AdminMetrics> {
  const admin = getSupabaseAdminClient();
  const monthAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

  const [
    { count: totalUsers },
    { count: booksGenerated },
    { data: subs },
    { data: recentUsage },
    { data: usageCredits },
    ...jobCounts
  ] = await Promise.all([
    admin.from("profiles").select("*", { count: "exact", head: true }),
    admin.from("books").select("*", { count: "exact", head: true }),
    admin.from("subscriptions").select("plan_name, plan_type, status"),
    admin.from("usage_events").select("user_id").gte("created_at", monthAgo).eq("status", "completed"),
    admin.from("usage_events").select("credits").eq("status", "completed").limit(50000),
    ...JOB_STATUSES.map((s) =>
      admin.from("generation_jobs").select("*", { count: "exact", head: true }).eq("status", s)
    ),
  ]);

  // active users = distinct users with completed usage in last 30d
  const activeSet = new Set<string>();
  for (const r of (recentUsage ?? []) as Array<{ user_id: string }>) activeSet.add(r.user_id);

  // credits consumed (all-time, completed)
  let creditsConsumed = 0;
  for (const r of (usageCredits ?? []) as Array<{ credits: number }>) creditsConsumed += r.credits ?? 0;

  // paid users + revenue
  let paidUsers = 0;
  let revenue = 0;
  for (const s of (subs ?? []) as Array<{ plan_name: string; plan_type: string; status: string }>) {
    if (s.plan_type !== "free" && s.status === "active") {
      paidUsers += 1;
      revenue += PLANS[planKeyFromName(s.plan_name)]?.price ?? 0;
    }
  }

  const jobsByStatus: Record<string, number> = {};
  JOB_STATUSES.forEach((s, i) => {
    jobsByStatus[s] = (jobCounts[i] as { count: number | null })?.count ?? 0;
  });

  // tickets by status (sequential-light; small table)
  const ticketsByStatus: Record<string, number> = {};
  await Promise.all(
    TICKET_STATUSES.map(async (s) => {
      const { count } = await admin.from("support_tickets").select("*", { count: "exact", head: true }).eq("status", s);
      ticketsByStatus[s] = count ?? 0;
    })
  );

  return {
    totalUsers: totalUsers ?? 0,
    activeUsers: activeSet.size,
    paidUsers,
    revenue,
    creditsConsumed,
    booksGenerated: booksGenerated ?? 0,
    jobsByStatus,
    ticketsByStatus,
  };
}
