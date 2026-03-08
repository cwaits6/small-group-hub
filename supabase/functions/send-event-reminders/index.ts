// Supabase Edge Function: send-event-reminders
// Triggered by pg_cron daily at 8am
// Sends email reminders to users RSVPed to events starting in the next 24 hours

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SECRET_KEY = Deno.env.get("SUPABASE_SECRET_KEY")!;
const SITE_URL = Deno.env.get("SITE_URL") || "https://incouragers.org";

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // Find events starting in the next 24 hours
  const { data: events, error: eventsError } = await supabase
    .from("events")
    .select("id, title, start_time, location")
    .gte("start_time", now.toISOString())
    .lte("start_time", tomorrow.toISOString());

  if (eventsError || !events?.length) {
    return new Response(JSON.stringify({ message: "No events to remind about" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  let emailsSent = 0;

  for (const event of events) {
    // Get RSVPs with "yes" or "maybe"
    const { data: rsvps } = await supabase
      .from("rsvps")
      .select("user_id")
      .eq("event_id", event.id)
      .in("status", ["yes", "maybe"]);

    if (!rsvps?.length) continue;

    const userIds = rsvps.map((r) => r.user_id);

    // Get user emails
    for (const userId of userIds) {
      const { data: userData } = await supabase.auth.admin.getUserById(userId);
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .single();

      if (!userData?.user?.email) continue;

      const eventDate = new Date(event.start_time).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });

      // Send via Resend
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Incouragers <noreply@incouragers.org>",
          to: userData.user.email,
          subject: `Reminder: ${event.title} is tomorrow!`,
          html: `
            <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
              <h1 style="color: #92400e; font-size: 28px;">Event Reminder</h1>
              <p style="font-size: 18px; line-height: 1.6; color: #44403c;">
                Hi ${profile?.full_name || "Friend"}, just a reminder that <strong>${event.title}</strong> is coming up!
              </p>
              <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="font-size: 18px; margin: 0; color: #44403c;">
                  <strong>When:</strong> ${eventDate}
                </p>
                ${event.location ? `<p style="font-size: 18px; margin: 8px 0 0; color: #44403c;"><strong>Where:</strong> ${event.location}</p>` : ""}
              </div>
              <a href="${SITE_URL}/events"
                 style="display: inline-block; background-color: #92400e; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-size: 18px; margin-top: 20px;">
                View Event
              </a>
            </div>
          `,
        }),
      });

      emailsSent++;
    }
  }

  return new Response(
    JSON.stringify({ message: `Sent ${emailsSent} reminder emails` }),
    { headers: { "Content-Type": "application/json" } }
  );
});
