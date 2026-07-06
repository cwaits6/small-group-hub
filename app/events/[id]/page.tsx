import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EventRsvpPanel } from "./_components/EventRsvpPanel";
import { AddToCalendarButton } from "@/components/events/AddToCalendarButton";
import { SubscribeToEventButton } from "@/components/events/SubscribeToEventButton";
import { AttendeeStrip, type Attendee } from "./_components/AttendeeStrip";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { siteConfig } from "@/lib/config";
import type { Event, EventCalendar, Rsvp } from "@/lib/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("title")
    .eq("id", id)
    .single();

  if (!event) {
    return { title: `Event | ${siteConfig.name}` };
  }

  return { title: `${event.title} | ${siteConfig.name}` };
}

// ── MetaCell: a single column in the meta strip ──────────────────────────────
function MetaCell({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string | null;
}) {
  return (
    <div>
      <div className="font-sans text-[11px] uppercase tracking-[1.8px] text-muted-foreground font-semibold">
        {label}
      </div>
      <div className="font-serif text-[22px] font-medium text-foreground mt-1 leading-tight tracking-tight">
        {value}
      </div>
      {sub && (
        <div className="font-sans text-xs text-muted-foreground mt-0.5">
          {sub}
        </div>
      )}
    </div>
  );
}

