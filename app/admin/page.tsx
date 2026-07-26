import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Calendar, Megaphone, Clock } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { siteConfig } from "@/lib/config";
import { expandUpcomingEvents } from "@/lib/recurrence";
import { displayName } from "@/lib/names";
import type { AccessRequest, Event, Profile } from "@/lib/types";

export const metadata = { title: `Admin | ${siteConfig.name}` };

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const minutes = Math.floor((Date.now() - then) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  const date = new Date(iso);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "America/New_York",
  });
}

function eventDateLabel(startTime: string): string {
  const d = new Date(startTime);
  const date = d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "America/New_York",
  });
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });
  return `${date} · ${time}`;
}

type RecentSignup = Pick<
  Profile,
  "id" | "first_name" | "last_name" | "preferred_name" | "role" | "created_at"
>;

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/dashboard");

  const nowDate = new Date();
  const nowISO = nowDate.toISOString();

  // Stats + panel rows — all independent reads, fired together.
  const [
    { count: pendingRequests, error: pendingCountError },
    { count: totalMembers, error: membersCountError },
    { count: upcomingEvents, error: eventsCountError },
    { count: publishedAnnouncements, error: announcementsCountError },
    { data: pendingRows, error: pendingError },
    { data: signupRows, error: signupError },
    { data: rawEvents, error: eventsError },
  ] = await Promise.all([
    supabase
      .from("access_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .in("role", ["member", "content_editor", "admin"]),
    supabase
      .from("events")
      .select("*", { count: "exact", head: true })
      .gte("start_time", nowISO),
    supabase
      .from("announcements")
      .select("*", { count: "exact", head: true })
      .eq("is_published", true),
    supabase
      .from("access_requests")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("profiles")
      .select("id, first_name, last_name, preferred_name, role, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
    // Recurring series are stored as a single anchor row and expanded at
    // render time, so also fetch still-active anchors with past start times.
    supabase
      .from("events")
      .select("*")
      .or(
        `start_time.gte.${nowISO},` +
        `and(recurrence_frequency.not.is.null,or(recurrence_until.is.null,recurrence_until.gte.${nowISO}))`
      )
      .order("start_time", { ascending: true })
      .limit(50),
  ]);

  if (pendingCountError) console.error("admin overview: pending requests count failed", pendingCountError);
  if (membersCountError) console.error("admin overview: total members count failed", membersCountError);
  if (eventsCountError) console.error("admin overview: upcoming events count failed", eventsCountError);
  if (announcementsCountError) console.error("admin overview: announcements count failed", announcementsCountError);
  if (pendingError) console.error("admin overview: pending requests query failed", pendingError);
  if (signupError) console.error("admin overview: recent signups query failed", signupError);
  if (eventsError) console.error("admin overview: upcoming events query failed", eventsError);

  const requests = (pendingRows ?? []) as AccessRequest[];
  const signups = (signupRows ?? []) as RecentSignup[];
  const nextEvents = expandUpcomingEvents((rawEvents ?? []) as Event[], nowDate).slice(0, 3);

  const rowBorder = (i: number) =>
    i > 0 ? { borderTop: "1px solid var(--color-border)" } : undefined;

  const stats = [
    { label: "Pending Requests", value: pendingRequests, icon: Clock, error: pendingCountError },
    { label: "Total Members", value: totalMembers, icon: Users, error: membersCountError },
    { label: "Upcoming Events", value: upcomingEvents, icon: Calendar, error: eventsCountError },
    {
      label: "Announcements",
      value: publishedAnnouncements,
      icon: Megaphone,
      error: announcementsCountError,
    },
  ];

  return (
    <PageContainer size="wide">
      <PageHeader title="Admin Dashboard" />

      {/* Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-base text-muted-foreground">{stat.label}</p>
                  <p className="text-3xl font-bold text-brand-primary">
                    {stat.error ? "—" : stat.value ?? 0}
                  </p>
                </div>
                <stat.icon className="h-8 w-8 text-brand-primary" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-10 lg:grid-cols-3 lg:gap-6 items-start">
        {/* Pending Requests */}
        <div>
          <div className="flex items-baseline justify-between mb-5">
            <h2 className="font-serif text-[30px] font-medium text-foreground tracking-tight">
              Pending Requests
            </h2>
            <Link
              href="/admin/members"
              className="font-sans text-base font-semibold text-brand-primary hover:underline"
            >
              View all →
            </Link>
          </div>
          <Card>
            <CardContent className="pt-6">
              {pendingError ? (
                <p className="text-base text-muted-foreground py-3">Couldn&apos;t load pending requests.</p>
              ) : requests.length > 0 ? (
                requests.map((request, i) => (
                  <div
                    key={request.id}
                    className="py-3 grid grid-cols-[1fr_auto] gap-4 items-baseline"
                    style={rowBorder(i)}
                  >
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-foreground truncate">
                        {request.name}
                      </p>
                      <p className="text-base text-muted-foreground truncate">{request.email}</p>
                    </div>
                    <p className="text-base text-muted-foreground whitespace-nowrap">
                      {timeAgo(request.created_at)}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-base text-muted-foreground py-3">No pending requests.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Signups */}
        <div>
          <div className="flex items-baseline justify-between mb-5">
            <h2 className="font-serif text-[30px] font-medium text-foreground tracking-tight">
              Recent Signups
            </h2>
            <Link
              href="/admin/members"
              className="font-sans text-base font-semibold text-brand-primary hover:underline"
            >
              View all →
            </Link>
          </div>
          <Card>
            <CardContent className="pt-6">
              {signupError ? (
                <p className="text-base text-muted-foreground py-3">Couldn&apos;t load recent signups.</p>
              ) : signups.length > 0 ? (
                signups.map((signup, i) => (
                  <div
                    key={signup.id}
                    className="py-3 grid grid-cols-[1fr_auto] gap-4 items-baseline"
                    style={rowBorder(i)}
                  >
                    <div className="min-w-0 flex items-baseline gap-2">
                      <p className="text-base font-semibold text-foreground truncate">
                        {displayName(signup)}
                      </p>
                      {signup.role === "pending" && (
                        <Badge variant="outline" className="text-sm shrink-0">
                          Pending
                        </Badge>
                      )}
                    </div>
                    <p className="text-base text-muted-foreground whitespace-nowrap">
                      {timeAgo(signup.created_at)}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-base text-muted-foreground py-3">No recent signups.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Upcoming Events */}
        <div>
          <div className="flex items-baseline justify-between mb-5">
            <h2 className="font-serif text-[30px] font-medium text-foreground tracking-tight">
              Upcoming Events
            </h2>
            <Link
              href="/admin/calendars"
              className="font-sans text-base font-semibold text-brand-primary hover:underline"
            >
              View all →
            </Link>
          </div>
          <Card>
            <CardContent className="pt-6">
              {eventsError ? (
                <p className="text-base text-muted-foreground py-3">Couldn&apos;t load upcoming events.</p>
              ) : nextEvents.length > 0 ? (
                nextEvents.map((event, i) => (
                  <div key={`${event.id}-${event.start_time}`} className="py-3" style={rowBorder(i)}>
                    <p className="text-base font-semibold text-foreground truncate">
                      {event.title}
                    </p>
                    <p className="text-base text-muted-foreground">
                      {eventDateLabel(event.start_time)}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-base text-muted-foreground py-3">No upcoming events.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
