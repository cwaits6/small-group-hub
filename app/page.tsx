import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EventCard } from "@/components/events/EventCard";
import { AnnouncementCard } from "@/components/announcements/AnnouncementCard";
import { createClient } from "@/lib/supabase/server";
import { siteConfig } from "@/lib/config";
import { Heart, Users, BookOpen } from "lucide-react";

export default async function HomePage() {
  const supabase = await createClient();

  const { data: events } = await supabase
    .from("events")
    .select("*")
    .eq("is_private", false)
    .gte("start_time", new Date().toISOString())
    .order("start_time", { ascending: true })
    .limit(3);

  const { data: announcements } = await supabase
    .from("announcements")
    .select("*")
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .limit(1);

  const { data: donationSetting } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "donation_url")
    .single();

  const donationUrl = donationSetting?.value;

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 py-20 md:py-28">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-amber-900 mb-6">
            Welcome to {siteConfig.name}
          </h1>
          <p className="text-xl md:text-2xl text-amber-800 mb-10 max-w-2xl mx-auto">
            {siteConfig.description}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="text-lg px-8 py-6 bg-amber-700 hover:bg-amber-800" nativeButton={false} render={<Link href="/join" />}>
              Join Our Group
            </Button>
            <Button variant="outline" size="lg" className="text-lg px-8 py-6 border-amber-700 text-amber-800 hover:bg-amber-50" nativeButton={false} render={<Link href="/events" />}>
              View Events
            </Button>
          </div>
        </div>
      </section>

      {/* About */}
      <section className="py-16 md:py-20">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <Card className="text-center p-6">
              <CardContent className="pt-6">
                <Users className="h-12 w-12 text-amber-700 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Community</h3>
                <p className="text-lg text-muted-foreground">
                  Connect with fellow believers in a warm, supportive environment.
                </p>
              </CardContent>
            </Card>
            <Card className="text-center p-6">
              <CardContent className="pt-6">
                <BookOpen className="h-12 w-12 text-amber-700 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Bible Study</h3>
                <p className="text-lg text-muted-foreground">
                  Grow in your faith through engaging lessons and discussions.
                </p>
              </CardContent>
            </Card>
            <Card className="text-center p-6">
              <CardContent className="pt-6">
                <Heart className="h-12 w-12 text-amber-700 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Encouragement</h3>
                <p className="text-lg text-muted-foreground">
                  Encourage one another daily, as Scripture calls us to do.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Upcoming Events */}
      {events && events.length > 0 && (
        <section className="py-16 bg-stone-50">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-10 text-amber-900">
              Upcoming Events
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {events.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
            <div className="text-center mt-8">
              <Button variant="outline" size="lg" className="text-lg" nativeButton={false} render={<Link href="/events" />}>
                View All Events
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Latest Announcement */}
      {announcements && announcements.length > 0 && (
        <section className="py-16">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="text-3xl font-bold text-center mb-10 text-amber-900">
              Latest Announcement
            </h2>
            <AnnouncementCard announcement={announcements[0]} />
          </div>
        </section>
      )}

      {/* Donation CTA */}
      {donationUrl && (
        <section className="py-16 bg-gradient-to-br from-amber-50 to-orange-50">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl font-bold mb-4 text-amber-900">
              Support Our Ministry
            </h2>
            <p className="text-xl text-amber-800 mb-8 max-w-xl mx-auto">
              Your generous contributions help us continue our mission.
            </p>
            <Button size="lg" className="text-lg px-10 py-6 bg-amber-700 hover:bg-amber-800" nativeButton={false} render={<a href={donationUrl} target="_blank" rel="noopener noreferrer" />}>
              <Heart className="mr-2 h-5 w-5" />
              Give Now
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
