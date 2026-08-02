import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { token } = await request.json();

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const supabase = await createServiceClient();

  // Resolve the row first so the write below can be scoped to (id, org_id).
  // signup_token is currently globally UNIQUE, so the unscoped update touched
  // at most one row — the org scoping is correctness-under-change (if that
  // constraint ever becomes per-org), not a live bug.
  const { data: row, error: lookupError } = await supabase
    .from("access_requests")
    .select("id, org_id")
    .eq("signup_token", token)
    .maybeSingle();

  if (lookupError) {
    console.error("Failed to look up signup token:", lookupError);
    return NextResponse.json({ error: "Failed to invalidate token" }, { status: 500 });
  }

  // Zero rows means the token was already consumed — stay idempotent.
  if (!row) {
    return NextResponse.json({ success: true });
  }

  const { error } = await supabase
    .from("access_requests")
    .update({ signup_token: null })
    .eq("id", row.id)
    .eq("org_id", row.org_id);

  if (error) {
    console.error("Failed to consume signup token:", error);
    return NextResponse.json({ error: "Failed to invalidate token" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
