import { createClient } from "@/lib/supabase/server";
import { sendInviteEmail } from "@/lib/email/resend";
import { NextResponse } from "next/server";
import { siteConfig } from "@/lib/config";
import crypto from "crypto";

export async function POST(request: Request) {
  const supabase = await createClient();

  // Verify the caller is an admin
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { email, name } = await request.json();

  if (!email || !name) {
    return NextResponse.json({ error: "Missing email or name" }, { status: 400 });
  }

  try {
    // Generate a secure signup token (expires in 7 days)
    const signupToken = crypto.randomBytes(32).toString("hex");
    const tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // Update the access request with approval status and signup token
    const { error: updateError } = await supabase
      .from("access_requests")
      .update({
        status: "approved",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        signup_token: signupToken,
        token_expires_at: tokenExpiresAt,
      })
      .eq("email", email)
      .eq("status", "pending");

    if (updateError) {
      throw updateError;
    }

    // Send branded invite email via Resend with signup link
    const signupLink = `${siteConfig.url}/setup-account?token=${signupToken}`;
    await sendInviteEmail(email, name, signupLink);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Approval error:", error);
    return NextResponse.json(
      { error: "Failed to process approval" },
      { status: 500 }
    );
  }
}
