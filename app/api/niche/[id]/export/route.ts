import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { renderNicheReportPdf } from "@/lib/niche/report-pdf";
import type { NicheReport } from "@/lib/niche/types";
import { rateLimit, rateLimitResponse } from "@/lib/util/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const rl = rateLimit(`export-niche:${user.id}`, 20);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterSec);

  // RLS scopes this to the owner.
  const { data: report } = await supabase
    .from("niche_reports")
    .select("*")
    .eq("id", id)
    .single();

  if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });

  const pdf = await renderNicheReportPdf(report as NicheReport);
  const slug = (report.keyword as string)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40) || "niche-report";

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="niche-${slug}.pdf"`,
      // Niche reports are immutable once generated → cache the rebuilt PDF longer.
      "Cache-Control": "private, max-age=300",
    },
  });
}
