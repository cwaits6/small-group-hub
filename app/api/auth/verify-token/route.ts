import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { token } = await request.json();

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("access_requests")
    .select("name, email, status, token_expires_at")
    .eq("signup_token", token)
    .eq("status", "approved")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 404 });
  }

  if (data.token_expires_at && new Date(data.token_expires_at) < new Date()) {
    return NextResponse.json({ error: "Token has expired" }, { status: 410 });
  }

  return NextResponse.json({ name: data.name, email: data.email });
}
