import { createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, ArrowRight } from "lucide-react";
import { siteConfig } from "@/lib/config";

interface PageProps {
  params: Promise<{ token: string }>;
}

export const metadata = { title: `Join Your Household | ${siteConfig.name}` };

export default async function FamilyJoinPage({ params }: PageProps) {
  const { token } = await params;

  // Public page — uses service client to bypass RLS for token validation
  const supabase = await createServiceClient();

  // Validate the token
  const { data: invite } = await supabase
    .from("family_invites")
    .select(
      `
      id,
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
    .maybeSingle();

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
  const joinUrl = `/join?invite_token=${token}&email=${encodeURIComponent(invite.invite_email)}`;

  return (
    <div className="container mx-auto px-4 py-12 max-w-lg">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-brand-primary/10 rounded-full flex items-center justify-center">
              <Users className="h-5 w-5 text-brand-primary" />
            </div>
            <Badge variant="secondary" className="capitalize">
              {familyMember?.relationship ?? "Family"} invite
            </Badge>
          </div>
          <CardTitle className="text-2xl text-brand-primary">
            You&apos;ve been invited to join {siteConfig.name}!
          </CardTitle>
          <CardDescription className="text-base">
            {familyUnit?.family_name && (
              <>
                You&apos;ve been added to the{" "}
                <strong>{familyUnit.family_name}</strong> household.
              </>
            )}{" "}
            Create your own account to appear in the member directory and
            connect with the group.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="rounded-lg bg-muted/50 border p-4 space-y-1">
            <p className="text-sm text-muted-foreground">Invited as</p>
            <p className="font-semibold text-lg">{memberName}</p>
            {familyUnit?.family_name && (
              <p className="text-sm text-muted-foreground">
                {familyUnit.family_name}
              </p>
            )}
          </div>

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Your invite was sent to{" "}
              <span className="font-medium text-foreground">
                {invite.invite_email}
              </span>
              . Use that email address when you sign up.
            </p>
            <p className="text-sm text-muted-foreground">
              After you request access, an admin will review and approve your
              account. This usually takes less than a day.
            </p>
          </div>

          <Link href={joinUrl} className="block">
            <Button
              size="lg"
              className="w-full text-base py-6 bg-brand-primary hover:bg-brand-primary/90 text-white flex items-center justify-center gap-2"
            >
              Request Access
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>

          <p className="text-xs text-center text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-brand-primary underline">
              Log in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
