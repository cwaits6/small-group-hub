import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { EventCard } from "@/components/events/EventCard";
import { AnnouncementCard } from "@/components/announcements/AnnouncementCard";
import { RsvpButton } from "@/components/events/RsvpButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Heart } from "lucide-react";
import Link from "next/link";
import type { Rsvp } from "@/lib/types";

export const metadata = { title: "Dashboard | Incouragers" };

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

  if (!profile || profile.role === "pending") {
    return (
      <div className="container mx-auto px-4 py-20 max-w-lg text-center">
        <Card className="p-8">
          <CardContent className="pt-6">
            <h1 className="text-3xl font-bold text-amber-900 mb-4">Pending Approval</h1>
            <p className="text-lg text-muted-foreground">
              Your account is waiting for admin approval. You&apos;ll receive an
              email once your access has been granted.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Fetch upcoming events
  const { data: events } = await supabase
    .from("events")
    .select("*")
    .gte("start_time", new Date().toISOString())
    .order("start_time", { ascending: true })
    .limit(5);

  // Fetch user's RSVPs
  let userRsvps: Record<string, Rsvp> = {};
  const { data: rsvps } = await supabase
    .from("rsvps")
    .select("*")
    .eq("user_id", user.id);
  if (rsvps) {
    userRsvps = Object.fromEntries(rsvps.map((r) => [r.event_id, r]));
  }

  // Fetch latest announcements
  const { data: announcements } = await supabase
    .from("announcements")
    .select("*")
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .limit(3);

  // Fetch donation URL
  const { data: donationSetting } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "donation_url")
    .single();

  const donationUrl = donationSetting?.value;

  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-3xl md:text-4xl font-bold text-amber-900 mb-2">
        Welcome, {profile.full_name || "Friend"}!
      </h1>
      <p className="text-lg text-muted-foreground mb-10">
        Here&apos;s what&apos;s happening in our group.
      </p>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Events column */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-amber-900">Upcoming Events</h2>
            <Button variant="outline" nativeButton={false} render={<Link href="/events" />}>
              View All
            </Button>
          </div>
          {events && events.length > 0 ? (
            events.map((event) => (
              <EventCard key={event.id} event={event}>
                <RsvpButton
                  eventId={event.id}
                  userId={user.id}
                  currentStatus={userRsvps[event.id]?.status ?? null}
                />
              </EventCard>
            ))
          ) : (
            <p className="text-lg text-muted-foreground">No upcoming events.</p>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {donationUrl && (
            <Card className="bg-gradient-to-br from-amber-50 to-orange-50">
              <CardContent className="pt-6 text-center">
                <Heart className="h-10 w-10 text-amber-700 mx-auto mb-3" />
                <h3 className="text-xl font-semibold mb-2">Give</h3>
                <Button size="lg" className="w-full text-lg bg-amber-700 hover:bg-amber-800" nativeButton={false} render={<a href={donationUrl} target="_blank" rel="noopener noreferrer" />}>
                  Donate Now
                </Button>
              </CardContent>
            </Card>
          )}

          <div>
            <h2 className="text-2xl font-bold text-amber-900 mb-4">Announcements</h2>
            {announcements && announcements.length > 0 ? (
              <div className="space-y-4">
                {announcements.map((a) => (
                  <AnnouncementCard key={a.id} announcement={a} />
                ))}
              </div>
            ) : (
              <p className="text-lg text-muted-foreground">No announcements yet.</p>
            )}
            <Button variant="outline" className="w-full mt-4" nativeButton={false} render={<Link href="/announcements" />}>
              View All
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
