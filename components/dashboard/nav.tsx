"use client";

import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import {
  Home, TrendingUp, Wand2, SquarePen, Factory, Bot, Image as ImageIcon, Sparkles, ListChecks,
  Grid3x3, Hash, Waypoints, Grid2x2, Shuffle, KeyRound, Spline, Palette, Layers, PenLine,
  Calculator, BookOpen, NotebookPen, Library, Download, CreditCard, LifeBuoy, Settings,
  Zap, ShieldCheck, LogOut, Gift, Users, Store, FlaskConical, type LucideIcon,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Logo } from "@/components/brand/logo";

const GOLD = "#2563EB";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  type?: string;
}

const MAIN: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: Home },
  { href: "/dashboard/niche", label: "Profit Radar™", icon: TrendingUp },
  { href: "/dashboard/title-optimizer", label: "Title Lab", icon: Wand2 },
  { href: "/dashboard/create", label: "Book Studio", icon: SquarePen },
  { href: "/dashboard/bundle", label: "Profit Factory™", icon: Factory },
  { href: "/dashboard/autopilot", label: "Autopilot", icon: Bot },
  { href: "/dashboard/cover-v2", label: "Cover Studio", icon: ImageIcon },
  { href: "/dashboard/in-progress", label: "Production Queue", icon: ListChecks },
];

// Dedicated generator entries → unified Create wizard with the type preselected.
const GEN_GROUPS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Puzzle Books",
    items: [
      { href: "/dashboard/word-search", label: "Word Search", type: "word-search", icon: Grid3x3 },
      { href: "/dashboard/sudoku", label: "Sudoku", type: "sudoku", icon: Hash },
      { href: "/dashboard/maze", label: "Maze", type: "maze", icon: Waypoints },
      { href: "/dashboard/crossword", label: "Crossword", type: "crossword", icon: Grid2x2 },
      { href: "/dashboard/scramble", label: "Word Scramble", type: "scramble", icon: Shuffle },
      { href: "/dashboard/cryptogram", label: "Cryptogram", type: "cryptogram", icon: KeyRound },
      { href: "/dashboard/dot-to-dot", label: "Connect the Dots", type: "dot_to_dot", icon: Spline },
    ],
  },
  {
    label: "Kids & Learning",
    items: [
      { href: "/dashboard/coloring", label: "Coloring Book", type: "coloring", icon: Palette },
      { href: "/dashboard/activity", label: "Activity Book", type: "activity", icon: Layers },
      { href: "/dashboard/tracing", label: "Tracing Workbook", type: "tracing", icon: PenLine },
      { href: "/dashboard/math", label: "Math Workbook", type: "math", icon: Calculator },
      { href: "/dashboard/story", label: "Story Book", type: "story", icon: Sparkles },
    ],
  },
  {
    label: "Low-Content & Text",
    items: [
      { href: "/dashboard/lowcontent", label: "Journals & Planners", type: "lowcontent", icon: NotebookPen },
      { href: "/dashboard/ebook-creator", label: "Ebook Creator", type: "ebook", icon: BookOpen },
    ],
  },
];

const LIBRARY: NavItem[] = [
  { href: "/dashboard/books", label: "Publishing Vault™", icon: Library },
  { href: "/dashboard/dfy", label: "DFY Library", icon: Gift },
  { href: "/dashboard/bonus-lab", label: "Bonus Lab", icon: FlaskConical },
  { href: "/dashboard/downloads", label: "Asset Vault", icon: Download },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
  { href: "/dashboard/support", label: "Support", icon: LifeBuoy },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function DashboardNav({
  email,
  isAdmin = false,
  hasAgency = false,
  hasReseller = false,
}: {
  email?: string | null;
  isAdmin?: boolean;
  hasAgency?: boolean;
  hasReseller?: boolean;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const activeType = pathname === "/dashboard/create" ? params.get("type") : null;

  async function signOut() {
    try {
      await createSupabaseBrowserClient().auth.signOut();
    } catch {
      /* ignore */
    }
    router.push("/login");
    router.refresh();
  }

  const mainActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    if (href === "/dashboard/create") return pathname === "/dashboard/create" && !activeType;
    return pathname.startsWith(href);
  };
  const genActive = (g: NavItem) => pathname === g.href || activeType === g.type;

  const Row = ({ item, active }: { item: NavItem; active: boolean }) => {
    const Icon = item.icon;
    return (
      <Link
        href={item.href}
        className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
          active ? "bg-white/10 font-medium text-white" : "text-white/55 hover:bg-white/5 hover:text-white"
        }`}
      >
        {active && <span className="absolute left-0 top-1.5 h-[calc(100%-0.75rem)] w-0.5 rounded-full" style={{ background: GOLD }} />}
        <Icon className="h-[17px] w-[17px] shrink-0" style={active ? { color: GOLD } : undefined} />
        <span className="truncate">{item.label}</span>
      </Link>
    );
  };

  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <div className="mt-5 mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">{children}</div>
  );

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-white/10 bg-gradient-to-b from-[#0B1E3B] via-[#0A1830] to-[#071324]">
      <Link href="/dashboard" className="flex items-center justify-center gap-2 px-5 py-5">
        <Logo variant="dark" className="h-9 text-[15px]" />
      </Link>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-4">
        {MAIN.map((l) => (
          <Row key={l.href} item={l} active={mainActive(l.href)} />
        ))}

        {GEN_GROUPS.map((group) => (
          <div key={group.label}>
            <SectionLabel>{group.label}</SectionLabel>
            {group.items
              // Story Book is an admin-only internal tool — hidden from everyone else.
              .filter((g) => g.type !== "story" || isAdmin)
              .map((g) => (
                <Row key={g.href} item={g} active={genActive(g)} />
              ))}
          </div>
        ))}

        <SectionLabel>Vault</SectionLabel>
        {LIBRARY.map((l) => (
          <Row key={l.href} item={l} active={pathname.startsWith(l.href)} />
        ))}

        {(hasAgency || hasReseller) && (
          <>
            <SectionLabel>Your Add-ons</SectionLabel>
            {hasAgency && (
              <Row
                item={{ href: "/dashboard/agency", label: "Agency", icon: Users }}
                active={pathname.startsWith("/dashboard/agency")}
              />
            )}
            {hasReseller && (
              <Row
                item={{ href: "/dashboard/reseller", label: "Reseller", icon: Store }}
                active={pathname.startsWith("/dashboard/reseller")}
              />
            )}
          </>
        )}

        <Link
          href="/dashboard/upgrade"
          className="mt-4 flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
          style={{ background: `linear-gradient(135deg, ${GOLD}, #1D4ED8)` }}
        >
          <Zap className="h-4 w-4" /> Upgrade &amp; Add-ons
        </Link>
      </nav>

      <div className="border-t border-white/10 px-3 py-3">
        {isAdmin && (
          <Link href="/admin" className="mb-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold hover:bg-white/5" style={{ color: GOLD }}>
            <ShieldCheck className="h-[17px] w-[17px]" /> Admin Control
          </Link>
        )}
        {email && <p className="truncate px-3 py-1 text-xs text-white/30">{email}</p>}
        <button onClick={signOut} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-white/50 transition-colors hover:bg-white/5 hover:text-white">
          <LogOut className="h-[17px] w-[17px]" /> Sign out
        </button>
      </div>
    </aside>
  );
}
