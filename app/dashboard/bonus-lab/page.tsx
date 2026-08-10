import { Download, Gift } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Shared drive that holds every bonus asset. Available to all users, no
// entitlement gating — these are complimentary resources for the whole base.
const BONUS_DOWNLOAD_URL =
  "https://drive.google.com/drive/folders/1XcoGqbyfp-SCPeZe-BWpIVQrZwWhvG1r?usp=sharing";

interface Bonus {
  image: string;
  title: string;
  description: string;
}

const BONUSES: Bonus[] = [
  {
    image: "/bonus-lab/seasonal-calendar.png",
    title: "12-Month Seasonal Publishing Calendar",
    description: "Plan, create, publish and profit all year long — never miss a season and target the perfect topics every month.",
  },
  {
    image: "/bonus-lab/evergreen-niches.png",
    title: "50 Evergreen Low-Content Niches Cheat-Sheet",
    description: "Timeless, high-demand niche ideas that are easy to create and perfect for consistent KDP passive income.",
  },
  {
    image: "/bonus-lab/pass-kdp-first-time.png",
    title: "Pass KDP First Time — Upload Checklist + Rejection Fix Guide",
    description: "A complete upload checklist plus the common rejection reasons and how to fix them, so you get approved with confidence.",
  },
  {
    image: "/bonus-lab/keyword-category-swipe.png",
    title: "KDP Keyword + Category Swipe File",
    description: "High-volume keywords and profitable, low-competition categories to help you rank and earn more royalties.",
  },
  {
    image: "/bonus-lab/first-book-24-hours.png",
    title: "First Book in 24 Hours — Quickstart Playbook",
    description: "A step-by-step system to plan, create and publish your first KDP book fast.",
  },
];

export default async function BonusLabPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center gap-2">
        <Gift className="h-6 w-6 text-neutral-900" />
        <h1 className="text-2xl font-bold text-neutral-900">Bonus Lab</h1>
      </div>
      <p className="mt-1 text-sm text-neutral-600">
        Free bonus resources for every member — download and put them to work today.
      </p>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        {BONUSES.map((b) => (
          <div key={b.title} className="flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={b.image} alt={b.title} className="aspect-square w-full bg-neutral-100 object-cover" />
            <div className="flex flex-1 flex-col p-5">
              <h3 className="font-semibold text-neutral-900">{b.title}</h3>
              <p className="mt-1 flex-1 text-sm text-neutral-500">{b.description}</p>
              <a
                href={BONUS_DOWNLOAD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-neutral-700"
              >
                <Download className="h-4 w-4" /> Download
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
