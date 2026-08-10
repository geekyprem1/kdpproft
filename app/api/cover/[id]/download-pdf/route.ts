import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, getAccountSession } from "@/lib/supabase/server";
import { getBytes, isCanonicalCoverVariationObjectKey } from "@/lib/storage";
import { renderPdf } from "@/lib/pdf/render";
import { rateLimit, rateLimitResponse } from "@/lib/util/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || "cover";
const BLEED = 0.125;

function parseTrim(trim: string): { w: number; h: number } {
  const [w, h] = (trim || "6x9").split("x").map((n) => parseFloat(n));
  return { w: Number.isFinite(w) ? w : 6, h: Number.isFinite(h) ? h : 9 };
}

/** Front-cover, KDP-ready PDF: the concept image full-bleed at the chosen trim. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = Number(req.nextUrl.searchParams.get("v") ?? "0");
  const supabase = await createSupabaseServerClient();
  const account = await getAccountSession(supabase);
  if (account.kind === "unauthenticated") {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (account.kind !== "active") {
    return NextResponse.json({ error: "Account is not active" }, { status: 403 });
  }
  const { user } = account;
  const rl = rateLimit(`dl-coverpdf:${user.id}`, 20);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterSec);

  const { data: cover } = await supabase.from("covers").select("title, trim, variation_keys").eq("id", id).single();
  if (!cover) return NextResponse.json({ error: "Cover not found" }, { status: 404 });
  const keys = (cover.variation_keys as string[]) ?? [];
  const variation = Number.isInteger(v) && v >= 0 ? v : -1;
  if (variation < 0) return NextResponse.json({ error: "Invalid variation" }, { status: 400 });
  const key = keys[variation];
  if (!key || !isCanonicalCoverVariationObjectKey(key, user.id, id, variation)) {
    return NextResponse.json({ error: "Concept not found" }, { status: 404 });
  }

  const { w, h } = parseTrim((cover.trim as string) ?? "6x9");
  const widthIn = w + 2 * BLEED;
  const heightIn = h + 2 * BLEED;
  const dataUri = `data:image/png;base64,${Buffer.from(await getBytes(key)).toString("base64")}`;
  const html = `<!doctype html><html><head><style>
    @page{size:${widthIn}in ${heightIn}in;margin:0}
    html,body{margin:0;padding:0}
    img{display:block;width:${widthIn}in;height:${heightIn}in;object-fit:cover}
  </style></head><body><img src="${dataUri}"/></body></html>`;

  const pdf = await renderPdf(html, { widthIn, heightIn });
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${slug(cover.title as string)}-cover.pdf"`,
      // Artifact caching: let the browser reuse a freshly built PDF instead of
      // re-triggering a Puppeteer render on repeat downloads.
      "Cache-Control": "private, max-age=60",
    },
  });
}
