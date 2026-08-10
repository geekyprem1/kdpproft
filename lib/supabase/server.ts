/**
 * Server-side Supabase client (cookie-based auth via @supabase/ssr).
 * Use in server components, route handlers, and server actions.
 */

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export type AccountStatus = "active" | "suspended" | "banned" | "deleted";

export type AccountSession =
  | { kind: "active"; user: User; status: "active" }
  | { kind: "inactive"; user: User; status: Exclude<AccountStatus, "active"> }
  | { kind: "unauthenticated" }
  | { kind: "unavailable" };

export async function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  const cookieStore = await cookies();

  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // In server components, setting cookies throws — middleware refreshes
        // the session instead, so it's safe to ignore here.
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          /* called from a server component; ignore */
        }
      },
    },
  });
}

/**
 * Resolve the authenticated account and its server-managed status.
 * Profile lookup failures and missing rows deliberately fail closed.
 */
export async function getAccountSession(
  supabase?: SupabaseClient
): Promise<AccountSession> {
  const client = supabase ?? await createSupabaseServerClient();
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) return { kind: "unauthenticated" };

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("account_status")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError || !profile) return { kind: "unavailable" };

  const status = profile.account_status as AccountStatus;
  if (status !== "active") {
    return { kind: "inactive", user, status };
  }
  return { kind: "active", user, status };
}

/** Convenience: the currently authenticated active user, or null. */
export async function getCurrentUser() {
  const account = await getAccountSession();
  return account.kind === "active" ? account.user : null;
}
