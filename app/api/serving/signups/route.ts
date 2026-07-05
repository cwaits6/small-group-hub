import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { displayName } from "@/lib/names";
import { isValidServiceDate } from "@/lib/serving/sundays";
import {
  notifyLeadersOfCancel,
  resolveSignupLabel,
  sendSignupConfirmation,
  type NamedProfile,
} from "@/lib/serving/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const groupId: string | undefined = body?.groupId;
  const serviceDate: string | undefined = body?.serviceDate;
  const attendeeIds: string[] = Array.isArray(body?.attendeeProfileIds)
    ? [...new Set(body.attendeeProfileIds as string[])]
    : [];

  if (!groupId || !serviceDate || attendeeIds.length === 0) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  if (!isValidServiceDate(serviceDate)) {
    return NextResponse.json(
      { error: "Signups are for upcoming Sundays only" },
      { status: 400 }
    );
  }

  // Team must exist and have serving signups enabled
  const [{ data: group }, { data: settings }, { data: profile }] =
    await Promise.all([
      supabase.from("member_groups").select("id, name").eq("id", groupId).single(),
      supabase
        .from("serving_team_settings")
        .select("enabled")
        .eq("group_id", groupId)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("id, first_name, last_name, preferred_name, family_id")
        .eq("id", user.id)
        .single(),
    ]);

  if (!group || !settings?.enabled || !profile) {
    return NextResponse.json(
      { error: "Serving signups are not enabled for this team" },
      { status: 404 }
    );
  }

  // Attendees are the signer and optionally their spouse (same household)
  const { data: attendees } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, preferred_name, family_id, relationship")
    .in("id", attendeeIds);

  if (!attendees || attendees.length !== attendeeIds.length) {
    return NextResponse.json({ error: "Unknown attendee" }, { status: 400 });
  }
  for (const a of attendees) {
    const isSelf = a.id === user.id;
    const isSpouse =
      profile.family_id !== null &&
      a.family_id === profile.family_id &&
      ["primary", "spouse"].includes(a.relationship);
    if (!isSelf && !isSpouse) {
      return NextResponse.json(
        { error: "Attendees must be you or your spouse" },
        { status: 400 }
      );
    }
  }

  // Insert the signup — the unique (group_id, service_date) constraint is the
  // race guard when two members tap "I'll do it" for the same Sunday
  const { data: signup, error: signupError } = await supabase
    .from("serving_signups")
    .insert({
      group_id: groupId,
      service_date: serviceDate,
      family_id: profile.family_id,
      created_by: user.id,
    })
    .select()
    .single();

  if (signupError || !signup) {
    if (signupError?.code === "23505") {
      return NextResponse.json(
        { error: "Someone just signed up for that Sunday — thank you anyway!" },
        { status: 409 }
      );
    }
    console.error("Serving signup insert failed:", signupError);
    return NextResponse.json({ error: "Failed to sign up" }, { status: 500 });
  }

  const { error: attendeeError } = await supabase
    .from("serving_signup_attendees")
    .insert(attendeeIds.map((id) => ({ signup_id: signup.id, profile_id: id })));

  if (attendeeError) {
    console.error("Serving attendee insert failed:", attendeeError);
    await supabase.from("serving_signups").delete().eq("id", signup.id);
    return NextResponse.json({ error: "Failed to sign up" }, { status: 500 });
  }

  if (user.email) {
    try {
      await sendSignupConfirmation(supabase, {
        signupId: signup.id,
        groupId,
        groupName: group.name,
        serviceDate,
        attendees,
        familyId: profile.family_id,
        recipient: { id: user.id, email: user.email, name: displayName(profile) },
      });
    } catch (err) {
      console.error("Serving confirmation email failed:", err);
    }
  }

  return NextResponse.json({ signup });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const signupId: string | undefined = body?.signupId;
  if (!signupId) {
    return NextResponse.json({ error: "Missing signupId" }, { status: 400 });
  }

  // Capture details before deleting so leaders can be told who freed the slot
  const { data: signup } = await supabase
    .from("serving_signups")
    .select(
      "id, group_id, service_date, family_id, created_by, member_groups(name), serving_signup_attendees(profiles(id, first_name, last_name, preferred_name))"
    )
    .eq("id", signupId)
    .maybeSingle();

  if (!signup) {
    return NextResponse.json({ error: "Signup not found" }, { status: 404 });
  }

  // RLS allows deletes only by the signup owner, a leader of the group, or an
  // admin — an empty result means the caller is none of those
  const { data: deleted, error } = await supabase
    .from("serving_signups")
    .delete()
    .eq("id", signupId)
    .select();

  if (error) {
    console.error("Serving signup delete failed:", error);
    return NextResponse.json({ error: "Failed to cancel" }, { status: 500 });
  }
  if (!deleted || deleted.length === 0) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const service = await createServiceClient();
    const groupName =
      (signup.member_groups as unknown as { name: string } | null)?.name ??
      "your team";
    const attendeeProfiles = (signup.serving_signup_attendees ?? [])
      .map((a: { profiles: unknown }) => a.profiles)
      .filter(Boolean) as NamedProfile[];

    await notifyLeadersOfCancel(service, {
      groupId: signup.group_id,
      groupName,
      serviceDate: signup.service_date,
      memberLabel: await resolveSignupLabel(
        service,
        attendeeProfiles,
        signup.family_id
      ),
      excludeProfileId: user.id,
    });
  } catch (err) {
    console.error("Serving cancel notice failed:", err);
  }

  return NextResponse.json({ success: true });
}