export default async function EventDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ occurrence?: string }>;
}) {
  const { id } = await params;
  const { occurrence } = await searchParams;
  const supabase = await createClient();

  // Fetch event with calendar join
  const { data: eventRaw } = await supabase
    .from("events")
    .select("*, calendar:event_calendars(*)")
    .eq("id", id)
    .single();

  if (!eventRaw) notFound();

  const event = eventRaw as Event & { calendar?: EventCalendar | null };

  // Auth
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    profile = data;
  }

  const isAdmin = profile?.role === "admin";
  const isMember =
    profile?.role === "member" ||
    profile?.role === "content_editor" ||
    isAdmin;

  // Fetch the user's calendar subscription token
  let subscriptionToken: string | null = null;
  if (user && isMember) {
    const { data: tokenRow } = await supabase
      .from("calendar_subscription_tokens")
      .select("token")
      .eq("user_id", user.id)
      .single();
    subscriptionToken = tokenRow?.token ?? null;
  }

  // Fetch current user's RSVP
  let userRsvp: Rsvp | null = null;
  if (user && isMember) {
    const { data } = await supabase
      .from("rsvps")
      .select("*")
      .eq("event_id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    userRsvp = data;
  }

  // Fetch attendees (yes + maybe) joined with profiles — only when RSVP is enabled
  let attendees: Attendee[] = [];
  if (event.is_rsvp_enabled) {
    const { data: rsvpsRaw } = await supabase
      .from("rsvps")
      .select("user_id, status, profiles(id, first_name, last_name, avatar_url)")
      .eq("event_id", id)
      .in("status", ["yes", "maybe"]);

    attendees = (rsvpsRaw ?? []).map((r) => {
      const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
      return {
        id: p?.id ?? r.user_id,
        first_name: p?.first_name ?? null,
        last_name: p?.last_name ?? null,
        avatar_url: p?.avatar_url ?? null,
        status: r.status as Attendee["status"],
      };
    });
  }

  // Formatting helpers.
  // When viewing a specific occurrence of a recurring series, shift the displayed
  // start/end times to that occurrence's date while preserving the event duration.
  let displayStartTime = event.start_time;
  let displayEndTime = event.end_time;

  if (occurrence && event.recurrence_frequency && !event.series_id) {
    try {
      const occurrenceISO = decodeURIComponent(occurrence);
      const parsedOccurrence = new Date(occurrenceISO);
      if (!isNaN(parsedOccurrence.getTime())) {
        displayStartTime = occurrenceISO;
        if (event.end_time) {
          const duration =
            new Date(event.end_time).getTime() - new Date(event.start_time).getTime();
          displayEndTime = new Date(parsedOccurrence.getTime() + duration).toISOString();
        }
      }
    } catch {
      // malformed percent-encoding — fall back to base event times
    }
  }

  const startDate = new Date(displayStartTime);
  const endDate = displayEndTime ? new Date(displayEndTime) : null;
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  // Short date for meta strip
  const shortDate = startDate.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "America/New_York",
  });

  const shortYear = startDate.toLocaleDateString("en-US", {
    year: "numeric",
    timeZone: "America/New_York",
  });

  const formatTime = (d: Date) =>
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });

  // Build the edit URL — include the occurrence param for recurring series so the
  // edit page knows which occurrence is being modified.
  const editHref = occurrence && event.recurrence_frequency && !event.series_id
    ? `/admin/events/${id}/edit?occurrence=${encodeURIComponent(occurrence)}`
    : `/admin/events/${id}/edit`;

  // Breadcrumb date label
  const breadcrumbDate = startDate.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "America/New_York",
  });

  // Upcoming pill: compute days until event
  const now = new Date();
  // Compare dates only (strip time) in America/New_York
  const todayNY = new Date(now.toLocaleDateString("en-US", { timeZone: "America/New_York" }));
  const eventNY = new Date(startDate.toLocaleDateString("en-US", { timeZone: "America/New_York" }));
  const diffMs = eventNY.getTime() - todayNY.getTime();
  const diffDays = Math.round(diffMs / 86400000);
  let upcomingLabel: string | null = null;
  if (diffDays === 0) upcomingLabel = "Today";
  else if (diffDays === 1) upcomingLabel = "Tomorrow";
  else if (diffDays > 1 && diffDays <= 7) upcomingLabel = `In ${diffDays} days`;

  // Attendee counts

  return (
    <div className="relative min-h-screen bg-background">
      {/* Subtle paper-grain texture overlay — same as homepage hero */}
      <div
        className="absolute inset-0 opacity-[0.025] pointer-events-none"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' seed='3'/%3E%3CfeColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.5 0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")",
        }}
      />

      <div className="relative container mx-auto px-4 py-8 md:py-12 max-w-6xl">
        {/* ── Breadcrumb ── */}
        <div className="flex items-center justify-between mb-8">
          <nav className="font-sans text-sm text-muted-foreground">
            <Link href="/events" className="hover:text-foreground transition-colors">
              Events
            </Link>
            <span className="mx-2 text-muted-foreground/50">›</span>
            <span className="text-foreground font-medium">
              {breadcrumbDate} · {event.title}
            </span>
          </nav>

          {/* Admin edit button — top right, visually subordinate */}
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-muted-foreground hover:border-brand-primary/30 hover:text-brand-primary"
              nativeButton={false}
              render={<Link href={editHref} />}
            >
              <Pencil className="h-3 w-3" />
              Edit
            </Button>
          )}
        </div>

        {/* ── Two-column grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr] gap-10 md:gap-12 items-start">

          {/* ═══════════════════════════════════════════════
              LEFT COLUMN — hero + meta + description
          ═══════════════════════════════════════════════ */}
          <div>
            {/* Upcoming pill */}
            {upcomingLabel && (
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5"
                style={{ background: "rgba(232,169,60,0.13)" }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: "#E8A93C" }}
                />
                <span
                  className="font-sans text-[11px] font-bold uppercase tracking-[1.5px]"
                  style={{ color: "#E8A93C" }}
                >
                  {diffDays <= 1
                    ? upcomingLabel
                    : `This week · ${upcomingLabel.toLowerCase()}`}
                </span>
              </div>
            )}

            {/* Title */}
            <h1 className="font-serif text-5xl md:text-6xl font-medium text-foreground leading-[1.05] tracking-tight">
              {event.title}
            </h1>

            {/* Calendar name as serif-italic subtitle — only if present */}
            {event.calendar?.name && (
              <p
                className="font-serif italic text-[22px] mt-2 leading-snug tracking-tight"
                style={{ color: "#2F6BA8" }}
              >
                {event.calendar.name}
              </p>
            )}

            {/* Meta strip */}
            <div className="mt-8 py-5 grid gap-6 border-t border-b border-border"
              style={{
                gridTemplateColumns: `repeat(${event.location ? 3 : 2}, 1fr)`,
              }}
            >
              <MetaCell
                label="Date"
                value={shortDate}
                sub={shortYear}
              />
              <MetaCell
                label="Time"
                value={formatTime(startDate)}
                sub={endDate ? `Until ${formatTime(endDate)}` : null}
              />
              {event.location && (
                <MetaCell
                  label="Where"
                  value={event.location}
                  sub={null}
                />
              )}
            </div>

            {/* Description */}
            {event.description && (
              <div className="mt-8">
                {/* Eyebrow */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-px w-6 bg-brand-accent" />
                  <span className="font-sans text-[11px] font-bold uppercase tracking-[2px] text-brand-accent">
                    About this event
                  </span>
                </div>
                <p
                  className="font-serif text-[22px] leading-[1.5] text-foreground font-normal tracking-tight max-w-[620px]"
                >
                  {event.description}
                </p>
              </div>
            )}
          </div>

          {/* ═══════════════════════════════════════════════
              RIGHT COLUMN — RSVP card + attendees + map
              (sticky on desktop)
          ═══════════════════════════════════════════════ */}
          <div className="flex flex-col gap-4 md:sticky md:top-6">

            {/* ── RSVP Hero Card ── */}
            {event.is_rsvp_enabled && isMember && user && (
              <div
                className="rounded-[18px] p-6 relative overflow-hidden"
                style={{
                  background: "#2F6BA8",
                  boxShadow: "0 14px 40px rgba(47,107,168,0.2)",
                }}
              >
                {/* Subtle linen texture overlay */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    opacity: 0.1,
                    backgroundImage:
                      "repeating-linear-gradient(0deg, rgba(255,255,255,0.4) 0px, rgba(255,255,255,0.4) 1px, transparent 1px, transparent 4px)",
                  }}
                />

                <div className="relative text-white">
                  <EventRsvpPanel
                    eventId={event.id}
                    userId={user.id}
                    initialStatus={userRsvp?.status ?? null}
                  />

                  {/* Calendar actions below RSVP */}
                  <div
                    className="flex flex-wrap gap-2 mt-4 pt-4"
                    style={{ borderTop: "1px solid rgba(255,255,255,0.16)" }}
                  >
                    <AddToCalendarButton
                      instance={`event-detail-${event.id}`}
                      eventTitle={event.title}
                      startTime={displayStartTime}
                      endTime={displayEndTime}
                      location={event.location}
                      description={event.description}
                    />
                    <SubscribeToEventButton
                      eventId={event.id}
                      subscriptionToken={subscriptionToken}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Calendar actions for non-RSVP or logged-out state */}
            {!(event.is_rsvp_enabled && isMember && user) && (
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4">
                <AddToCalendarButton
                  instance={`event-detail-${event.id}`}
                  eventTitle={event.title}
                  startTime={displayStartTime}
                  endTime={displayEndTime}
                  location={event.location}
                  description={event.description}
                />
                <SubscribeToEventButton
                  eventId={event.id}
                  subscriptionToken={subscriptionToken}
                />
              </div>
            )}

            {/* ── Who's coming card ── */}
            {event.is_rsvp_enabled && attendees.length > 0 && (
              <div className="rounded-[18px] border border-border bg-card p-6">
                <AttendeeStrip attendees={attendees} />
              </div>
            )}

            {/* ── Map card ── */}
            {event.location && (
              <div className="rounded-[18px] border border-border bg-card overflow-hidden">
                {/* Map area */}
                <div className="relative" style={{ aspectRatio: "4/3" }}>
                  {googleMapsApiKey ? (
                    <iframe
                      title={`Map of ${event.location}`}
                      src={`https://www.google.com/maps/embed/v1/place?key=${googleMapsApiKey}&q=${encodeURIComponent(event.location)}`}
                      className="absolute inset-0 w-full h-full border-0"
                      loading="lazy"
                      allowFullScreen
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  ) : (
                    <div
                      className="absolute inset-0 flex items-center justify-center"
                      style={{
                        background:
                          "linear-gradient(135deg, #E2ECF7 0%, #FBFAF5 100%)",
                      }}
                    >
                      <div
                        className="bg-white rounded-[10px] px-4 py-2.5 text-center"
                        style={{ boxShadow: "0 6px 16px rgba(0,0,0,0.10)" }}
                      >
                        <div className="font-sans text-sm font-semibold text-foreground">
                          {event.location}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Address + directions */}
                <div className="flex items-center justify-between px-4 py-3.5">
                  <span className="font-sans text-sm text-muted-foreground truncate">
                    {event.location}
                  </span>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-sans text-sm font-semibold text-brand-primary hover:underline whitespace-nowrap ml-3"
                  >
                    Directions →
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
