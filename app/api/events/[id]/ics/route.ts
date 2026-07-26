import { createServiceClient } from "@/lib/supabase/server";
import { generateSingleEventICS } from "@/lib/ics-utils";
import {
  hashSubscriptionToken,
  subscriptionTokenExpiryDate,
} from "@/lib/calendar/subscription-token";
import type { Event } from "@/lib/types";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  // Require a valid subscription token
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!token || !uuidRegex.test(token)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = await createServiceClient();

  const { data: sub } = await supabase
    .from("calendar_subscription_tokens")
    .select("id, user_id, expires_at")
    .eq("token_hash", hashSubscriptionToken(token))
    .single();

  if (!sub || new Date(sub.expires_at) < new Date()) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Sliding expiration: extend on every successful use so actively-polled
  // subscriptions never expire, while abandoned/leaked links go stale.
  await supabase
    .from("calendar_subscription_tokens")
    .update({ expires_at: subscriptionTokenExpiryDate() })
    .eq("id", sub.id);

  // The service client bypasses RLS, so re-check membership here:
  // events are only visible to member roles (see "Members can view all
  // events" policy). A token minted by a pending, deleted, or otherwise
  // non-member profile must not grant access to arbitrary events by UUID.
  const { data: owner, error: ownerError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", sub.user_id)
    .single();

  if (ownerError) {
    console.error("Failed to look up token owner's profile:", ownerError);
  }

  if (!owner || !["member", "content_editor", "admin"].includes(owner.role)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data: event, error } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !event) {
    return new Response("Event not found", { status: 404 });
  }

  const typedEvent = event as Event;

  let icsString: string;
  try {
    icsString = generateSingleEventICS(typedEvent);
  } catch (err) {
    console.error("ICS generation failed:", err);
    return new Response("Failed to generate calendar file", { status: 500 });
  }

  return new Response(icsString, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": "inline",
      "Cache-Control": "private, max-age=300",
    },
  });
}
