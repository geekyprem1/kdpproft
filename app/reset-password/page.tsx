"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Logo } from "@/components/brand/logo";

/**
 * Password reset landing page.
 *
 * The recovery email link (sent via resetPasswordForEmail / Supabase dashboard
 * "Send password recovery") lands here. Supabase establishes a short-lived
 * recovery session from the URL fragment, which fires a PASSWORD_RECOVERY auth
 * event. Once that session exists, the user can set a new password with
 * supabase.auth.updateUser. If no recovery session is present (e.g. the link
 * expired or the page was opened directly), we tell the user to request a fresh
 * link rather than silently failing.
 */
export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [canReset, setCanReset] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function client() {
    try {
      return createSupabaseBrowserClient();
    } catch {
      setError("Authentication is not configured yet (missing Supabase env vars).");
      return null;
    }
  }

  // Detect the recovery session created from the email link.
  useEffect(() => {
    const supabase = client();
    if (!supabase) {
      setReady(true);
      return;
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setCanReset(true);
        setReady(true);
      }
    });

    // The event may have already fired before we subscribed; also check for an
    // existing session so a valid recovery link still works on fast loads.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setCanReset(true);
      setReady(true);
    });

    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      return setError("Password must be at least 6 characters.");
    }
    if (password !== confirm) {
      return setError("Passwords do not match.");
    }

    setBusy(true);
    const supabase = client();
    if (!supabase) return setBusy(false);

    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setError(error.message);
    setDone(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F4F7FE] px-8 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo variant="light" className="h-10 text-base" />
        </div>

        <h1 className="text-2xl font-bold text-neutral-900">Set a new password</h1>

        {!ready ? (
          <p className="mt-4 text-sm text-neutral-500">Loading…</p>
        ) : done ? (
          <div className="mt-8 space-y-4">
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
              Your password has been updated. You can now sign in with it.
            </div>
            <a
              href="/login"
              className="block w-full rounded-lg bg-black px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-neutral-800 transition-colors"
            >
              Go to sign in
            </a>
          </div>
        ) : !canReset ? (
          <div className="mt-8 space-y-4">
            <p className="text-sm text-neutral-500">
              This reset link is invalid or has expired. Request a new one from the
              sign-in page.
            </p>
            <a
              href="/login"
              className="block w-full rounded-lg bg-black px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-neutral-800 transition-colors"
            >
              Back to sign in
            </a>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        ) : (
          <>
            <p className="mt-1 text-sm text-neutral-500">
              Enter a new password for your account.
            </p>
            <form onSubmit={submit} className="mt-8 space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-600">
                  New password
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 placeholder-neutral-400 shadow-sm focus:border-neutral-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-600">
                  Confirm new password
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 placeholder-neutral-400 shadow-sm focus:border-neutral-500 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 transition-colors"
              >
                {busy ? "Updating…" : "Update password"}
              </button>
            </form>
            {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}
