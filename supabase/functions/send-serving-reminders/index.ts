// Supabase Edge Function: send-serving-reminders
//
// Two modes, two pg_cron entries — schedule defined in
// supabase/migrations/20260729000000_reminder_cron_schedules.sql (not here,
// so it survives a point-in-time restore or self-host from this repo):
//
//   - "send-serving-reminders-daily": remind attendees of covered Sundays
//     (per-team reminder_days — see serving_team_settings)
//   - "send-serving-monthly-broadcast": broadcast open Sundays on the 1st
//
// Runs with the service key (BYPASSRLS), so tenant isolation lives in the
// query text: iterates every active organization and filters each query on
// org_id explicitly (CWA-10 Phase 3, #212).

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveServiceKey } from "../_shared/service-key.ts";
import {
  forEachOrg,
  listActiveOrgs,
  summarize,
  type OrgListClient,
} from "../_shared/orgs.ts";

// What createClient(url, key) actually returns; ReturnType<typeof createClient>
// resolves the unbound generics to a different, incompatible instantiation.
type ServiceClient = SupabaseClient<any, "public", any>;

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SECRET_KEY = resolveServiceKey();
const SITE_URL = Deno.env.get("SITE_URL") || "https://incouragers.org";
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") || "two42 <noreply@incouragers.org>";
const APP_NAME = Deno.env.get("APP_NAME") || "two42";
const BRAND_COLOR = Deno.env.get("BRAND_COLOR") || "#B85C38";
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

function nextSunday(from: Date = new Date()): string {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  return toDateStr(d);
}

