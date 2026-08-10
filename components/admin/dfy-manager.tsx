"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const CATEGORIES = ["puzzle", "coloring", "lowcontent", "workbook", "bundle", "general"];

export interface AdminDfyAsset {
  id: string;
  title: string;
  category: string;
  description: string | null;
  file_name: string;
  file_size: number;
  is_published: boolean;
  created_at: string;
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DfyManager({ assets }: { assets: AdminDfyAsset[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("puzzle");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) return setError("Title is required.");
    if (!file) return setError("Choose a file to upload.");

    const form = new FormData();
    form.set("title", title.trim());
    form.set("category", category);
    form.set("description", description.trim());
    form.set("file", file);

    setBusy(true);
    try {
      const res = await fetch("/api/admin/dfy", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Upload failed.");
        return;
      }
      setTitle("");
      setDescription("");
      setFile(null);
      (document.getElementById("dfy-file") as HTMLInputElement | null)?.value &&
        ((document.getElementById("dfy-file") as HTMLInputElement).value = "");
      router.refresh();
    } catch {
      setError("Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function togglePublish(a: AdminDfyAsset) {
    await fetch(`/api/admin/dfy/${a.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ published: !a.is_published }),
    });
    router.refresh();
  }

  async function remove(a: AdminDfyAsset) {
    if (!confirm(`Delete "${a.title}"? This removes the file permanently.`)) return;
    await fetch(`/api/admin/dfy/${a.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-8">
      {/* Upload form */}
      <form onSubmit={upload} className="rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-neutral-700">Add a DFY asset</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium text-neutral-600">
            Title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
              placeholder="e.g. Word Search for Adults — Animals"
            />
          </label>
          <label className="text-xs font-medium text-neutral-600">
            Category
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="mt-3 block text-xs font-medium text-neutral-600">
          Description (optional)
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="mt-3 block text-xs font-medium text-neutral-600">
          File (PDF / ZIP / image · max 50 MB)
          <input
            id="dfy-file"
            type="file"
            accept=".pdf,.zip,.png,.jpg,.jpeg"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1 block w-full text-sm"
          />
        </label>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="mt-4 rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          {busy ? "Uploading…" : "Upload asset"}
        </button>
      </form>

      {/* Asset list */}
      <div>
        <h2 className="text-sm font-semibold text-neutral-700">
          Library ({assets.length})
        </h2>
        {assets.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">No assets yet. Upload the first one above.</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-neutral-500">
                <th className="py-2 font-medium">Title</th>
                <th className="py-2 font-medium">Category</th>
                <th className="py-2 font-medium">Size</th>
                <th className="py-2 font-medium">Status</th>
                <th className="py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => (
                <tr key={a.id} className="border-b border-neutral-100">
                  <td className="py-2">
                    <div className="font-medium text-neutral-800">{a.title}</div>
                    <div className="text-xs text-neutral-400">{a.file_name}</div>
                  </td>
                  <td className="py-2 text-neutral-600">{a.category}</td>
                  <td className="py-2 text-neutral-600">{fmtSize(a.file_size)}</td>
                  <td className="py-2">
                    <span className={a.is_published ? "text-green-700" : "text-neutral-400"}>
                      {a.is_published ? "Published" : "Hidden"}
                    </span>
                  </td>
                  <td className="py-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => togglePublish(a)}
                        className="rounded border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-50"
                      >
                        {a.is_published ? "Hide" : "Publish"}
                      </button>
                      <button
                        onClick={() => remove(a)}
                        className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
