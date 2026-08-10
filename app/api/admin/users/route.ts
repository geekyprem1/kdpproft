import { NextRequest, NextResponse } from "next/server";
import { resolveAdmin, adminCreateUser } from "@/lib/admin";
import type { Role } from "@/lib/admin/roles";
import { grantableByKey } from "@/lib/offers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Create a new user from the admin panel.
 *
 * Gated by resolveAdmin(); only a super_admin may provision an admin/super_admin
 * account. Delivers the Front End offer by default so the new user lands on the
 * FE plan (pass offerKey to change, or "none" to leave them on the Free Trial).
 */
export async function POST(req: NextRequest) {
  const admin = await resolveAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const fullName = typeof body.fullName === "string" ? body.fullName : undefined;
  const role = (typeof body.role === "string" ? body.role : "user") as Role;
  const offerKey = typeof body.offerKey === "string" ? body.offerKey : "commercial";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }
  if (!["user", "admin", "super_admin"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  // Only a super_admin can mint privileged accounts.
  if (role !== "user" && admin.role !== "super_admin") {
    return NextResponse.json({ error: "Only a super_admin can create admin accounts." }, { status: 403 });
  }
  if (offerKey !== "none" && !grantableByKey(offerKey)) {
    return NextResponse.json({ error: "Unknown offer" }, { status: 400 });
  }

  try {
    const created = await adminCreateUser(admin, { email, password, fullName, role, offerKey });
    return NextResponse.json({ ok: true, id: created.id, email: created.email });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Create user failed.";
    // Surface duplicate-email cleanly.
    const isDup = /already|registered|exists/i.test(message);
    return NextResponse.json(
      { error: isDup ? "A user with that email already exists." : "Could not create user." },
      { status: isDup ? 409 : 500 }
    );
  }
}
