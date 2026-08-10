"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const GOLD = "#C9A84C";

function OpenIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4">
      <path d="M4 12L12 4" strokeLinecap="round" />
      <path d="M6 4h6v6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" className="h-4 w-4">
      <path d="M2.5 4.5h11" strokeLinecap="round" />
      <path d="M6.5 4.5V3a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v1.5" strokeLinecap="round" />
      <path d="M4 4.5l.6 8a1 1 0 0 0 1 .9h4.8a1 1 0 0 0 1-.9l.6-8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.8 7v4M9.2 7v4" strokeLinecap="round" />
    </svg>
  );
}

export interface StyleOption {
  key: string;
  label: string;
  blurb: string;
}
export interface CoverListItem {
  id: string;
  title: string;
  createdAt: string;
  thumb: string | null;
}
interface Attempt {
  strategy: string;
  ok: boolean;
  reason?: string;
}
export interface PreviewVariation {
  index: number;
  url: string;
  textSource: "model" | "hybrid";
  attempts: Attempt[];
  concept?: string;
}
export interface CoverPreview {
  id: string;
  title: string;
  subtitle?: string;
  author?: string;
  style?: string;
  variations: PreviewVariation[];
}

const GENRES = [
  { value: "business", label: "Business" },
  { value: "self_help", label: "Self Help" },
  { value: "puzzle", label: "Puzzle Book" },
  { value: "kids", label: "Kids Book" },
  { value: "coloring", label: "Coloring Book" },
  { value: "fiction", label: "Fiction" },
];
const TRIMS = ["6x9", "8x10", "8.5x11"];

const field =
  "mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none";
const label = "block text-[13px] font-medium text-neutral-700";

/** Compact relative time, matching how the covers list reads elsewhere. */
function timeAgo(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  const steps: Array<[number, string]> = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [7, "day"],
    [4.35, "week"],
    [12, "month"],
  ];
  let value = seconds;
  let unit = "second";
  for (const [size, name] of steps) {
    if (value < size) {
      unit = name;
      break;
    }
    value /= size;
    unit = name;
  }
  const n = Math.floor(value);
  if (unit === "second" && n < 30) return "just now";
  return `${n} ${unit}${n === 1 ? "" : "s"} ago`;
}

