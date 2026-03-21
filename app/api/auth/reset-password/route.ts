import { createServiceClient } from "@/lib/supabase/server";
import { sendPasswordResetEmail } from "@/lib/email/resend";
import { NextResponse } from "next/server";
import { siteConfig } from "@/lib/config";

export async function POST(request: Request) {
  const { email } = await request.json();

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  try {
    const serviceClient = await createServiceClient();

    const { data: linkData, error: linkError } =
      await serviceClient.auth.admin.generateLink({
        type: "recovery",
        email,
        options: {
          redirectTo: `${siteConfig.url}/api/auth/callback?next=/setup-password`,
        },
      });

    // Send email only if link generation succeeded (user exists)
    // Always return 200 to prevent email enumeration
    if (!linkError && linkData?.properties?.action_link) {
      await sendPasswordResetEmail(email, linkData.properties.action_link);
    }
  } catch (error) {
    // Log but don't expose errors to prevent enumeration
    console.error("Password reset error:", error);
  }

  // Always return success to prevent email enumeration
  return NextResponse.json({ success: true });
}
