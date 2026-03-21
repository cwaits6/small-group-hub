import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendInviteEmail } from "@/lib/email/resend";
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
    const serviceClient = await createServiceClient();

    // Generate an invite link without sending Supabase's default email
    const { data: linkData, error: linkError } =
      await serviceClient.auth.admin.generateLink({
        type: "invite",
        email,
        options: {
          data: { full_name: name },
          redirectTo: `${siteConfig.url}/api/auth/callback?next=/setup-password`,
        },
      });

    if (linkError) {
      // If user already exists in auth, just update their profile role
      if (linkError.message.includes("already")) {
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
        throw linkError;
      }
    } else {
      // Send branded invite email via Resend
      await sendInviteEmail(
        email,
        name,
        linkData.properties.action_link
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Approval error:", error);
    return NextResponse.json(
      { error: "Failed to process approval" },
      { status: 500 }
    );
  }
}
