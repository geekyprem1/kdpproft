"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/tickets", label: "Tickets" },
  { href: "/admin/jobs", label: "Jobs" },
  { href: "/admin/books", label: "Books" },
  { href: "/admin/dfy", label: "DFY Assets" },
  { href: "/admin/billing", label: "Billing" },
  { href: "/admin/audit", label: "Audit Log" },
];

export function AdminNav({ email, role }: { email: string; role: string }) {
  const pathname = usePathname();
  const active = (l: { href: string; exact?: boolean }) =>
    l.exact ? pathname === l.href : pathname.startsWith(l.href);

  return (
    <aside className="flex w-56 shrink-0 flex-col bg-black p-4 text-white">
      <Link href="/admin" className="block px-2 py-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="KDP Mafia" className="h-12 w-auto" />
        <span className="mt-2 block text-[10px] font-semibold uppercase tracking-widest text-[#C9A84C]">
          Admin Control
        </span>
      </Link>

      <nav className="mt-4 flex flex-1 flex-col gap-0.5">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`rounded px-3 py-2 text-sm transition-colors ${
              active(l)
                ? "bg-[#C9A84C] font-semibold text-black"
                : "text-white/60 hover:bg-white/10 hover:text-white"
            }`}
          >
            {l.label}
          </Link>
        ))}
      </nav>

      <div className="mt-4 border-t border-white/10 pt-3">
        <p className="truncate px-3 text-xs text-white/40">{email}</p>
        <p className="px-3 text-[10px] uppercase tracking-wide text-[#C9A84C]">{role}</p>
        <Link
          href="/dashboard"
          className="mt-2 block rounded px-3 py-2 text-sm text-white/50 hover:bg-white/10 hover:text-white"
        >
          ← Back to app
        </Link>
      </div>
    </aside>
  );
}
