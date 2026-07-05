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
  familyId: string | null
): Promise<string> {
  let familyName: string | null = null;
  if (attendees.length > 1 && familyId) {
    const { data: family } = await supabase
      .from("family_units")
      .select("family_name")
      .eq("id", familyId)
      .single();
    familyName = family?.family_name ?? null;
  }
  return signupDisplayName(attendees, familyName);
}

export async function sendSignupConfirmation(
  supabase: SupabaseClient,
  opts: {
    signupId: string;
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
    opts.familyId
  );

  const linkMode = await getServingLinkMode(supabase);
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
    groupName: string;
    serviceDate: string;
    memberLabel: string;
    excludeProfileId?: string;
  }
) {
  const { data: leaders } = await service
    .from("profile_groups")
    .select("profiles(id, first_name, last_name, preferred_name, email)")
    .eq("group_id", opts.groupId)
    .eq("is_leader", true);

  for (const row of leaders ?? []) {
    const leader = row.profiles as unknown as
      | (NamedProfile & { email: string | null })
      | null;
    if (!leader?.email || leader.id === opts.excludeProfileId) continue;
    await sendServingCancelNoticeEmail({
      to: leader.email,
      leaderName: displayName(leader),
      memberLabel: opts.memberLabel,
      teamName: opts.groupName,
      serviceDate: opts.serviceDate,
      servingUrl: `${siteConfig.url}/serving/${opts.groupId}`,
    });
  }
}
