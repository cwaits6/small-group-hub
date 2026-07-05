// Supabase Edge Function: send-serving-reminders
// Runs daily via pg_cron. For each enabled serving team where today is a
// reminder day, emails attendees if the next Sunday is covered, or nudges
// all team members if it's still open.
//
// pg_cron setup (run once in Supabase SQL editor — never by CI):
//
//   select cron.schedule(
//     'send-serving-reminders',
//     '0 8 * * *',
//     $$
//       select net.http_post(
//         url := '<SUPABASE_PROJECT_URL>/functions/v1/send-serving-reminders',
//         headers := '{"Authorization":"Bearer <SERVICE_ROLE_KEY>","Content-Type":"application/json"}'::jsonb,
//         body := '{}'::jsonb
//       );
//     $$
//   );

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SECRET_KEY = Deno.env.get("SUPABASE_SECRET_KEY")!;
const SITE_URL = Deno.env.get("SITE_URL") || "https://incouragers.org";
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") || "Incouragers <noreply@incouragers.org>";
const APP_NAME = Deno.env.get("APP_NAME") || "Incouragers";
const BRAND_COLOR = Deno.env.get("BRAND_COLOR") || "#2F6BA8";
const SERVING_LINK_SECRET = Deno.env.get("SERVING_LINK_SECRET");
const SERVING_LINK_MODE = Deno.env.get("SERVING_LINK_MODE") || "signed";

// ── HMAC token (same format as lib/serving/links.ts) ─────────────────────────

interface ServingLinkPayload {
  v: 1;
  a: "signup" | "cancel";
  g: string;
  d: string;
  p: string;
  exp: number;
}

function b64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function b64urlStr(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function hmacSign(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return b64url(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)));
}

async function createToken(
  payload: Omit<ServingLinkPayload, "v" | "exp">,
  secret: string,
  ttlDays = 60
): Promise<string> {
  const full: ServingLinkPayload = {
    v: 1,
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ttlDays * 86400,
  };
  const payloadB64 = b64urlStr(JSON.stringify(full));
  return `${payloadB64}.${await hmacSign(payloadB64, secret)}`;
}

