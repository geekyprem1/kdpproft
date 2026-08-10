"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function client() {
    try {
      return createSupabaseBrowserClient();
    } catch {
      setError("Authentication is not configured yet (missing Supabase env vars).");
      return null;
    }
  }

  // Auth redirect base. Prefer the public env (works in confirmation emails even
  // if the user starts the flow from localhost or a preview domain); fall back to
  // the browser origin when unset (dev / unconfigured).
  const authBase =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ||
    (typeof window !== "undefined" ? window.location.origin : "");
  const callback = `${authBase}/auth/callback?next=/dashboard`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const supabase = client();
    if (!supabase) return setBusy(false);

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: callback },
      });
      setBusy(false);
      if (error) return setError(error.message);
      // If email confirmation is on, there's no active session yet.
      if (!data.session) return setSent(true);
      window.location.href = "/dashboard";
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      setBusy(false);
      if (error) return setError(error.message);
      window.location.href = "/dashboard";
    }
  }

  return (
    <div className="flex min-h-screen">

      {/* ── Left panel — black ── */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-black p-12">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="KDP Mafia" className="h-20 w-auto" />
        </div>

        <div>
          <div className="inline-block rounded-full border border-[#C9A84C]/40 bg-[#C9A84C]/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-[#C9A84C]">
            The Publishing OS
          </div>

          <h2 className="mt-4 text-3xl font-bold leading-tight text-white">
            Build a KDP Business.<br />
            Not Just a Book.
          </h2>

          <p className="mt-3 text-sm leading-relaxed text-white/50">
            One platform to research niches, create books, generate covers,
            and package everything for Amazon KDP — faster than ever.
          </p>

          <div className="mt-8 space-y-3">
            {[
              { icon: "◆", label: "Market Intelligence™", desc: "Discover profitable niches before you build" },
              { icon: "◆", label: "Publishing Studio", desc: "Word Search, Sudoku, Maze, Coloring & Ebooks" },
              { icon: "◆", label: "Cover Studio", desc: "AI-generated, genre-aware, KDP-ready covers" },
              { icon: "◆", label: "Launch Kit™", desc: "Metadata, keywords & checklist in one ZIP" },
            ].map((f) => (
              <div key={f.label} className="flex items-start gap-3">
                <span className="mt-0.5 text-[10px] text-[#C9A84C]">{f.icon}</span>
                <div>
                  <div className="text-sm font-semibold text-white">{f.label}</div>
                  <div className="text-xs text-white/40">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-white/20">
          KDP Mafia is an independent publishing software platform and is not affiliated with Amazon.
        </p>
      </div>

      {/* ── Right panel — cream ── */}
      <div className="flex flex-1 flex-col items-center justify-center bg-[#FBF7EE] px-8 py-12">
        {/* Mobile logo */}
        <div className="mb-8 lg:hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="KDP Mafia" className="h-16 w-auto" />
        </div>

        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold text-neutral-900">
            {mode === "signup" ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {mode === "signup"
              ? "Sign up to start building your KDP business."
              : "Sign in to continue building your KDP business."}
          </p>

          {sent ? (
            <div className="mt-8 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
              Almost there — we sent a confirmation link to <strong>{email}</strong>.
              Click it to activate your account, then sign in.
            </div>
          ) : (
            <form onSubmit={submit} className="mt-8 space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-600">
                  Email address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 placeholder-neutral-400 shadow-sm focus:border-neutral-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-600">
                  Password
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 placeholder-neutral-400 shadow-sm focus:border-neutral-500 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 transition-colors"
              >
                {busy
                  ? mode === "signup"
                    ? "Creating account…"
                    : "Signing in…"
                  : mode === "signup"
                    ? "Create account"
                    : "Sign in"}
              </button>
            </form>
          )}

          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

          {!sent && (
            <p className="mt-8 text-center text-xs text-neutral-500">
              {mode === "signup" ? "Already have an account?" : "Don't have an account?"}{" "}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "signup" ? "signin" : "signup");
                  setError(null);
                }}
                className="font-semibold text-neutral-900 underline underline-offset-2 hover:text-black"
              >
                {mode === "signup" ? "Sign in" : "Sign up"}
              </button>
            </p>
          )}
        </div>
      </div>

    </div>
  );
}
