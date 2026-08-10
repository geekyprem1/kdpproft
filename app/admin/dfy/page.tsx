import { resolveAdmin } from "@/lib/admin";
import { listDfyAssets } from "@/lib/dfy/assets";
import { DfyManager, type AdminDfyAsset } from "@/components/admin/dfy-manager";

export const dynamic = "force-dynamic";

export default async function AdminDfyPage() {
  const admin = await resolveAdmin();
  if (!admin) return null;

  const assets = await listDfyAssets();
  const rows: AdminDfyAsset[] = assets.map((a) => ({
    id: a.id,
    title: a.title,
    category: a.category,
    description: a.description,
    file_name: a.file_name,
    file_size: a.file_size,
    is_published: a.is_published,
    created_at: a.created_at,
  }));

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold">DFY Assets</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Ready-to-publish downloads for Done-For-You (OTO2) buyers. Uploaded files are private and
        served to entitled users via short-lived signed links.
      </p>
      <div className="mt-6">
        <DfyManager assets={rows} />
      </div>
    </div>
  );
}
