/**
 * Admin roles + access control.
 *
 * Roles live in profiles.role (user|admin|super_admin). The first super_admin is
 * bootstrapped via the SUPER_ADMIN_EMAILS env allowlist: any logged-in user whose
 * email is on that list is treated as super_admin and self-healed into the DB on
 * first resolve. This means a founder can always regain access without touching
 * the database, and the allowlist is never committed to git.
 */

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../supabase/server";
import { getSupabaseAdminClient } from "../supabase/admin";

export type Role = "user" | "admin" | "super_admin";
export type AccountStatus = "active" | "suspended" | "banned" | "deleted";

export interface AdminIdentity {
  userId: string;
  email: string;
  role: Role;
}

/** Founder emails that are always treated as super_admin (comma-separated env). */
export function superAdminEmails(): string[] {
  return (process.env.SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function isAdminRole(role: string | null | undefined): role is "admin" | "super_admin" {
  return role === "admin" || role === "super_admin";
}

/**
 * Resolve the current admin identity, or null if the caller is not an admin.
 * Applies the env-allowlist bootstrap (promotes allowlisted founders to
 * super_admin in the DB on first call). Safe to call from pages and API routes.
 */
export async function resolveAdmin(): Promise<AdminIdentity | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const email = user.email.toLowerCase();
  const allowlisted = superAdminEmails().includes(email);

  // Read role and status together. Missing rows and lookup failures fail closed,
  // and the allowlist never overrides a disabled account.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, account_status")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError || !profile || profile.account_status !== "active") return null;
  let role = (profile.role as Role | undefined) ?? "user";

  // Bootstrap: active founder on the allowlist is always super_admin; self-heal the DB.
  if (allowlisted && role !== "super_admin") {
    try {
      await getSupabaseAdminClient()
        .from("profiles")
        .update({ role: "super_admin" })
        .eq("id", user.id);
    } catch {
      /* best-effort; allowlist still grants access this request */
    }
    role = "super_admin";
  }

  if (!isAdminRole(role)) return null;
  return { userId: user.id, email, role };
}

/** Page guard: redirect non-admins to the dashboard. Returns the admin identity. */
export async function requireAdmin(): Promise<AdminIdentity> {
  const admin = await resolveAdmin();
  if (!admin) redirect("/dashboard");
  return admin;
}

/** Page guard: super_admin only. */
export async function requireSuperAdmin(): Promise<AdminIdentity> {
  const admin = await resolveAdmin();
  if (!admin || admin.role !== "super_admin") redirect("/admin");
  return admin;
}
