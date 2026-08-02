/**
 * Server-side serving helpers shared by the in-app signup API and the
 * signed email-link API. Callers wrap these in try/catch — email failures
 * must never undo a successful signup or cancel.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { siteConfig } from "@/lib/config";
import { displayName } from "@/lib/names";
import { generateServingICS } from "@/lib/ics-utils";
import { getServingLinkMode } from "@/lib/serving/config";
import { signupDisplayName } from "@/lib/serving/display";
import { createServingToken } from "@/lib/serving/links";
import {
  sendServingCancelNoticeEmail,
  sendServingConfirmationEmail,
} from "@/lib/email/serving";

export interface NamedProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  preferred_name: string | null;
}

export async function resolveSignupLabel(
  supabase: SupabaseClient,
  attendees: NamedProfile[],
  familyId: string | null,
  orgId: string
): Promise<string> {
  let familyName: string | null = null;
  if (attendees.length > 1 && familyId) {
    // org_id filter is required: on a service-role client a key-only read
    // matches rows from every org the moment a second org exists.
    const { data: family, error } = await supabase
      .from("family_units")
      .select("family_name")
      .eq("id", familyId)
      .eq("org_id", orgId)
      .single();
    // Non-fatal: the household name only enriches the label, so a failed
    // read degrades to the attendee names.
    if (error) {
      console.error("Serving family lookup failed for %s:", familyId, error);
    }
    familyName = family?.family_name ?? null;
  }
  return signupDisplayName(attendees, familyName);
}

/**
 * The member's spouse (their household's other primary/spouse profile), if
 * any. Non-fatal by contract: everywhere the spouse appears it is an opt-in
 * extra, so a failed read logs and degrades to null rather than throwing.
 */
export async function findSpouse(
  supabase: SupabaseClient,
  familyId: string,
  excludeProfileId: string,
  orgId: string
): Promise<NamedProfile | null> {
  // org_id filter is required: on a service-role client a key-only read
  // matches rows from every org the moment a second org exists.
  const { data: spouse, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, preferred_name")
    .eq("family_id", familyId)
    .eq("org_id", orgId)
    .in("relationship", ["primary", "spouse"])
    .neq("id", excludeProfileId)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("Serving spouse lookup failed for family %s:", familyId, error);
  }
  return spouse ?? null;
}

export async function sendSignupConfirmation(
  supabase: SupabaseClient,
  opts: {
    signupId: string;
    orgId: string;
    groupId: string;
    groupName: string;
    serviceDate: string;
    attendees: NamedProfile[];
    familyId: string | null;
    recipient: { id: string; email: string; name: string };
  }
) {
  const attendeesLabel = await resolveSignupLabel(
    supabase,
    opts.attendees,
    opts.familyId,
    opts.orgId
  );

  const linkMode = await getServingLinkMode(supabase, opts.orgId);
  const cancelUrl =
    linkMode === "signed"
      ? `${siteConfig.url}/serving/go?token=${createServingToken({
          a: "cancel",
          g: opts.groupId,
          d: opts.serviceDate,
          p: opts.recipient.id,
        })}`
      : `${siteConfig.url}/serving/${opts.groupId}`;

  await sendServingConfirmationEmail({
    to: opts.recipient.email,
    name: opts.recipient.name,
    teamName: opts.groupName,
    serviceDate: opts.serviceDate,
    attendeesLabel,
    cancelUrl,
    icsContent: generateServingICS({
      signupId: opts.signupId,
      serviceDate: opts.serviceDate,
      teamName: opts.groupName,
    }),
  });
}

/** Quietly tell the team's leaders a Sunday opened back up. */
export async function notifyLeadersOfCancel(
  service: SupabaseClient,
  opts: {
    groupId: string;
    orgId: string;
    groupName: string;
    serviceDate: string;
    memberLabel: string;
    excludeProfileId?: string;
  }
) {
  // org_id filter is required: this is an email fan-out surface on a
  // service-role client — an unscoped read would mail another org's leaders.
  const { data: leaders } = await service
    .from("profile_groups")
    .select("profiles(id, first_name, last_name, preferred_name, email)")
    .eq("group_id", opts.groupId)
    .eq("org_id", opts.orgId)
    .eq("is_leader", true);

  for (const row of leaders ?? []) {
    const leader = row.profiles as unknown as
      | (NamedProfile & { email: string | null })
      | null;
    if (!leader?.email || leader.id === opts.excludeProfileId) continue;
    try {
      await sendServingCancelNoticeEmail({
        to: leader.email,
        leaderName: displayName(leader),
        memberLabel: opts.memberLabel,
        teamName: opts.groupName,
        serviceDate: opts.serviceDate,
        servingUrl: `${siteConfig.url}/serving/${opts.groupId}`,
      });
    } catch (err) {
      console.error("Failed to send serving cancel notice to leader:", leader.id, err);
    }
  }
}
