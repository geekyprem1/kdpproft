/**
 * Admin audit log — records every privileged admin action. Append-only; read in
 * /admin/audit. Inserts use the service-role client (RLS allows admin read only).
 */

import { getSupabaseAdminClient } from "../supabase/admin";
import { requireMutationRow } from "../supabase/errors";
import type { AdminIdentity } from "./roles";

export type AdminAction =
  | "create_user"
  | "grant_credits"
  | "remove_credits"
  | "change_plan"
  | "grant_offer"
  | "refund"
  | "dfy_upload"
  | "dfy_delete"
  | "dfy_publish"
  | "suspend"
  | "ban"
  | "unban"
  | "soft_delete"
  | "hard_delete"
  | "restore_user"
  | "set_role"
  | "retry_job"
  | "delete_job"
  | "delete_book"
  | "ticket_reply"
  | "ticket_status";

export type AdminTargetType = "user" | "job" | "book" | "ticket" | "subscription" | "dfy_asset";

export async function logAdminAction(
  actor: AdminIdentity,
  action: AdminAction,
  opts: { targetType?: AdminTargetType; targetId?: string; detail?: Record<string, unknown> } = {}
): Promise<void> {
  try {
    const result = await getSupabaseAdminClient().from("admin_audit_log").insert({
      actor_id: actor.userId,
      actor_email: actor.email,
      action,
      target_type: opts.targetType ?? null,
      target_id: opts.targetId ?? null,
      detail: opts.detail ?? {},
    }).select("id").single();
    requireMutationRow(result, "Write admin audit log");
  } catch (e) {
    // Auditing must never break the action it records — log and continue.
    console.error("[admin] audit log failed:", e);
  }
}
