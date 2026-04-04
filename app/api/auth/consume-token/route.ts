import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { token } = await request.json();

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const supabase = await createServiceClient();

  const { error } = await supabase
    .from("access_requests")
    .update({ signup_token: null })
    .eq("signup_token", token);

  if (error) {
    console.error("Failed to consume signup token:", error);
    return NextResponse.json({ error: "Failed to invalidate token" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
