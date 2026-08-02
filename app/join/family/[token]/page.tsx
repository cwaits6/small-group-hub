import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { siteConfig } from "@/lib/config";
import { resolveOrgSlug, resolveRequestOrgId } from "@/lib/org";
import { AuthShell } from "@/app/(auth)/_components/AuthShell";

interface PageProps {
  params: Promise<{ token: string }>;
}

export const metadata = { title: `Join Your Household | ${siteConfig.name}` };

export default async function FamilyJoinPage({ params }: PageProps) {
  const { token } = await params;

  // Resolve the request's org through the request-scoped server client. It is
  // cookie-bound, not anonymous: for a signed-in visitor app_request_org_id()
  // returns their own org and ignores x-two42-org; for the anonymous
  // invite-link case (the common one) it resolves the header's slug. Either
  // way it is the same value the downstream access_requests RLS WITH CHECK
  // compares against, and NULL fails closed below.
  const requestClient = await createClient();
  const requestOrgId = await resolveRequestOrgId(requestClient, {
    label: "Family join page",
    orgSlug: resolveOrgSlug(),
  });

  // Fail closed — same destination the invalid-token branch uses.
  if (!requestOrgId) {
    redirect("/join");
  }

  // Public page — uses service client to bypass RLS for token validation
  const supabase = await createServiceClient();

  // Validate the token. The org filter matters because the downstream
  // access_requests(invite_token, org_id) → family_invites(token, org_id)
  // composite FK means an invite from a different org than the host resolves
  // would fail with an opaque FK violation partway through signup — catching
  // it here turns that into the existing invalid-token → /join path.
  const { data: invite, error: inviteError } = await supabase
    .from("family_invites")
    .select(
      `
      id,
      org_id,
      invite_email,
      accepted_at,
      family_member_id,
      family_members!family_invites_family_member_id_fkey (
        first_name,
        last_name,
        relationship
      ),
      family_units!family_invites_family_id_fkey (
        family_name
      )
    `,
    )
    .eq("token", token)
    .eq("org_id", requestOrgId)
    .maybeSingle();

  if (inviteError) {
    console.error("Family join page: invite lookup failed:", inviteError);
  }

  // Invalid token → redirect to regular join page
  if (!invite) {
    redirect("/join");
  }

  // Already accepted → redirect with message
  if (invite.accepted_at) {
    return (
      <div className="container mx-auto px-4 py-20 max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl text-brand-primary">
              Invite Already Used
            </CardTitle>
            <CardDescription className="text-base">
              This invite link has already been claimed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              If you already created your account, you can{" "}
              <Link href="/login" className="text-brand-primary underline">
                log in here
              </Link>
              .
            </p>
            <p className="text-muted-foreground">
              If you need help, please contact your group admin.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const familyMember = invite.family_members as unknown as {
    first_name: string;
    last_name: string | null;
    relationship: string;
  } | null;
  const familyUnit = invite.family_units as unknown as {
    family_name: string;
  } | null;

  const memberName = familyMember
    ? [familyMember.first_name, familyMember.last_name]
        .filter(Boolean)
        .join(" ")
    : "you";

  // The join page URL — pass invite_token so the access-request form can
  // store it, and pre-fill email.
  const joinUrl = `/join?invite_token=${encodeURIComponent(token)}&email=${encodeURIComponent(invite.invite_email)}`;

  return (
    <AuthShell
      eyebrow={`${familyMember?.relationship ?? "Family"} invite`}
      title="You've been invited to join"
      em={siteConfig.name}
      kicker={
        familyUnit?.family_name
          ? `You've been added to the ${familyUnit.family_name} household. Create your own account to appear in the member directory and connect with the group.`
          : "Create your own account to appear in the member directory and connect with the group."
      }
      altPrompt="Already have an account?"
      altLabel="Log in →"
      altHref="/login"
    >
      <div className="space-y-6">
        <div className="rounded-lg bg-muted/50 border p-4 space-y-1">
          <p className="text-lg text-muted-foreground">Invited as</p>
          <p className="font-semibold text-lg">{memberName}</p>
          {familyUnit?.family_name && (
            <p className="text-lg text-muted-foreground">
              {familyUnit.family_name}
            </p>
          )}
        </div>

        <div className="space-y-3">
          <p className="text-lg text-muted-foreground">
            Your invite was sent to{" "}
            <span className="font-medium text-foreground">
              {invite.invite_email}
            </span>
            . Use that email address when you sign up.
          </p>
          <p className="text-lg text-muted-foreground">
            After you request access, an admin will review and approve your
            account. This usually takes less than a day.
          </p>
        </div>

        <Link href={joinUrl} className="block">
          <Button
            size="lg"
            className="w-full bg-brand-primary hover:bg-brand-primary/90 text-white flex items-center justify-center gap-2"
          >
            Request Access
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </AuthShell>
  );
}
