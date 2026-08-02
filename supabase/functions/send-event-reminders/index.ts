// Supabase Edge Function: send-event-reminders
// Triggered by pg_cron daily at 08:00 UTC ('0 8 * * *' — 04:00 ET during EDT,
// 03:00 ET during EST; the schedule is not localized) — defined in
// supabase/migrations/20260729000000_reminder_cron_schedules.sql
// Sends email reminders to users RSVPed to events starting in the next 24 hours.
//
// Runs with the service key (BYPASSRLS), so tenant isolation lives in the
// query text: iterates every active organization and filters each query on
// org_id explicitly (CWA-10 Phase 3, #212).

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { escapeHtml } from "../_shared/html.ts";
import { resolveServiceKey } from "../_shared/service-key.ts";
import {
  forEachOrg,
  listActiveOrgs,
  OrgRunError,
  summarize,
  type Org,
  type OrgListClient,
  type OrgRunCounts,
} from "../_shared/orgs.ts";

// What createClient(url, key) actually returns; ReturnType<typeof createClient>
// resolves the unbound generics to a different, incompatible instantiation.
type ServiceClient = SupabaseClient<any, "public", any>;

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SECRET_KEY = resolveServiceKey();
const SITE_URL = Deno.env.get("SITE_URL") || "https://incouragers.org";
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") || "two42 <noreply@incouragers.org>";
const BRAND_COLOR = Deno.env.get("BRAND_COLOR") || "#B85C38";

// ── Email ─────────────────────────────────────────────────────────────────────

async function sendEmail(
  opts: { to: string; subject: string; html: string; refId: string },
): Promise<boolean> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: EMAIL_FROM, to: opts.to, subject: opts.subject, html: opts.html }),
    });
    if (!res.ok) {
      // Log the profile id, not the email address (PII) — the Resend error
      // body is what's actionable here.
      console.error("Resend error for profile", opts.refId, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("Resend request failed for profile", opts.refId, err);
    return false;
  }
}

// ── Per-org run ───────────────────────────────────────────────────────────────

// PostgREST `.in()` filters serialize into the query string; chunk large id
// lists to stay under URL-length limits.
const IN_CHUNK_SIZE = 200;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function runForOrg(supabase: ServiceClient, org: Org): Promise<OrgRunCounts> {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  let sent = 0;
  let sendFailures = 0;

  // Find events starting in the next 24 hours
  const { data: events, error: eventsError } = await supabase
    .from("events")
    .select("id, title, start_time, location")
    .eq("org_id", org.id)
    .gte("start_time", now.toISOString())
    .lte("start_time", tomorrow.toISOString());

  if (eventsError) {
    throw new OrgRunError(`events query failed: ${eventsError.message}`, { sent, sendFailures });
  }
  if (!events?.length) return { sent, sendFailures };

  for (const event of events) {
    // Get RSVPs with "yes" or "maybe"
    const { data: rsvps, error: rsvpsError } = await supabase
      .from("rsvps")
      .select("user_id")
      .eq("org_id", org.id)
      .eq("event_id", event.id)
      .in("status", ["yes", "maybe"]);

    if (rsvpsError) {
      throw new OrgRunError(`rsvps query failed: ${rsvpsError.message}`, { sent, sendFailures });
    }
    if (!rsvps?.length) continue;

    const userIds = rsvps.map((r) => r.user_id);

    // One batched read of the trigger-synced profiles.email column replaces
    // the old per-user admin identity lookups (two round trips per attendee).
    // A profile can be missing for an RSVP user_id; iterating the returned
    // rows skips it.
    const profiles: Array<{
      id: string;
      first_name: string | null;
      preferred_name: string | null;
      email: string | null;
    }> = [];
    for (const ids of chunk(userIds, IN_CHUNK_SIZE)) {
      const { data: batch, error: profilesError } = await supabase
        .from("profiles")
        .select("id, first_name, preferred_name, email")
        .eq("org_id", org.id)
        .in("id", ids);
      if (profilesError) {
        throw new OrgRunError(`profiles query failed: ${profilesError.message}`, { sent, sendFailures });
      }
      profiles.push(...((batch ?? []) as typeof profiles));
    }

    for (const profile of profiles) {
      // Pending profiles (e.g. spouses who have never logged in) can have no
      // email — skip, don't throw.
      if (!profile.email) {
        console.error(
          "[org %s] skipping reminder: profile %s has no email (event %s)",
          org.slug,
          profile.id,
          event.id,
        );
        continue;
      }

      const eventDate = new Date(event.start_time).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });

      if (await sendEmail({
        to: profile.email,
        refId: profile.id,
        subject: `Reminder: ${event.title} is tomorrow!`,
        html: `
            <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
              <h1 style="color: ${BRAND_COLOR}; font-size: 28px;">Event Reminder</h1>
              <p style="font-size: 18px; line-height: 1.6; color: #44403c;">
                Hi ${escapeHtml(profile.preferred_name || profile.first_name || "Friend")}, just a reminder that <strong>${escapeHtml(event.title)}</strong> is coming up!
              </p>
              <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="font-size: 18px; margin: 0; color: #44403c;">
                  <strong>When:</strong> ${eventDate}
                </p>
                ${event.location ? `<p style="font-size: 18px; margin: 8px 0 0; color: #44403c;"><strong>Where:</strong> ${escapeHtml(event.location)}</p>` : ""}
              </div>
              <a href="${SITE_URL}/events"
                 style="display: inline-block; background-color: ${BRAND_COLOR}; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-size: 18px; margin-top: 20px;">
                View Event
              </a>
            </div>
          `,
      })) sent++;
      else sendFailures++;
    }
  }

  return { sent, sendFailures };
}

// ── Entry point ───────────────────────────────────────────────────────────────

Deno.serve(async () => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);
    // Cast: structurally checking the full SupabaseClient against OrgListClient
    // trips TS2589 (excessively deep instantiation) on current supabase-js.
    const orgs = await listActiveOrgs(supabase as unknown as OrgListClient);
    const summary = summarize(await forEachOrg(orgs, (org) => runForOrg(supabase, org)));
    if (summary.failed.length > 0 || summary.emailsFailed > 0) {
      console.error(
        "run completed with failures: %d/%d orgs failed, %d emails rejected",
        summary.failed.length,
        summary.orgs,
        summary.emailsFailed,
      );
    }
    return new Response(
      JSON.stringify({ message: `Sent ${summary.emailsSent} reminder emails`, ...summary }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    // Total failure (e.g. listActiveOrgs threw) — no org ran, so nothing has
    // been emailed and a 5xx is safe. 500 vs 200 is the signal that separates
    // "did not run" from "ran, possibly with per-org failures"; a body here
    // means net._http_response carries a diagnosis instead of an empty 500.
    console.error("reminder run aborted before completion:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
