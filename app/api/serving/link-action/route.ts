import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { displayName } from "@/lib/names";
import { getServingLinkMode } from "@/lib/serving/config";
import { verifyServingToken } from "@/lib/serving/links";
import { isValidServiceDate } from "@/lib/serving/sundays";
import {
  notifyLeadersOfCancel,
  resolveSignupLabel,
  sendSignupConfirmation,
  type NamedProfile,
} from "@/lib/serving/server";

/**
 * Executes a signed serving-email action (signup or cancel) without a login
 * session. The HMAC token is the authorization; the /serving/go page collects
 * an explicit button press first so mail scanners never trigger actions.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const token: string | undefined = body?.token;
  const includeSpouse: boolean = body?.includeSpouse === true;

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const payload = verifyServingToken(token);
  if (!payload) {
    return NextResponse.json(
      { error: "This link is no longer valid — please use the site instead" },
      { status: 400 }
    );
  }

  const service = await createServiceClient();

  const linkMode = await getServingLinkMode(service);
  if (linkMode === "login") {
    return NextResponse.json({ error: "login_required" }, { status: 403 });
  }

  const [{ data: profile }, { data: group }, { data: settings }] =
    await Promise.all([
      service
        .from("profiles")
        .select("id, first_name, last_name, preferred_name, family_id, email, role")
        .eq("id", payload.p)
        .maybeSingle(),
      service
        .from("member_groups")
        .select("id, name")
        .eq("id", payload.g)
        .maybeSingle(),
      service
        .from("serving_team_settings")
        .select("enabled")
        .eq("group_id", payload.g)
        .maybeSingle(),
    ]);

  if (!profile || profile.role === "pending" || !group || !settings?.enabled) {
    return NextResponse.json(
      { error: "This link is no longer valid — please use the site instead" },
      { status: 400 }
    );
  }

  if (payload.a === "signup") {
    if (!isValidServiceDate(payload.d)) {
      return NextResponse.json(
        { error: "That Sunday has already passed" },
        { status: 400 }
      );
    }

    // The link acts for a specific member — they must be on the team
    const { data: membership } = await service
      .from("profile_groups")
      .select("profile_id")
      .eq("profile_id", profile.id)
      .eq("group_id", payload.g)
      .maybeSingle();
    if (!membership) {
      return NextResponse.json(
        { error: "You're no longer on this team — please use the site instead" },
        { status: 403 }
      );
    }

    const attendees: NamedProfile[] = [profile];
    if (includeSpouse && profile.family_id) {
      const { data: spouse } = await service
        .from("profiles")
        .select("id, first_name, last_name, preferred_name")
        .eq("family_id", profile.family_id)
        .in("relationship", ["primary", "spouse"])
        .neq("id", profile.id)
        .limit(1)
        .maybeSingle();
      if (spouse) attendees.push(spouse);
    }

    const { data: signup, error: signupError } = await service
      .from("serving_signups")
      .insert({
        group_id: payload.g,
        service_date: payload.d,
        family_id: profile.family_id,
        created_by: profile.id,
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
      console.error("Signed-link signup insert failed:", signupError);
      return NextResponse.json({ error: "Failed to sign up" }, { status: 500 });
    }

    const { error: attendeeError } = await service
      .from("serving_signup_attendees")
      .insert(attendees.map((a) => ({ signup_id: signup.id, profile_id: a.id })));
    if (attendeeError) {
      console.error("Signed-link attendee insert failed:", attendeeError);
      await service.from("serving_signups").delete().eq("id", signup.id);
      return NextResponse.json({ error: "Failed to sign up" }, { status: 500 });
    }

    if (profile.email) {
      try {
        await sendSignupConfirmation(service, {
          signupId: signup.id,
          groupId: payload.g,
          groupName: group.name,
          serviceDate: payload.d,
          attendees,
          familyId: profile.family_id,
          recipient: {
            id: profile.id,
            email: profile.email,
            name: displayName(profile),
          },
        });
      } catch (err) {
        console.error("Serving confirmation email failed:", err);
      }
    }

    return NextResponse.json({ success: true, action: "signup" });
  }

  // Cancel: the member must be the signup's creator or one of its attendees
  const { data: signup } = await service
    .from("serving_signups")
    .select(
      "id, family_id, created_by, serving_signup_attendees(profiles(id, first_name, last_name, preferred_name))"
    )
    .eq("group_id", payload.g)
    .eq("service_date", payload.d)
    .maybeSingle();

  if (!signup) {
    return NextResponse.json(
      { error: "That signup was already cancelled" },
      { status: 404 }
    );
  }

  const attendeeProfiles = (signup.serving_signup_attendees ?? [])
    .map((a: { profiles: unknown }) => a.profiles)
    .filter(Boolean) as NamedProfile[];
  const involved =
    signup.created_by === profile.id ||
    attendeeProfiles.some((a) => a.id === profile.id);
  if (!involved) {
    return NextResponse.json(
      { error: "This Sunday is covered by someone else now" },
      { status: 403 }
    );
  }

  const { error: deleteError } = await service
    .from("serving_signups")
    .delete()
    .eq("id", signup.id);
  if (deleteError) {
    console.error("Signed-link cancel failed:", deleteError);
    return NextResponse.json({ error: "Failed to cancel" }, { status: 500 });
  }

  try {
    await notifyLeadersOfCancel(service, {
      groupId: payload.g,
      groupName: group.name,
      serviceDate: payload.d,
      memberLabel: await resolveSignupLabel(
        service,
        attendeeProfiles,
        signup.family_id
      ),
      excludeProfileId: profile.id,
    });
  } catch (err) {
    console.error("Serving cancel notice failed:", err);
  }

  return NextResponse.json({ success: true, action: "cancel" });
}
