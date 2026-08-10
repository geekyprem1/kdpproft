import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { retryJob } from "@/lib/jobs/job-queue";
import { cancelJob, deleteJob } from "@/lib/jobs/job-progress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function ownedJob(id: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  if (authError) throw authError;
  const { data: job, error } = await supabase
    .from("generation_jobs")
    .select("id, book_id, job_type, book_type, title, status, progress, current_step, error_message, created_at, completed_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!job) return { error: NextResponse.json({ error: "Job not found" }, { status: 404 }) };
  return { user, job };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await ownedJob(id);
  if (result.error) return result.error;
  return NextResponse.json(result.job);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owned = await ownedJob(id);
  if (owned.error) return owned.error;

  let action = "";
  try {
    action = String((await req.json()).action ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (action === "retry") {
    const result = await retryJob(id, owned.user.id);
    if (!result.ok) {
      if (result.error === "not_found") return NextResponse.json({ error: "Job not found" }, { status: 404 });
      if (result.error === "insufficient_credits") {
        return NextResponse.json({ error: "Not enough credits to retry.", upgrade: true }, { status: 402 });
      }
      return NextResponse.json({ error: "Only failed or cancelled jobs can be retried." }, { status: 409 });
    }
    return NextResponse.json({ ok: true, status: "queued" });
  }

  if (action === "cancel") {
    const outcome = await cancelJob(id, owned.user.id);
    if (outcome === "not_found") return NextResponse.json({ error: "Job not found" }, { status: 404 });
    if (outcome === "invalid_state") {
      return NextResponse.json({ error: "Only queued or processing jobs can be cancelled." }, { status: 409 });
    }
    return NextResponse.json({ ok: true, status: "cancelled" });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owned = await ownedJob(id);
  if (owned.error) return owned.error;
  const outcome = await deleteJob(id, owned.user.id);
  if (outcome === "not_found") return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (outcome === "invalid_state") {
    return NextResponse.json({ error: "Cancel an active job before deleting it." }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
