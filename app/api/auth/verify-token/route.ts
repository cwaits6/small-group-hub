import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { token } = await request.json();

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const supabase = await createServiceClient();

  // The service client bypasses RLS, so the token row is the org anchor for
  // this pre-login flow: handle_new_user() later reads the same row's org_id
  // to place the new profile (see supabase/schema.sql).
  const { data, error } = await supabase
    .from("access_requests")
    .select("name, email, status, token_expires_at, invite_token, org_id")
    .eq("signup_token", token)
    .eq("status", "approved")
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Signup token lookup failed:", error);
  }

  // org_id is NOT NULL in the schema, so a falsy value is an invariant
  // violation, not expected control flow — fail closed as an invalid token.
  if (error || !data || !data.org_id) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 404 });
  }

  if (data.token_expires_at && new Date(data.token_expires_at) < new Date()) {
    return NextResponse.json({ error: "Token has expired" }, { status: 410 });
  }

  return NextResponse.json({
    name: data.name,
    email: data.email,
    invite_token: data.invite_token ?? null,
  });
}
