import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/household/search-members?q=name
 *
 * Search enrolled profiles who have no household assigned, to allow a
 * primary/spouse to link them to their own household.
 */
export async function GET(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("role, family_id, setup_completed, relationship")
    .eq("id", user.id)
    .single();

  if (
    !currentProfile ||
    !["member", "content_editor", "admin"].includes(currentProfile.role) ||
    !currentProfile.setup_completed ||
    !currentProfile.family_id
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!["primary", "spouse"].includes(currentProfile.relationship ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ data: [] });
  }

  // Search profiles without a household, matching first or last name
  const { data, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, preferred_name, avatar_url, email")
    .is("family_id", null)
    .neq("id", user.id)
    .in("role", ["member", "content_editor", "admin"])
    .eq("setup_completed", true)
    .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,preferred_name.ilike.%${q}%`)
    .order("first_name")
    .limit(10);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}
