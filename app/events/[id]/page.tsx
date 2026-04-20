import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { RsvpButton } from "@/components/events/RsvpButton";
import { AddToCalendarButton } from "@/components/events/AddToCalendarButton";
import { SubscribeToEventButton } from "@/components/events/SubscribeToEventButton";
import { AttendeeList } from "@/components/events/AttendeeList";
import { Button } from "@/components/ui/button";
import {
  CalendarDays,
  Clock,
  MapPin,
  ChevronLeft,
  Pencil,
} from "lucide-react";
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
    .select("title, is_private")
    .eq("id", id)
    .single();

  if (!event) {
    return { title: `Event | ${siteConfig.name}` };
  }

  // Don't leak private event titles to non-members
  if (event.is_private) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      const isMember = profile?.role === "member" || profile?.role === "content_editor" || profile?.role === "admin";
      if (isMember) {
        return { title: `${event.title} | ${siteConfig.name}` };
      }
    }
    return { title: `Event | ${siteConfig.name}` };
  }

  return { title: `${event.title} | ${siteConfig.name}` };
}

interface Attendee {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  status: string;
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  // Hide private events from non-members
  if (event.is_private && !isMember) notFound();

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
        status: r.status,
      };
    });
  }

  // Formatting helpers
  const startDate = new Date(event.start_time);
  const endDate = event.end_time ? new Date(event.end_time) : null;

  const fullDate = startDate.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const formatTime = (d: Date) =>
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  const calendarColor = event.calendar?.color ?? "#059669";

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      {/* Back link */}
      <Link
        href="/events"
        className="inline-flex items-center gap-1 text-sm text-brand-primary-light hover:text-brand-primary mb-6 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Calendar
      </Link>

      <div className="bg-white rounded-2xl border-2 border-emerald-100 overflow-hidden">
        {/* Top accent bar using calendar color */}
        <div className="h-2 w-full" style={{ backgroundColor: calendarColor }} />

        <div className="p-6 md:p-8">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex-1 min-w-0">
              {event.calendar && (
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold text-white mb-3"
                  style={{ backgroundColor: calendarColor }}
                >
                  {event.calendar.name}
                </span>
              )}
              <h1 className="text-2xl md:text-3xl font-bold text-slate-800 font-display leading-tight">
                {event.title}
              </h1>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-slate-600 hover:border-emerald-300 hover:text-brand-primary"
                  nativeButton={false}
                  render={<Link href={`/admin/events/${id}/edit`} />}
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </Button>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="space-y-3 mb-6">
            <div className="flex items-center gap-2 text-slate-600">
              <CalendarDays className="h-4 w-4 shrink-0 text-brand-primary-light" />
              <span>{fullDate}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <Clock className="h-4 w-4 shrink-0 text-brand-primary-light" />
              <span>
                {formatTime(startDate)}
                {endDate && <span className="text-slate-400"> – {formatTime(endDate)}</span>}
              </span>
            </div>
            {event.location && (
              <div className="flex items-center gap-2 text-slate-600">
                <MapPin className="h-4 w-4 shrink-0 text-brand-primary-light" />
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  {event.location}
                </a>
              </div>
            )}
          </div>

          {event.description && (
            <p className="text-base text-slate-600 leading-relaxed mb-6 whitespace-pre-wrap">
              {event.description}
            </p>
          )}

          {/* Actions */}
          <div className="mb-8 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-3">
            <AddToCalendarButton
              instance={`event-detail-${event.id}`}
              eventTitle={event.title}
              startTime={event.start_time}
              endTime={event.end_time}
              location={event.location}
              description={event.description}
            />
            <SubscribeToEventButton eventId={event.id} />
          </div>

          {/* RSVP */}
          {event.is_rsvp_enabled && isMember && user && (
            <div className="border-t border-slate-100 pt-6 mb-8">
              <h2 className="text-base font-semibold text-slate-700 mb-3">
                RSVP
              </h2>
              <RsvpButton
                eventId={event.id}
                userId={user.id}
                currentStatus={userRsvp?.status ?? null}
              />
            </div>
          )}

          {/* Attendee list */}
          {event.is_rsvp_enabled && attendees.length > 0 && (
            <div className="border-t border-slate-100 pt-6">
              <AttendeeList attendees={attendees} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
