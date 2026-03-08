import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendWelcomeEmail } from "@/lib/email/resend";
import { NextResponse } from "next/server";
import { siteConfig } from "@/lib/config";

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
    // Use service role to invite user via Supabase Auth
    const serviceClient = await createServiceClient();
    const { error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(
      email,
      {
        data: { full_name: name },
        redirectTo: `${siteConfig.url}/api/auth/callback?next=/dashboard`,
      }
    );

    if (inviteError) {
      // If user already exists in auth, just update their profile role
      if (inviteError.message.includes("already")) {
        // Find user by email and update profile
        const { data: users } = await serviceClient.auth.admin.listUsers();
        const existingUser = users?.users?.find((u) => u.email === email);
        if (existingUser) {
          await serviceClient
            .from("profiles")
            .update({
              role: "member",
              approved_at: new Date().toISOString(),
              approved_by: user.id,
            })
            .eq("id", existingUser.id);
        }
      } else {
        throw inviteError;
      }
    }

    // Send welcome email
    await sendWelcomeEmail(email, name);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Approval error:", error);
    return NextResponse.json(
      { error: "Failed to process approval" },
      { status: 500 }
    );
  }
}
