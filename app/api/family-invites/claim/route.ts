import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/family-invites/claim
 *
 * Called after a new user signs up via /setup-account when they arrived
 * through a family invite link (/join/family/[token]).
 *
 * Actions:
 * 1. Validate the invite token is still open (not accepted)
 * 2. Link profiles.family_id to the invite's family
 * 3. Set family_members.claimed_profile_id to the new user's profile id
 * 4. Mark family_invites.accepted_at = now()
 *
 * The caller must be authenticated (newly signed-in user).
 * Service client is used for the update so RLS doesn't block the new user.
 *
 * Input:  { invite_token: string }
 * Output: { success: true }
 */
export async function POST(request: Request) {
  // Verify the caller is authenticated
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { invite_token } = body as { invite_token?: string };

  if (!invite_token) {
    return NextResponse.json({ error: "invite_token is required" }, { status: 400 });
  }

  // Use service client so we can bypass RLS (new user may not yet have member role)
  const service = await createServiceClient();

  // Load the invite
  const { data: invite, error: inviteError } = await service
    .from("family_invites")
    .select("id, family_id, family_member_id, invite_email, accepted_at")
    .eq("token", invite_token)
    .maybeSingle();

  if (inviteError || !invite) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  if (invite.accepted_at) {
    return NextResponse.json(
      { error: "This invite has already been claimed" },
      { status: 409 },
    );
  }

  // Verify the authenticated user's email matches the invite recipient
  if (user.email?.toLowerCase() !== invite.invite_email?.toLowerCase()) {
    return NextResponse.json(
      { error: "Email does not match invite recipient" },
      { status: 403 },
    );
  }

  const now = new Date().toISOString();

  // 1. Link the new profile to the family
  const { error: profileError } = await service
    .from("profiles")
    .update({ family_id: invite.family_id })
    .eq("id", user.id);

  if (profileError) {
    console.error("family-invites/claim: profile update error:", profileError);
    return NextResponse.json(
      { error: "Failed to link profile to family" },
      { status: 500 },
    );
  }

  // 2. Mark the family_members record as claimed
  const { error: fmError } = await service
    .from("family_members")
    .update({ claimed_profile_id: user.id })
    .eq("id", invite.family_member_id);

  if (fmError) {
    console.error("family-invites/claim: family_members update error:", fmError);
    // Non-fatal — profile is already linked; log and continue
  }

  // 3. Mark the invite as accepted
  const { error: acceptError } = await service
    .from("family_invites")
    .update({ accepted_at: now })
    .eq("id", invite.id);

  if (acceptError) {
    console.warn("family-invites/claim: failed to mark invite accepted (id=%s):", invite.id, acceptError);
    // Profile is already linked; return partial success so admin can remediate
    return NextResponse.json({ success: true, warning: "Profile linked but invite record was not updated." });
  }

  return NextResponse.json({ success: true });
}
