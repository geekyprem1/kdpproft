import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, getAccountSession } from "@/lib/supabase/server";
import { getBytes, isCanonicalCoverVariationObjectKey } from "@/lib/storage";
import { renderPdf } from "@/lib/pdf/render";
import { rateLimit, rateLimitResponse } from "@/lib/util/rate-limit";
import { escapeHtml } from "@/lib/html/escape";
import {
  computeCover,
  MIN_PAGE_COUNT,
  type PaperStock,
  type TrimSize,
  TRIM_SIZES,
} from "@/lib/pdf/kdp-specs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || "cover";

/** KDP max interior page count for a paperback. */
const MAX_PAGE_COUNT = 828;
const PAPERS: PaperStock[] = ["white", "cream", "color-standard", "color-premium"];

function parsePaper(v: string | null): PaperStock {
  return v && (PAPERS as string[]).includes(v) ? (v as PaperStock) : "white";
}

function parseTrim(v: string | null): TrimSize {
  return v && v in TRIM_SIZES ? (v as TrimSize) : "6x9";
}

/** Clamp page count into the KDP-valid range so the spine math stays sane. */
function parsePages(v: string | null): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return 120;
  return Math.min(MAX_PAGE_COUNT, Math.max(MIN_PAGE_COUNT, n));
}

/** #rgb / #rrggbb → normalized #rrggbb, else fallback. */
function parseHex(v: string | null, fallback: string): string {
  if (!v) return fallback;
  const s = v.startsWith("#") ? v : `#${v}`;
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`.toLowerCase();
  }
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
  return fallback;
}

/** Readable text color (black/white) for a given background, via relative luminance. */
function textOn(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.4 ? "#111111" : "#ffffff";
}

/** Slightly darken a hex color (for the spine, to read as a distinct fold). */
function darken(hex: string, amount = 0.12): string {
  const ch = (i: number) =>
    Math.max(0, Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - amount)))
      .toString(16)
      .padStart(2, "0");
  return `#${ch(1)}${ch(3)}${ch(5)}`;
}

/**
 * Print-ready WRAPAROUND cover PDF (back | spine | front) for KDP paperbacks.
 *
 * The front panel is the generated concept art (which already carries its own
 * title/author). The spine width is computed from the buyer's page count + paper
 * stock, and the back/spine share a chosen solid color so the wrap reads as one
 * cover. The bottom-right of the back panel is left clear for KDP's barcode.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sp = req.nextUrl.searchParams;
  const v = Number(sp.get("v") ?? "0");

  const supabase = await createSupabaseServerClient();
  const account = await getAccountSession(supabase);
  if (account.kind === "unauthenticated") {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (account.kind !== "active") {
    return NextResponse.json({ error: "Account is not active" }, { status: 403 });
  }
  const { user } = account;
  const rl = rateLimit(`dl-coverwrap:${user.id}`, 20);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterSec);

  const { data: cover } = await supabase
    .from("covers")
    .select("title, subtitle, author, trim, variation_keys")
    .eq("id", id)
    .single();
  if (!cover) return NextResponse.json({ error: "Cover not found" }, { status: 404 });

  const keys = (cover.variation_keys as string[]) ?? [];
  const variation = Number.isInteger(v) && v >= 0 ? v : -1;
  if (variation < 0) return NextResponse.json({ error: "Invalid variation" }, { status: 400 });
  const key = keys[variation];
  if (!key || !isCanonicalCoverVariationObjectKey(key, user.id, id, variation)) {
    return NextResponse.json({ error: "Concept not found" }, { status: 404 });
  }

  const trim = parseTrim((cover.trim as string) ?? "6x9");
  const pageCount = parsePages(sp.get("pages"));
  const paper = parsePaper(sp.get("paper"));
  const bg = parseHex(sp.get("bg"), "#1a1a1a");
  const spineBg = darken(bg);
  const fg = textOn(bg);

  const spec = computeCover({ trim, pageCount, paper });

  const title = escapeHtml((cover.title as string) ?? "");
  const subtitle = escapeHtml((cover.subtitle as string) ?? "");
  const author = escapeHtml((cover.author as string) ?? "");
  const dataUri = `data:image/png;base64,${Buffer.from(await getBytes(key)).toString("base64")}`;

  // Front panel spans the front trim + the outer/top/bottom bleed; the art already
  // includes its own bleed, so object-fit:cover only trims a sliver.
  const frontLeft = spec.spineStartIn + spec.spineWidthIn; // = frontStartIn
  const frontWidth = spec.fullWidthIn - frontLeft;
  // Clearance from trim/fold edges for text. 0.5in keeps letters well clear of the
  // trim tolerance so nothing looks clipped at the edge.
  const SAFE = 0.5;
  const backTextWidth = Math.max(1, spec.panelWidthIn - 2 * SAFE - spec.bleedIn);

  const spineText = spec.allowsSpineText
    ? `<div class="spine-text">${title}${author ? ` &nbsp;&middot;&nbsp; ${author}` : ""}</div>`
    : "";

  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: ${spec.fullWidthIn}in ${spec.fullHeightIn}in; margin: 0; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    html, body { margin: 0; padding: 0; }
    .cover { position: relative; width: ${spec.fullWidthIn}in; height: ${spec.fullHeightIn}in;
             background: ${bg}; color: ${fg}; font-family: Arial, Helvetica, sans-serif; overflow: hidden; }
    .panel { position: absolute; top: 0; height: 100%; }
    /* BACK */
    .back { left: 0; width: ${spec.spineStartIn}in; padding: ${SAFE + spec.bleedIn}in ${SAFE}in ${SAFE}in ${SAFE + spec.bleedIn}in; }
    .back h3 { margin: 0 0 0.12in; font-size: 15pt; line-height: 1.2; max-width: ${backTextWidth}in; }
    .back p { margin: 0; font-size: 10.5pt; line-height: 1.5; opacity: 0.9; max-width: ${backTextWidth}in; }
    .back .by { margin-top: 0.2in; font-size: 10pt; opacity: 0.75; }
    /* SPINE */
    .spine { left: ${spec.spineStartIn}in; width: ${spec.spineWidthIn}in; background: ${spineBg};
             display: flex; align-items: center; justify-content: center; }
    .spine-text { transform: rotate(90deg); white-space: nowrap; font-size: 10pt; letter-spacing: 0.01in; font-weight: 600; }
    /* FRONT — generated art, full bleed */
    .front { left: ${frontLeft}in; width: ${frontWidth}in; }
    .front img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: center; }
  </style></head><body>
    <div class="cover">
      <!-- Back text sits up top; the bottom ~1.2in stays clear for KDP's barcode. -->
      <div class="panel back">
        ${title ? `<h3>${title}</h3>` : ""}
        ${subtitle ? `<p>${subtitle}</p>` : ""}
        ${author ? `<div class="by">${author}</div>` : ""}
      </div>
      <div class="panel spine">${spineText}</div>
      <div class="panel front"><img src="${dataUri}" alt="" /></div>
    </div>
  </body></html>`;

  const pdf = await renderPdf(html, { widthIn: spec.fullWidthIn, heightIn: spec.fullHeightIn });
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${slug(cover.title as string)}-wraparound-${pageCount}pp.pdf"`,
      "Cache-Control": "private, max-age=60",
    },
  });
}
