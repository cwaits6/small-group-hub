import { createClient } from "@/lib/supabase/server";
import { sendFeedbackEmail } from "@/lib/email/resend";
import { displayName } from "@/lib/names";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, first_name, last_name, preferred_name")
    .eq("id", user.id)
    .single();

  if (
    !profile ||
    !["member", "content_editor", "admin"].includes(profile.role)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const type = body?.type;
  const message = typeof body?.message === "string" ? body.message.trim() : "";

  if (
    (type !== "idea" && type !== "problem") ||
    !message ||
    message.length > 2000
  ) {
    return NextResponse.json({ error: "Invalid feedback" }, { status: 400 });
  }

  const { error: insertError } = await supabase
    .from("feedback")
    .insert({ profile_id: user.id, type, message });

  if (insertError) {
    console.error("Failed to store feedback:", insertError);
    return NextResponse.json(
      { error: "Failed to save feedback" },
      { status: 500 },
    );
  }

  // Email a copy to the admins — best effort, the row above is the record.
  try {
    const { data: admins } = await supabase
      .from("profiles")
      .select("email")
      .eq("role", "admin")
      .not("email", "is", null);
    const emails = (admins ?? [])
      .map((a) => a.email)
      .filter((e): e is string => Boolean(e));
    if (emails.length > 0) {
      await sendFeedbackEmail(
        emails,
        displayName(profile),
        user.email ?? null,
        type,
        message,
      );
    }
  } catch (error) {
    console.error("Failed to email feedback to admins:", error);
  }

  return NextResponse.json({ ok: true });
}