function upcomingSundays(weeks: number, from: Date = new Date()): string[] {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  const result: string[] = [];
  for (let i = 0; i < weeks; i++) {
    result.push(toDateStr(d));
    d.setDate(d.getDate() + 7);
  }
  return result;
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

// ── Shared: resolve link mode ─────────────────────────────────────────────────

// Org-scoped: the key-only read errored outright at two orgs (the bug class
// closed for the app layer in lib/serving/config.ts and recorded for this
// function in docs/security/service-role-inventory.md). An unresolvable link
// mode is an org-level failure — throw so the per-org boundary catches it
// instead of silently degrading every link to unsigned.
async function resolveCanSign(supabase: ServiceClient, orgId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("site_settings")
    .select("value")
    .eq("org_id", orgId)
    .eq("key", "serving_link_mode")
    .maybeSingle();
  if (error) throw new Error(`site_settings query failed: ${error.message}`);
  const mode = (data?.value ?? SERVING_LINK_MODE) === "login" ? "login" : "signed";
  return mode === "signed" && !!SERVING_LINK_SECRET;
}

// ── Daily mode: remind attendees of the next covered Sunday ──────────────────

async function runDaily(
  supabase: ServiceClient,
  orgId: string,
  canSign: boolean
): Promise<number> {
  const todayDow = new Date().getDay();

  // Only process teams whose reminder_days include today
  const { data: teamSettings, error: teamSettingsError } = await supabase
    .from("serving_team_settings")
    .select("group_id")
    .eq("org_id", orgId)
    .eq("enabled", true)
    .contains("reminder_days", [todayDow]);

  if (teamSettingsError) {
    throw new Error(`serving_team_settings query failed: ${teamSettingsError.message}`);
  }
  if (!teamSettings?.length) return 0;

  let sent = 0;

  for (const { group_id } of teamSettings) {
    const { data: group, error: groupError } = await supabase
      .from("member_groups")
      .select("name")
      .eq("org_id", orgId)
      .eq("id", group_id)
      .maybeSingle();
    if (groupError) throw new Error(`member_groups query failed: ${groupError.message}`);
    if (!group) continue;
    const teamName = group.name as string;

    const sunday = nextSunday();

    const { data: signup, error: signupError } = await supabase
      .from("serving_signups")
      .select("id, serving_signup_attendees(profiles(id, first_name, preferred_name, email))")
      .eq("org_id", orgId)
      .eq("group_id", group_id)
      .eq("service_date", sunday)
      .maybeSingle();
    if (signupError) throw new Error(`serving_signups query failed: ${signupError.message}`);

    if (!signup) continue; // open Sunday — no reminder to send

    const attendees = (signup.serving_signup_attendees ?? []) as unknown as Array<{
      profiles: { id: string; first_name: string | null; preferred_name: string | null; email: string | null } | null;
    }>;

    for (const { profiles: p } of attendees) {
      if (!p?.email) continue;
      const name = escapeHtml(p.preferred_name || p.first_name || "Friend");
      const safeTeam = escapeHtml(teamName);
      const dateLabel = escapeHtml(formatDate(sunday));

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
            Hi ${name}, just a reminder that you&rsquo;re signed up to serve with the
            <strong>${safeTeam}</strong> this Sunday.
          </p>
          <div style="background:#fef3c7;padding:20px;border-radius:8px;margin:20px 0;">
            <p style="font-size:18px;margin:0;color:#44403c;">
              <strong>When:</strong> ${dateLabel}
            </p>
          </div>
          <p style="font-size:14px;color:#78716c;">
            Can&rsquo;t make it?
            <a href="${cancelUrl}" style="color:${BRAND_COLOR};">Click here to cancel</a>
            so someone else can cover.
          </p>
        `),
      })) sent++;
    }
  }

  return sent;
}

// ── Monthly mode: broadcast open Sundays to the whole team ───────────────────

async function runMonthly(
  supabase: ServiceClient,
  orgId: string,
  canSign: boolean
): Promise<number> {
  const { data: teamSettings, error: teamSettingsError } = await supabase
    .from("serving_team_settings")
    .select("group_id, window_weeks")
    .eq("org_id", orgId)
    .eq("enabled", true);

  if (teamSettingsError) {
    throw new Error(`serving_team_settings query failed: ${teamSettingsError.message}`);
  }
  if (!teamSettings?.length) return 0;

  let sent = 0;

  for (const { group_id, window_weeks } of teamSettings) {
    let teamSent = 0;
    const { data: group, error: groupError } = await supabase
      .from("member_groups")
      .select("name")
      .eq("org_id", orgId)
      .eq("id", group_id)
      .maybeSingle();
    if (groupError) throw new Error(`member_groups query failed: ${groupError.message}`);
    if (!group) continue;
    const teamName = group.name as string;

    const sundays = upcomingSundays(window_weeks ?? 8);

    // Find which Sundays are already covered
    const { data: signups, error: signupsError } = await supabase
      .from("serving_signups")
      .select("service_date")
      .eq("org_id", orgId)
      .eq("group_id", group_id)
      .in("service_date", sundays);
    if (signupsError) throw new Error(`serving_signups query failed: ${signupsError.message}`);

    const covered = new Set((signups ?? []).map((s) => s.service_date as string));
    const openDates = sundays.filter((d) => !covered.has(d));

    if (!openDates.length) continue; // all covered — nothing to broadcast

    // Get all team members
    const { data: members, error: membersError } = await supabase
      .from("profile_groups")
      .select("profiles(id, first_name, preferred_name, email, email_announcements)")
      .eq("org_id", orgId)
      .eq("group_id", group_id);
    if (membersError) throw new Error(`profile_groups query failed: ${membersError.message}`);

    for (const row of members ?? []) {
      const m = row.profiles as unknown as {
        id: string;
        first_name: string | null;
        preferred_name: string | null;
        email: string | null;
        email_announcements: boolean;
      } | null;
      if (!m?.email || m.email_announcements === false) continue;

      const name = escapeHtml(m.preferred_name || m.first_name || "Friend");
      const safeTeam = escapeHtml(teamName);

      const rows = await Promise.all(
        openDates.map(async (date) => {
          let signupUrl = `${SITE_URL}/serving/${group_id}`;
          if (canSign) {
            signupUrl = `${SITE_URL}/serving/go?token=${await createToken(
              { a: "signup", g: group_id, d: date, p: m.id },
              SERVING_LINK_SECRET!
            )}`;
          }
          return `
            <table role="presentation" width="100%" style="border-bottom:1px solid #e7e5e4;">
              <tr>
                <td style="padding:14px 0;font-size:18px;color:#44403c;">${escapeHtml(formatDate(date))}</td>
                <td align="right" style="padding:14px 0;">
                  <a href="${signupUrl}"
                     style="display:inline-block;background-color:${BRAND_COLOR};color:white;padding:10px 20px;text-decoration:none;border-radius:8px;font-size:16px;white-space:nowrap;">
                    I&rsquo;ll do it
                  </a>
                </td>
              </tr>
            </table>`;
        })
      );

      if (await sendEmail({
        to: m.email,
        subject: `${teamName}: open Sundays for the coming weeks`,
        html: wrap(`
          <h1 style="color:${BRAND_COLOR};font-size:28px;">Can you take a Sunday?</h1>
          <p style="font-size:18px;line-height:1.6;color:#44403c;">
            Hi ${name}, here are the upcoming Sundays for the <strong>${safeTeam}</strong>
            that still need a volunteer. Tap a button and you&rsquo;re signed up.
          </p>
          ${rows.join("")}
          <p style="font-size:14px;color:#78716c;margin-top:24px;">
            Want to see the full schedule?
            <a href="${SITE_URL}/serving/${group_id}" style="color:${BRAND_COLOR};">View the team page</a>
          </p>
        `),
      })) { sent++; teamSent++; }
    }

    // Log broadcast (service key bypasses RLS; sent_by = null marks automated;
    // org_id comes from the row context being processed, not a constant).
    // Do not throw on failure — the emails have already gone out, and an
    // audit-log problem must not abort the remaining teams.
    const { error: broadcastError } = await supabase.from("serving_broadcasts").insert({
      group_id,
      sent_by: null,
      org_id: orgId,
      subject: `${teamName}: monthly open-Sunday broadcast`,
      open_dates: openDates,
      recipient_count: teamSent,
    });
    if (broadcastError) {
      console.error(`[org ${orgId}] serving_broadcasts insert failed for group ${group_id}:`, broadcastError.message);
    }
  }

  return sent;
}

// ── Entry point ───────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  let mode = "daily";
  try {
    const body = await req.json();
    if (body?.mode === "monthly") mode = "monthly";
  } catch {
    // no body or bad JSON — default to daily
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);
  // Cast: structurally checking the full SupabaseClient against OrgListClient
  // trips TS2589 (excessively deep instantiation) on current supabase-js.
  const orgs = await listActiveOrgs(supabase as unknown as OrgListClient);
  const summary = summarize(
    await forEachOrg(orgs, async (org) => {
      // Resolved inside the per-org callback so a failure here is caught by
      // this org's boundary instead of aborting the whole run.
      const canSign = await resolveCanSign(supabase, org.id);
      return mode === "monthly"
        ? await runMonthly(supabase, org.id, canSign)
        : await runDaily(supabase, org.id, canSign);
    }),
  );

  return new Response(
    JSON.stringify({ mode, message: `Sent ${summary.emailsSent} emails`, ...summary }),
    { headers: { "Content-Type": "application/json" } }
  );
});
