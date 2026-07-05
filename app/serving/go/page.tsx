import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { siteConfig } from "@/lib/config";
import { getServingLinkMode } from "@/lib/serving/config";
import { verifyServingToken } from "@/lib/serving/links";
import { formatServiceDate, isValidServiceDate } from "@/lib/serving/sundays";
import { signupDisplayName } from "@/lib/serving/display";
import { LinkActionConfirm } from "@/components/serving/LinkActionConfirm";

export const metadata = { title: `Serving | ${siteConfig.name}` };

/**
 * Landing page for signed serving-email links. Works without a login when
 * link mode is 'signed'. The link itself never performs the action — this
 * page asks for one explicit button press first, so email scanners that
 * prefetch URLs can't sign anyone up or cancel anything.
 */

function Message({ title, body }: { title: string; body: string }) {
  return (
    <div className="container mx-auto px-4 py-20 max-w-lg text-center">
      <Card className="p-8">
        <CardContent className="pt-6">
          <h1 className="font-serif text-3xl text-brand-primary mb-4">{title}</h1>
          <p className="text-lg text-muted-foreground">{body}</p>
          <Link
            href="/serving"
            className="inline-block mt-6 text-brand-primary hover:underline text-lg"
          >
            Go to the serving page
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

export default async function ServingLinkPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const payload = token ? verifyServingToken(token) : null;

  if (!token || !payload) {
    return (
      <Message
        title="This link has expired"
        body="No problem — you can sign in to the site and manage your serving Sundays there."
      />
    );
  }

  const service = await createServiceClient();

  const linkMode = await getServingLinkMode(service);
  if (linkMode === "login") {
    return (
      <Message
        title="Please sign in"
        body="Email links on this site require signing in first. Head to the serving page and we'll take you through login."
      />
    );
  }

  const [{ data: profile }, { data: group }, { data: signup }] =
    await Promise.all([
      service
        .from("profiles")
        .select("id, first_name, preferred_name, family_id")
        .eq("id", payload.p)
        .maybeSingle(),
      service
        .from("member_groups")
        .select("id, name")
        .eq("id", payload.g)
        .maybeSingle(),
      service
        .from("serving_signups")
        .select(
          "id, family_id, created_by, serving_signup_attendees(profiles(id, first_name, last_name, preferred_name))"
        )
        .eq("group_id", payload.g)
        .eq("service_date", payload.d)
        .maybeSingle(),
    ]);

  if (!profile || !group) {
    return (
      <Message
        title="This link has expired"
        body="No problem — you can sign in to the site and manage your serving Sundays there."
      />
    );
  }

  const dateLabel = formatServiceDate(payload.d);
  const firstName = profile.preferred_name || profile.first_name || "Friend";

  if (payload.a === "signup") {
    if (!isValidServiceDate(payload.d)) {
      return (
        <Message
          title="That Sunday has passed"
          body="This link pointed at a Sunday that's already behind us. Check the serving page for the upcoming schedule."
        />
      );
    }
    if (signup) {
      const attendees = (signup.serving_signup_attendees ?? [])
        .map((a) => a.profiles as unknown as {
          id: string;
          first_name: string | null;
          last_name: string | null;
          preferred_name: string | null;
        })
        .filter(Boolean);
      let familyName: string | null = null;
      if (attendees.length > 1 && signup.family_id) {
        const { data: family } = await service
          .from("family_units")
          .select("family_name")
          .eq("id", signup.family_id)
          .single();
        familyName = family?.family_name ?? null;
      }
      return (
        <Message
          title="That Sunday is covered"
          body={`${signupDisplayName(attendees, familyName)} already has ${dateLabel} — thank you for offering! Check the serving page for other open Sundays.`}
        />
      );
    }

    // Offer the spouse option when the member has one on file
    let spouseName: string | null = null;
    if (profile.family_id) {
      const { data: spouse } = await service
        .from("profiles")
        .select("id, first_name, preferred_name")
        .eq("family_id", profile.family_id)
        .in("relationship", ["primary", "spouse"])
        .neq("id", profile.id)
        .limit(1)
        .maybeSingle();
      spouseName = spouse ? spouse.preferred_name || spouse.first_name : null;
    }

    return (
      <LinkActionConfirm
        token={token}
        action="signup"
        firstName={firstName}
        teamName={group.name}
        dateLabel={dateLabel}
        spouseName={spouseName}
      />
    );
  }

  // Cancel link
  const isInvolved =
    !!signup &&
    (signup.created_by === profile.id ||
      (signup.serving_signup_attendees ?? []).some(
        (a) => (a.profiles as unknown as { id: string } | null)?.id === profile.id
      ));

  if (!signup || !isInvolved) {
    return (
      <Message
        title="Nothing to cancel"
        body={`You're not signed up for ${dateLabel} — it may have been cancelled already.`}
      />
    );
  }

  return (
    <LinkActionConfirm
      token={token}
      action="cancel"
      firstName={firstName}
      teamName={group.name}
      dateLabel={dateLabel}
      spouseName={null}
    />
  );
}
