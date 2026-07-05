import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Play, Users, Bell, Heart, HandHelping } from "lucide-react";
import Link from "next/link";
import { siteConfig } from "@/lib/config";
import { formatServiceDate, toDateString } from "@/lib/serving/sundays";
import { RsvpSegmented } from "./RsvpSegmented";
import type { Rsvp } from "@/lib/types";

export const metadata = { title: `Dashboard | ${siteConfig.name}` };

// ── helpers ──────────────────────────────────────────────────────────────────

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "1 week ago";
  return `${Math.floor(days / 7)} weeks ago`;
}

function eventEyebrow(startTime: string): string {
  const d = new Date(startTime);
  const dow = d.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase();
  const mon = d.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  const day = d.getDate();
  return `${dow} · ${mon} ${day}`;
}

function eventTime(startTime: string): string {
  const d = new Date(startTime);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function eventDayNumber(startTime: string): string {
  return String(new Date(startTime).getDate());
}

function eventWeekday(startTime: string): string {
  return new Date(startTime).toLocaleDateString("en-US", { weekday: "long" });
}

function eventMonthLocation(startTime: string, location: string | null): string {
  const mon = new Date(startTime).toLocaleDateString("en-US", { month: "long" }).toUpperCase();
  return location ? `${mon} · ${location}` : mon;
}

// Avatar colors — deterministic from index
const AVATAR_BG = ["#E8A93C", "#C4704A", "#7BA68A", "#B58A6B", "#6E7E94"];

// Tag color sets for announcements (cycle through 3 variants)
const TAG_STYLES = [
  "bg-brand-accent/15 text-brand-accent",
  "bg-brand-primary/15 text-brand-primary",
  "bg-muted-foreground/15 text-muted-foreground",
];

// ── page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // ── pending state ──────────────────────────────────────────────────────────
  if (!profile || profile.role === "pending") {
    return (
      <div className="container mx-auto px-4 py-20 max-w-lg text-center">
        <Card className="p-8 border-border">
          <CardContent className="pt-6">
            <h1 className="font-serif text-3xl text-brand-primary mb-4">
              Pending Approval
            </h1>
            <p className="text-lg text-muted-foreground">
              Your account is waiting for admin approval. You&apos;ll receive an
              email once your access has been granted.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const displayName =
    profile.preferred_name || profile.first_name || "Friend";

  // ── data fetching ──────────────────────────────────────────────────────────

  const now = new Date().toISOString();

  // Upcoming events (5 max; first = hero)
  const { data: events } = await supabase
    .from("events")
    .select("*")
    .gte("start_time", now)
    .order("start_time", { ascending: true })
    .limit(5);

  const nextEvent = events?.[0] ?? null;

  // User RSVPs
  let userRsvps: Record<string, Rsvp> = {};
  const { data: rsvps } = await supabase
    .from("rsvps")
    .select("*")
    .eq("user_id", user.id);
  if (rsvps) {
    userRsvps = Object.fromEntries(rsvps.map((r) => [r.event_id, r]));
  }

  // RSVP counts + attendee names for hero card
  let goingCount = 0;
  let maybeCount = 0;
  let attendeeInitials: string[] = [];

  if (nextEvent) {
    const { data: eventRsvps } = await supabase
      .from("rsvps")
      .select("status, user_id")
      .eq("event_id", nextEvent.id);

    if (eventRsvps) {
      goingCount = eventRsvps.filter((r) => r.status === "yes").length;
      maybeCount = eventRsvps.filter((r) => r.status === "maybe").length;

      // Grab initials for first 4 "yes" rsvps
      const yesIds = eventRsvps
        .filter((r) => r.status === "yes")
        .slice(0, 4)
        .map((r) => r.user_id);

      if (yesIds.length > 0) {
        const { data: attendeeProfiles } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, preferred_name")
          .in("id", yesIds);

        if (attendeeProfiles) {
          attendeeInitials = attendeeProfiles.map((p) => {
            const fn = p.preferred_name || p.first_name || "?";
            const ln = p.last_name || "";
            return `${fn[0] ?? ""}${ln[0] ?? ""}`.toUpperCase();
          });
        }
      }
    }
  }

  // Announcements (latest 3)
  const { data: announcements } = await supabase
    .from("announcements")
    .select("*")
    .eq("is_published", true)
    .lte("published_at", now)
    .order("published_at", { ascending: false })
    .limit(3);

  // Donation URL
  const { data: donationSetting } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "donation_url")
    .single();
  const donationUrl = donationSetting?.value ?? null;

  // Counts for quick-actions
  const { count: eventCount } = await supabase
    .from("events")
    .select("id", { count: "exact", head: true })
    .gte("start_time", now);

  const { count: memberCount } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .neq("role", "pending");

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const { count: announcementCount } = await supabase
    .from("announcements")
    .select("id", { count: "exact", head: true })
    .eq("is_published", true)
    .gte("published_at", thirtyDaysAgo);

  const { count: lectureCount } = await supabase
    .from("lectures")
    .select("id", { count: "exact", head: true });

  // Recent lectures for "Continue listening" panel
  const { data: lectures } = await supabase
    .from("lectures")
    .select("id, title, description, lecture_date")
    .order("lecture_date", { ascending: false })
    .limit(3);

  const hasLectures = lectures && lectures.length > 0;

  // Upcoming serving commitments for this member (inner join filters to user's rows)
  const { data: myServings } = await supabase
    .from("serving_signups")
    .select("id, service_date, group_id, member_groups(id, name), serving_signup_attendees!inner(profile_id)")
    .eq("serving_signup_attendees.profile_id", profile.id)
    .gte("service_date", toDateString(new Date()))
    .order("service_date", { ascending: true })
    .limit(3);

  const upcomingServings = (myServings ?? []) as Array<{
    id: string;
    service_date: string;
    group_id: string;
    member_groups: { id: string; name: string } | Array<{ id: string; name: string }> | null;
  }>;

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">

      {/* ── Hero: Greeting + Next Event ───────────────────────────────────── */}
      <section className="px-4 pt-14 pb-10 md:px-14">
        {/* Eyebrow */}
        {nextEvent && (
          <div className="flex items-center gap-3 mb-5">
            <div className="h-px w-8 bg-brand-accent" />
            <span
              className="text-brand-accent font-sans font-bold uppercase tracking-[3px] text-[11px]"
            >
              {eventEyebrow(nextEvent.start_time)}
            </span>
          </div>
        )}

        {/* Greeting */}
        <h1 className="font-serif text-5xl md:text-6xl font-medium leading-none tracking-tight text-foreground mb-3">
          {getGreeting()},{" "}
          <em className="text-brand-primary italic">{displayName}</em>.
        </h1>
        <p className="text-[17px] text-muted-foreground max-w-xl leading-relaxed mb-9">
          Here&apos;s what&apos;s on the calendar this week and what your
          friends have been up to.
        </p>

        {/* Next event card */}
        {nextEvent ? (
            <div
              className="rounded-[18px] p-8 relative overflow-hidden"
              style={{
                background: "#2F6BA8",
                boxShadow: "0 14px 40px #2F6BA833",
              }}
            >
              {/* Subtle linen overlay */}
              <div
                className="absolute inset-0 opacity-10 pointer-events-none"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(0deg, rgba(255,255,255,0.4) 0px, rgba(255,255,255,0.4) 1px, transparent 1px, transparent 4px)",
                }}
              />

              <div className="relative text-white">
                {/* Top pill */}
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/20 bg-white/16 text-[11px] font-bold uppercase tracking-[1.5px] mb-6">
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: "#E8A93C" }}
                  />
                  {eventWeekday(nextEvent.start_time)} · {eventTime(nextEvent.start_time)}
                </div>

                {/* Date number + title */}
                <div className="flex items-baseline gap-6">
                  <div
                    className="font-serif font-medium leading-none flex-shrink-0"
                    style={{
                      fontSize: 80,
                      color: "#E8A93C",
                      letterSpacing: "-1.5px",
                    }}
                  >
                    {eventDayNumber(nextEvent.start_time)}
                  </div>
                  <div>
                    <div className="font-sans text-xs uppercase tracking-[2px] opacity-75 font-semibold">
                      {eventMonthLocation(nextEvent.start_time, nextEvent.location)}
                    </div>
                    <div
                      className="font-serif font-medium mt-1.5 leading-[1.1]"
                      style={{ fontSize: 34, letterSpacing: "-0.5px" }}
                    >
                      {nextEvent.title}
                    </div>
                    {nextEvent.description && (
                      <div className="font-serif italic text-[17px] opacity-85 mt-1">
                        {nextEvent.description.length > 80
                          ? nextEvent.description.slice(0, 80) + "…"
                          : nextEvent.description}
                      </div>
                    )}
                  </div>
                </div>

                {/* Divider + RSVP row */}
                <div
                  className="flex flex-col sm:flex-row sm:items-center gap-4 mt-6 pt-5"
                  style={{ borderTop: "1px solid rgba(255,255,255,0.18)" }}
                >
                  {/* Attendee avatars */}
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex">
                      {(attendeeInitials.length > 0
                        ? attendeeInitials
                        : ["?"]
                      )
                        .slice(0, 4)
                        .map((initials, i) => (
                          <div
                            key={i}
                            className="w-8 h-8 rounded-full border-2 flex items-center justify-center font-sans text-xs font-semibold text-white flex-shrink-0"
                            style={{
                              background: AVATAR_BG[i % AVATAR_BG.length],
                              borderColor: "#2F6BA8",
                              marginLeft: i === 0 ? 0 : -10,
                            }}
                          >
                            {initials}
                          </div>
                        ))}
                    </div>
                    <div className="font-sans text-sm opacity-90">
                      {goingCount > 0 ? (
                        <>
                          <strong style={{ color: "#E8A93C" }}>
                            {goingCount} going
                          </strong>
                          {maybeCount > 0 && (
                            <> · {maybeCount} maybe</>
                          )}
                        </>
                      ) : (
                        <span className="opacity-60">Be the first to RSVP</span>
                      )}
                    </div>
                  </div>

                  {/* RSVP segmented control */}
                  <RsvpSegmented
                    eventId={nextEvent.id}
                    userId={user.id}
                    currentStatus={userRsvps[nextEvent.id]?.status ?? null}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-[18px] bg-brand-warm border border-border flex items-center justify-center p-10 text-muted-foreground text-center">
              <div>
                <Calendar className="h-10 w-10 mx-auto mb-3 text-brand-primary/40" />
                <p className="font-serif text-xl text-foreground/60">No upcoming events</p>
                <p className="text-sm mt-1">Check back soon.</p>
              </div>
            </div>
          )}
      </section>

      {/* ── Quick Actions ─────────────────────────────────────────────────── */}
      <section className="px-4 pb-6 md:px-14">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">

          {/* All Events */}
          <Link
            href="/events"
            className="flex items-center gap-3.5 bg-card border border-border rounded-2xl p-4 hover:bg-muted/40 transition-colors"
          >
            <div className="w-[42px] h-[42px] rounded-xl bg-brand-warm flex items-center justify-center flex-shrink-0">
              <Calendar className="h-5 w-5 text-brand-primary" />
            </div>
            <div>
              <div className="font-sans text-sm font-semibold text-foreground">
                All events
              </div>
              <div className="font-sans text-xs text-muted-foreground mt-0.5">
                {eventCount != null ? `${eventCount} upcoming` : "View calendar"}
              </div>
            </div>
          </Link>

          {/* Lectures */}
          {lectureCount != null && lectureCount > 0 && (
            <Link
              href="/lectures"
              className="flex items-center gap-3.5 bg-card border border-border rounded-2xl p-4 hover:bg-muted/40 transition-colors"
            >
              <div className="w-[42px] h-[42px] rounded-xl bg-brand-warm flex items-center justify-center flex-shrink-0">
                <Play className="h-5 w-5 text-brand-primary" />
              </div>
              <div>
                <div className="font-sans text-sm font-semibold text-foreground">
                  Lectures
                </div>
                <div className="font-sans text-xs text-muted-foreground mt-0.5">
                  {lectureCount} in library
                </div>
              </div>
            </Link>
          )}

          {/* Directory */}
          <Link
            href="/directory"
            className="flex items-center gap-3.5 bg-card border border-border rounded-2xl p-4 hover:bg-muted/40 transition-colors"
          >
            <div className="w-[42px] h-[42px] rounded-xl bg-brand-warm flex items-center justify-center flex-shrink-0">
              <Users className="h-5 w-5 text-brand-primary" />
            </div>
            <div>
              <div className="font-sans text-sm font-semibold text-foreground">
                Directory
              </div>
              <div className="font-sans text-xs text-muted-foreground mt-0.5">
                {memberCount != null ? `${memberCount} members` : "View all"}
              </div>
            </div>
          </Link>

          {/* Announcements */}
          <Link
            href="/announcements"
            className="flex items-center gap-3.5 bg-card border border-border rounded-2xl p-4 hover:bg-muted/40 transition-colors"
          >
            <div className="w-[42px] h-[42px] rounded-xl bg-brand-warm flex items-center justify-center flex-shrink-0">
              <Bell className="h-5 w-5 text-brand-primary" />
            </div>
            <div>
              <div className="font-sans text-sm font-semibold text-foreground">
                Announcements
              </div>
              <div className="font-sans text-xs text-muted-foreground mt-0.5">
                {announcementCount != null && announcementCount > 0
                  ? `${announcementCount} new`
                  : "See all"}
              </div>
            </div>
          </Link>

          {/* Give — only if donationUrl exists */}
          {donationUrl && (
            <a
              href={donationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3.5 bg-card border border-border rounded-2xl p-4 hover:bg-muted/40 transition-colors"
            >
              <div className="w-[42px] h-[42px] rounded-xl bg-brand-warm flex items-center justify-center flex-shrink-0">
                <Heart className="h-5 w-5 text-brand-primary" />
              </div>
              <div>
                <div className="font-sans text-sm font-semibold text-foreground">
                  Give
                </div>
                <div className="font-sans text-xs text-muted-foreground mt-0.5">
                  Tithe online
                </div>
              </div>
            </a>
          )}
        </div>
      </section>

      {/* ── Your turn to serve ───────────────────────────────────────────── */}
      {upcomingServings.length > 0 && (
        <section className="px-4 pb-6 md:px-14">
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <HandHelping className="h-5 w-5 text-brand-primary" />
              <h2 className="font-sans text-sm font-semibold text-foreground uppercase tracking-wider">
                Your turn to serve
              </h2>
            </div>
            <div className="space-y-2">
              {upcomingServings.map((s) => (
                <Link
                  key={s.id}
                  href={`/serving/${s.group_id}`}
                  className="flex items-center justify-between gap-4 py-2 border-t border-border first:border-0 hover:text-brand-primary transition-colors"
                >
                  <div>
                    <div className="font-sans text-sm font-semibold text-foreground">
                      {(Array.isArray(s.member_groups) ? s.member_groups[0]?.name : s.member_groups?.name) ?? "Serving team"}
                    </div>
                    <div className="font-sans text-xs text-muted-foreground mt-0.5">
                      {formatServiceDate(s.service_date)}
                    </div>
                  </div>
                  <span className="font-sans text-xs font-semibold text-brand-primary shrink-0">
                    View →
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Bottom: Announcements + Continue Listening ───────────────────── */}
      <section
        className={`border-t border-border bg-card px-4 py-10 md:px-14 md:pb-16 grid gap-8 ${
          hasLectures ? "grid-cols-1 lg:grid-cols-[1.3fr_1fr]" : "grid-cols-1"
        }`}
      >
        {/* ── Announcements ── */}
        <div>
          <div className="flex items-baseline justify-between mb-5">
            <h2 className="font-serif text-[30px] font-medium text-foreground tracking-tight">
              Announcements
            </h2>
            <Link
              href="/announcements"
              className="font-sans text-[13px] font-semibold text-brand-primary hover:underline"
            >
              See all →
            </Link>
          </div>

          {announcements && announcements.length > 0 ? (
            <div>
              {announcements.map((a, i) => {
                const tagClass = TAG_STYLES[i % TAG_STYLES.length];
                const publishedAt = a.published_at || a.created_at;
                // Plain-text excerpt from content (may be JSON blocks or HTML)
                let excerpt = "";
                try {
                  const blocks: Array<{ content?: Array<{ text?: string }> }> =
                    JSON.parse(a.content);
                  excerpt = blocks
                    .flatMap((b) => b.content ?? [])
                    .map((c) => c.text ?? "")
                    .join(" ")
                    .slice(0, 140);
                } catch {
                  // strip HTML tags
                  excerpt = a.content.replace(/<[^>]+>/g, "").slice(0, 140);
                }

                return (
                  <div
                    key={a.id}
                    className="py-5 grid grid-cols-[1fr_auto] gap-5 items-start"
                    style={
                      i > 0
                        ? { borderTop: "1px solid var(--color-border)" }
                        : undefined
                    }
                  >
                    <div>
                      {/* Tag pill */}
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-[1px] mb-2 ${tagClass}`}
                      >
                        {a.title.split(" ")[0].toUpperCase()}
                      </span>
                      <h3 className="font-serif text-[22px] font-medium text-foreground tracking-tight leading-snug mb-1">
                        {a.title}
                      </h3>
                      {excerpt && (
                        <p className="font-sans text-sm text-muted-foreground leading-relaxed line-clamp-2">
                          {excerpt}
                        </p>
                      )}
                      <p className="font-sans text-xs text-muted-foreground mt-2">
                        {timeAgo(publishedAt)}
                      </p>
                    </div>
                    <Link
                      href={`/announcements/${a.id}`}
                      className="font-sans text-[13px] font-semibold text-brand-primary hover:underline whitespace-nowrap pt-1"
                    >
                      Read →
                    </Link>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-base">
              No announcements yet.
            </p>
          )}
        </div>

        {/* ── Continue Listening (only if lectures exist) ── */}
        {hasLectures && (
          <div>
            <div className="flex items-baseline justify-between mb-5">
              <h2 className="font-serif text-[30px] font-medium text-foreground tracking-tight">
                Continue listening
              </h2>
            </div>

            <div>
              {lectures.map((lec, i) => {
                // Derive a "week" label from lecture_date order or index
                const weekLabel = `Wk ${String(i + 1).padStart(2, "0")}`;

                return (
                  <div
                    key={lec.id}
                    className="flex gap-3.5 py-3.5"
                    style={
                      i > 0
                        ? { borderTop: "1px solid var(--color-border)" }
                        : undefined
                    }
                  >
                    {/* Thumbnail */}
                    <div
                      className="w-24 flex-shrink-0 rounded-lg relative overflow-hidden flex items-center justify-center"
                      style={{
                        aspectRatio: "16/10",
                        background:
                          "linear-gradient(135deg, #2F6BA8 0%, #15243A 100%)",
                      }}
                    >
                      {/* Play circle */}
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center"
                        style={{ background: "#E8A93C" }}
                      >
                        <svg
                          width="9"
                          height="11"
                          viewBox="0 0 9 11"
                          aria-hidden="true"
                        >
                          <path
                            d="M1 1l7 4.5-7 4.5V1z"
                            fill="#15243A"
                          />
                        </svg>
                      </div>
                    </div>

                    {/* Meta */}
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-[11px] text-muted-foreground mb-0.5 uppercase tracking-wider">
                        {weekLabel}
                      </div>
                      <div className="font-serif text-[18px] font-medium text-foreground tracking-tight leading-snug truncate">
                        {lec.title}
                      </div>
                      {lec.description && (
                        <div className="font-sans text-xs text-muted-foreground mt-0.5 truncate">
                          {lec.description}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