// ── Sunday helpers ────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** The next calendar Sunday from `from`, or today if today is a Sunday. */
function nextSunday(from: Date = new Date()): string {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  return toDateStr(d);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ── Email ─────────────────────────────────────────────────────────────────────

async function sendEmail(opts: { to: string; subject: string; html: string }): Promise<boolean> {
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
      console.error("Resend error for", opts.to, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("Resend request failed for", opts.to, err);
    return false;
  }
}

function wrap(inner: string): string {
  return `<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:40px 20px;">
    ${inner}
    <p style="font-size:14px;color:#78716c;margin-top:40px;">&mdash; The ${escapeHtml(APP_NAME)} Team</p>
  </div>`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);
  const todayDow = new Date().getDay(); // 0=Sun … 6=Sat

  // Teams where today is a configured reminder day
  const { data: teamSettings } = await supabase
    .from("serving_team_settings")
    .select("group_id, window_weeks, reminder_days")
    .eq("enabled", true)
    .contains("reminder_days", [todayDow]);

  if (!teamSettings?.length) {
    return new Response(
      JSON.stringify({ message: "No reminders to send today" }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  // Whether signed links are in use for this installation
  const { data: lmSetting } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "serving_link_mode")
    .maybeSingle();
  const linkMode = (lmSetting?.value ?? SERVING_LINK_MODE) === "login" ? "login" : "signed";
  const canSign = linkMode === "signed" && !!SERVING_LINK_SECRET;

  let emailsSent = 0;

  for (const { group_id } of teamSettings) {
    // Group name
    const { data: group } = await supabase
      .from("member_groups")
      .select("name")
      .eq("id", group_id)
      .single();
    if (!group) continue;
    const teamName = group.name as string;

    const sunday = nextSunday();
    const dateLabel = formatDate(sunday);

    // Is this Sunday covered?
    const { data: signup } = await supabase
      .from("serving_signups")
      .select("id, serving_signup_attendees(profiles(id, first_name, preferred_name, email))")
      .eq("group_id", group_id)
      .eq("service_date", sunday)
      .maybeSingle();

    if (signup) {
      // ── Covered: remind each attendee ─────────────────────────────────
      const attendees = (signup.serving_signup_attendees ?? []) as Array<{
        profiles: { id: string; first_name: string | null; preferred_name: string | null; email: string | null } | null;
      }>;

      for (const { profiles: p } of attendees) {
        if (!p?.email) continue;
        const name = p.preferred_name || p.first_name || "Friend";
        const safeName = escapeHtml(name);
        const safeTeamName = escapeHtml(teamName);
        const safeDateLabel = escapeHtml(dateLabel);

        let cancelUrl = `${SITE_URL}/serving/${group_id}`;
        if (canSign) {
          cancelUrl = `${SITE_URL}/serving/go?token=${await createToken(
            { a: "cancel", g: group_id, d: sunday, p: p.id },
            SERVING_LINK_SECRET!
          )}`;
        }

        if (await sendEmail({
          to: p.email,
          subject: `Reminder: you're serving this Sunday with the ${teamName}`,
          html: wrap(`
            <h1 style="color:${BRAND_COLOR};font-size:28px;">See you Sunday!</h1>
            <p style="font-size:18px;line-height:1.6;color:#44403c;">
              Hi ${safeName}, just a reminder that you&rsquo;re signed up to serve with the
              <strong>${safeTeamName}</strong> this Sunday.
            </p>
            <div style="background:#fef3c7;padding:20px;border-radius:8px;margin:20px 0;">
              <p style="font-size:18px;margin:0;color:#44403c;">
                <strong>When:</strong> ${safeDateLabel}
              </p>
            </div>
            <p style="font-size:14px;color:#78716c;">
              Can&rsquo;t make it?
              <a href="${cancelUrl}" style="color:${BRAND_COLOR};">Click here to cancel</a>
              so someone else can cover.
            </p>
          `),
        })) {
          emailsSent++;
        }
      }
    } else {
      // ── Open: nudge all team members ──────────────────────────────────
      const { data: members } = await supabase
        .from("profile_groups")
        .select("profiles(id, first_name, preferred_name, email)")
        .eq("group_id", group_id);

      for (const row of members ?? []) {
        const m = row.profiles as { id: string; first_name: string | null; preferred_name: string | null; email: string | null } | null;
        if (!m?.email) continue;

        const name = m.preferred_name || m.first_name || "Friend";
        const safeName = escapeHtml(name);
        const safeTeamName = escapeHtml(teamName);
        const safeDateLabel = escapeHtml(dateLabel);
        let signupUrl = `${SITE_URL}/serving/${group_id}`;
        if (canSign) {
          signupUrl = `${SITE_URL}/serving/go?token=${await createToken(
            { a: "signup", g: group_id, d: sunday, p: m.id },
            SERVING_LINK_SECRET!
          )}`;
        }

        if (await sendEmail({
          to: m.email,
          subject: `${teamName}: this Sunday still needs someone`,
          html: wrap(`
            <h1 style="color:${BRAND_COLOR};font-size:28px;">Can you take this Sunday?</h1>
            <p style="font-size:18px;line-height:1.6;color:#44403c;">
              Hi ${safeName}, the <strong>${safeTeamName}</strong> still needs a volunteer
              for this Sunday.
            </p>
            <table role="presentation" width="100%" style="border-bottom:1px solid #e7e5e4;">
              <tr>
                <td style="padding:14px 0;font-size:18px;color:#44403c;">${safeDateLabel}</td>
                <td align="right" style="padding:14px 0;">
                  <a href="${signupUrl}"
                     style="display:inline-block;background-color:${BRAND_COLOR};color:white;padding:10px 20px;text-decoration:none;border-radius:8px;font-size:16px;white-space:nowrap;">
                    I&rsquo;ll do it
                  </a>
                </td>
              </tr>
            </table>
          `),
        })) {
          emailsSent++;
        }
      }
    }
  }

  return new Response(
    JSON.stringify({ message: `Sent ${emailsSent} reminder emails` }),
    { headers: { "Content-Type": "application/json" } }
  );
});