export function CoverV2Studio({
  styles,
  defaultModel,
  credits,
  balance,
  covers,
  initialPreview,
}: {
  styles: StyleOption[];
  defaultModel: string;
  credits: number;
  balance: number;
  covers: CoverListItem[];
  initialPreview: CoverPreview | null;
}) {
  const router = useRouter();

  const [title, setTitle] = useState(initialPreview?.title ?? "");
  const [subtitle, setSubtitle] = useState(initialPreview?.subtitle ?? "");
  const [author, setAuthor] = useState(initialPreview?.author ?? "");
  const [niche, setNiche] = useState("");
  const [genre, setGenre] = useState("business");
  const [trim, setTrim] = useState("6x9");
  const [style, setStyle] = useState(styles[0]?.key ?? "clean_modern");
  const [model, setModel] = useState(defaultModel);
  const [hybridOnly, setHybridOnly] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<CoverPreview | null>(initialPreview);
  const [active, setActive] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const current = preview?.variations[active] ?? preview?.variations[0] ?? null;

  // Opening a cover changes the search param, which is a soft navigation: this
  // component stays mounted, so the initial useState value never runs again. Sync on
  // the id — not the object, which is new on every server render.
  const openedId = initialPreview?.id;
  useEffect(() => {
    if (initialPreview && openedId) {
      setPreview(initialPreview);
      setActive(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openedId]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightboxOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [lightboxOpen]);

  /**
   * Closing also drops ?cover= from the URL. Without that, reopening the same cover
   * would not be a navigation at all and the panel would stay shut.
   */
  function closePreview() {
    setPreview(null);
    router.replace("/dashboard/cover-v2", { scroll: false });
  }

  async function generate() {
    if (!title.trim()) {
      setError("Enter a book title first.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/cover-v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          subtitle: subtitle || undefined,
          author: author || undefined,
          niche: niche || undefined,
          genre,
          trim,
          style,
          model,
          hybridOnly,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Cover generation failed.");
        return;
      }
      setPreview({
        id: json.id,
        title,
        subtitle: subtitle || undefined,
        author: author || undefined,
        style: json.style,
        variations: json.variations,
      });
      setActive(0);
      // Refresh so the new cover appears in the list and the balance updates.
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this cover? The image files are removed too.")) return;
    setDeleting(id);
    setError(null);
    try {
      const res = await fetch(`/api/cover-v2/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setError(json?.error ?? "Could not delete the cover.");
        return;
      }
      if (preview?.id === id) setPreview(null);
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      {/* ── left: the form ── */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-neutral-800">Cover details</h2>

        <div className="mt-4 space-y-4">
          <div>
            <label className={label}>Book title *</label>
            <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="The Anxiety Reset" />
          </div>
          <div>
            <label className={label}>Subtitle (optional)</label>
            <input className={field} value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="A 30-Day Plan for Calm" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={label}>Niche / topic</label>
              <p className="text-[11px] text-neutral-400">Guides what the AI illustrates.</p>
              <input className={field} value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="Mental health, mindfulness" />
            </div>
            <div>
              <label className={label}>Author name</label>
              <p className="text-[11px] text-neutral-400">Will appear on the cover.</p>
              <input className={field} value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Jane Doe" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={label}>Genre</label>
              <select className={field} value={genre} onChange={(e) => setGenre(e.target.value)}>
                {GENRES.map((g) => (
                  <option key={g.value} value={g.value}>{g.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>Trim size</label>
              <select className={field} value={trim} onChange={(e) => setTrim(e.target.value)}>
                {TRIMS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ── visual style ── */}
        <div className="mt-6">
          <div className="text-[13px] font-medium text-neutral-700">Visual style</div>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {styles.map((s) => {
              const on = s.key === style;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setStyle(s.key)}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    on ? "border-neutral-900 bg-neutral-50" : "border-neutral-200 hover:border-neutral-400"
                  }`}
                >
                  <div className="text-[13px] font-medium text-neutral-900">{s.label}</div>
                  <div className="mt-0.5 text-[11px] text-neutral-500">{s.blurb}</div>
                </button>
              );
            })}
          </div>
        </div>

        <label className="mt-5 flex items-start gap-2 rounded-lg border border-neutral-200 p-3 text-[13px] text-neutral-700">
          <input
            type="checkbox"
            checked={hybridOnly}
            onChange={(e) => setHybridOnly(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Set the type with the stable engine
            <span className="block text-[11px] text-neutral-400">
              The model paints wordless artwork and our own typography engine adds the text, so
              the spelling is always correct. Use this if the model keeps mangling the title.
            </span>
          </span>
        </label>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <button
          onClick={generate}
          disabled={busy}
          className="mt-5 w-full rounded-lg px-4 py-3 text-sm font-bold text-black transition-opacity disabled:opacity-50"
          style={{ backgroundColor: GOLD }}
        >
          {busy ? "Generating… this can take a minute or two" : "Generate Cover"}
        </button>
        <p className="mt-2 text-center text-[11px] text-neutral-400">
          Costs {credits} credits — you have {balance.toLocaleString()}
        </p>
      </div>

      {/* ── right: preview, or the covers list ── */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm lg:sticky lg:top-6 lg:self-start">
        {preview ? (
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-neutral-800">Preview</h2>
              <button
                onClick={closePreview}
                className="text-[11px] text-neutral-400 hover:underline"
              >
                Your covers →
              </button>
            </div>

            {!current ? (
              <p className="mt-3 text-[13px] text-neutral-500">
                This cover&apos;s image files are unavailable. It may not have finished
                generating — try deleting it and generating again.
              </p>
            ) : (
              <>
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              className="mt-3 block w-full cursor-zoom-in rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2"
              aria-label="Open full-size cover preview"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={current.url}
                alt={preview.title}
                className="w-full rounded-lg border border-neutral-200"
              />
            </button>

            {preview.variations.length > 1 && (
              <div className="mt-2 flex gap-2">
                {preview.variations.map((v) => (
                  <button
                    key={v.index}
                    onClick={() => setActive(v.index)}
                    className={`overflow-hidden rounded border ${
                      v.index === active ? "border-neutral-900" : "border-neutral-200 opacity-70"
                    }`}
                    style={{ width: 46 }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={v.url} alt={`Concept ${v.index + 1}`} className="block w-full" />
                  </button>
                ))}
              </div>
            )}

            <div className="mt-3">
              <p className="text-[13px] font-semibold text-neutral-900">{preview.title}</p>
              {preview.subtitle && <p className="text-[12px] text-neutral-600">{preview.subtitle}</p>}
              {preview.author && <p className="text-[12px] text-neutral-500">by {preview.author}</p>}
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                style={
                  current.textSource === "model"
                    ? { background: "#dcfce7", color: "#166534" }
                    : { background: `${GOLD}22`, color: "#8a6d1f" }
                }
              >
                {current.textSource === "model" ? "Type by model" : "Type by stable engine"}
              </span>
              {preview.style && (
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-500">
                  {preview.style}
                </span>
              )}
            </div>

            {/* The failed attempts are the clearest signal of how well a model spells,
                which is the thing being compared while the Beta is being evaluated. */}
            {current.attempts.some((a) => !a.ok) && (
              <ul className="mt-2 space-y-0.5 text-[11px] text-neutral-500">
                {current.attempts.filter((a) => !a.ok).map((a, i) => (
                  <li key={i}>✗ {a.strategy}: {a.reason}</li>
                ))}
              </ul>
            )}

            <a
              href={`/api/cover/${preview.id}/download?v=${current.index}`}
              className="mt-4 flex items-center justify-center gap-1.5 text-[13px] font-medium text-neutral-700 hover:underline"
            >
              ⤓ Download cover image
            </a>
            <a
              href={`/api/cover/${preview.id}/download-pdf?v=${current.index}`}
              className="mt-2 flex items-center justify-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-2 text-[13px] font-medium text-neutral-800 hover:bg-neutral-50"
            >
              Generate print PDF
            </a>
            <Link
              href={`/dashboard/cover/${preview.id}`}
              className="mt-3 block text-center text-[11px] text-neutral-400 hover:underline"
            >
              Open in the cover library
            </Link>
              </>
            )}
          </div>
        ) : (
          <div>
            <h2 className="text-sm font-semibold text-neutral-800">Your covers</h2>
            {covers.length === 0 ? (
              <p className="mt-3 text-[13px] text-neutral-500">
                Nothing here yet. Generate your first cover and it will appear in this list.
              </p>
            ) : (
              <ul className="mt-3 space-y-1">
                {covers.map((c) => (
                  <li key={c.id} className="flex items-center rounded-lg hover:bg-neutral-50">
                    {/* The whole row opens the cover — a 16px arrow is a poor click target.
                        Delete stays outside the link so it cannot be hit by accident. */}
                    <Link
                      href={`/dashboard/cover-v2?cover=${c.id}`}
                      aria-label={`Open ${c.title}`}
                      className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1.5"
                    >
                      {c.thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={c.thumb}
                          alt=""
                          className="h-11 w-8 shrink-0 rounded border border-neutral-200 object-cover"
                        />
                      ) : (
                        <div className="h-11 w-8 shrink-0 rounded border border-neutral-200 bg-neutral-100" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-neutral-900">{c.title}</p>
                        <p className="text-[11px] text-neutral-400">{timeAgo(c.createdAt)}</p>
                      </div>
                      <span className="shrink-0 p-1 text-neutral-400" aria-hidden>
                        <OpenIcon />
                      </span>
                    </Link>
                    <button
                      onClick={() => remove(c.id)}
                      disabled={deleting === c.id}
                      title="Delete"
                      aria-label={`Delete ${c.title}`}
                      className="mr-1 shrink-0 rounded p-1 text-neutral-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                    >
                      <TrashIcon />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {lightboxOpen && current && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Full-size cover preview"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 sm:p-8"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setLightboxOpen(false);
          }}
        >
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            className="absolute right-4 top-4 rounded-full bg-white/90 px-3 py-1.5 text-lg leading-none text-neutral-900 shadow hover:bg-white focus:outline-none focus:ring-2 focus:ring-white"
            aria-label="Close full-size cover preview"
          >
            ×
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={current.url}
            alt={preview?.title ?? "Full-size cover preview"}
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
          />
        </div>
      )}
    </div>
  );
}
