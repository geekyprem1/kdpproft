import { NextRequest, NextResponse } from "next/server";
import { isPersistenceNotFound } from "@/lib/supabase/errors";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  resolveAdmin,
  suspendUser, banUser, restoreUser, softDeleteUser, hardDeleteUser,
  adminGrantCredits, adminRemoveCredits, adminRefund, adminChangePlan, adminGrantOffer,
} from "@/lib/admin";
import { PLANS, type PlanKey } from "@/lib/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin user actions. One POST handler dispatches on `action`. Every path is
 * gated by resolveAdmin(); destructive role/role-targeting and hard-delete are
 * restricted to super_admin. All mutations are audited inside the lib helpers.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await resolveAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: targetId } = await params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const action = String(body.action ?? "");

  // Look up the target's role to protect privileged accounts.
  const { data: target, error: targetError } = await getSupabaseAdminClient()
    .from("profiles")
    .select("role")
    .eq("id", targetId)
    .single();
  if (targetError) {
    console.error("[admin] target lookup failed:", targetError);
    if (targetError.code === "PGRST116") {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Could not load user." }, { status: 500 });
  }
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const targetIsPrivileged = target.role === "admin" || target.role === "super_admin";
  if (targetIsPrivileged && admin.role !== "super_admin") {
    return NextResponse.json({ error: "Only a super_admin can act on admin accounts." }, { status: 403 });
  }
  if (targetId === admin.userId && ["suspend", "ban", "soft_delete", "hard_delete"].includes(action)) {
    return NextResponse.json({ error: "You cannot perform this action on your own account." }, { status: 400 });
  }

  const amount = Math.floor(Number(body.amount));
  const reason = typeof body.reason === "string" ? body.reason : undefined;

  try {
    switch (action) {
      case "grant_credits":
        if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "amount must be > 0" }, { status: 400 });
        await adminGrantCredits(admin, targetId, amount, reason);
        break;
      case "remove_credits":
        if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "amount must be > 0" }, { status: 400 });
        await adminRemoveCredits(admin, targetId, amount, reason);
        break;
      case "refund":
        if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "amount must be > 0" }, { status: 400 });
        await adminRefund(admin, targetId, amount, reason);
        break;
      case "change_plan": {
        const planKey = String(body.planKey) as PlanKey;
        if (!(planKey in PLANS)) return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
        await adminChangePlan(admin, targetId, planKey);
        break;
      }
      case "grant_offer": {
        const offerKey = typeof body.offerKey === "string" ? body.offerKey : "";
        if (!offerKey) return NextResponse.json({ error: "offerKey required" }, { status: 400 });
        await adminGrantOffer(admin, targetId, offerKey);
        break;
      }
      case "suspend":
        await suspendUser(admin, targetId, reason);
        break;
      case "ban":
        await banUser(admin, targetId, reason);
        break;
      case "unban":
      case "restore":
        await restoreUser(admin, targetId);
        break;
      case "soft_delete":
        await softDeleteUser(admin, targetId, reason);
        break;
      case "hard_delete":
        if (admin.role !== "super_admin") return NextResponse.json({ error: "super_admin required" }, { status: 403 });
        await hardDeleteUser(admin, targetId);
        break;
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[admin] user action failed:", e);
    if (isPersistenceNotFound(e)) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Action failed." }, { status: 500 });
  }
}
