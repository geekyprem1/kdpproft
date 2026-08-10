"use client";

import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function SignOutButton({ className, label = "Sign out" }: { className?: string; label?: string }) {
  const router = useRouter();
  async function signOut() {
    try {
      await createSupabaseBrowserClient().auth.signOut();
    } catch {
      /* ignore */
    }
    router.push("/login");
    router.refresh();
  }
  return (
    <button onClick={signOut} className={className}>
      {label}
    </button>
  );
}
