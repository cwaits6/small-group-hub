import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EventCard } from "@/components/events/EventCard";
import { AnnouncementCard } from "@/components/announcements/AnnouncementCard";
import { createClient } from "@/lib/supabase/server";
import { siteConfig } from "@/lib/config";
import { Heart, Users, BookOpen, ArrowRight, Sparkles } from "lucide-react";

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
      {/* ── Hero ── */}
      <section
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0d4f3c 0%, #0f5a45 50%, #0c4035 100%)" }}
      >
        {/* Floating orbs */}
        <div
          className="animate-float absolute top-12 right-[10%] w-64 h-64 rounded-full opacity-20 pointer-events-none"
          style={{ background: "radial-gradient(circle, #34d399, transparent)" }}
        />
        <div
          className="animate-float-slow absolute top-32 right-[30%] w-40 h-40 rounded-full opacity-15 pointer-events-none"
          style={{ background: "radial-gradient(circle, #f43f5e, transparent)" }}
        />
        <div
          className="animate-float-delayed absolute bottom-20 left-[8%] w-52 h-52 rounded-full opacity-15 pointer-events-none"
          style={{ background: "radial-gradient(circle, #f59e0b, transparent)" }}
        />
        <div
          className="animate-float absolute bottom-10 right-[5%] w-32 h-32 rounded-full opacity-20 pointer-events-none"
          style={{ background: "radial-gradient(circle, #06b6d4, transparent)" }}
        />

        {/* Grid texture overlay */}
        <div
          className="absolute inset-0 opacity-5 pointer-events-none"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        <div className="relative container mx-auto px-4 py-24 md:py-36">
          <div className="max-w-3xl mx-auto text-center">
            {/* Pill badge */}
            <div className="animate-fade-in inline-flex items-center gap-2 bg-white/10 border border-white/20 text-emerald-200 px-4 py-1.5 rounded-full text-base font-semibold mb-8 backdrop-blur-sm">
              <Sparkles className="h-4 w-4 text-amber-400" />
              First Redeemer Church
            </div>

            <h1 className="animate-fade-up font-display text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
              Welcome to<br />
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: "linear-gradient(135deg, #6ee7b7, #34d399, #a7f3d0)" }}
              >
                {siteConfig.name}
              </span>
            </h1>

            <p className="animate-fade-up-delay-1 text-xl md:text-2xl text-emerald-100 mb-10 max-w-xl mx-auto leading-relaxed">
              {siteConfig.description}
            </p>

            <div className="animate-fade-up-delay-2 flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                className="text-lg px-8 py-6 font-bold shadow-lg hover:shadow-xl transition-all"
                style={{ background: "#f43f5e" }}
                nativeButton={false}
                render={<Link href="/join" />}
              >
                Join Our Group
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="text-lg px-8 py-6 font-semibold border-2 border-white/40 text-white bg-white/10 hover:bg-white/20 hover:border-white/60 backdrop-blur-sm"
                nativeButton={false}
                render={<Link href="/events" />}
              >
                View Events
              </Button>
            </div>
          </div>
        </div>

        {/* Bottom wave */}
        <div className="relative -mb-1">
          <svg viewBox="0 0 1440 80" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M0 40C240 80 480 0 720 40C960 80 1200 0 1440 40V80H0V40Z"
              fill="oklch(0.985 0.004 150)"
            />
          </svg>
        </div>
      </section>

      {/* ── Pillars ── */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="font-display text-4xl font-bold text-[#0d4f3c] mb-3">
              What We&apos;re About
            </h2>
            <p className="text-lg text-slate-500 max-w-lg mx-auto">
              A place to connect, grow, and encourage one another every week.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              {
                icon: Users,
                title: "Community",
                text: "Connect with fellow believers in a warm, supportive environment that feels like family.",
                color: "#059669",
                bg: "#ecfdf5",
                border: "#6ee7b7",
              },
              {
                icon: BookOpen,
                title: "Bible Study",
                text: "Grow in your faith through engaging, in-depth lessons and open discussion.",
                color: "#0284c7",
                bg: "#f0f9ff",
                border: "#7dd3fc",
              },
              {
                icon: Heart,
                title: "Encouragement",
                text: "Encourage one another daily — it's not just our name, it's our calling.",
                color: "#e11d48",
                bg: "#fff1f2",
                border: "#fda4af",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl p-8 border-2 transition-all hover:-translate-y-1 hover:shadow-lg"
                style={{ background: item.bg, borderColor: item.border }}
              >
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
                  style={{ background: item.color }}
                >
                  <item.icon className="h-7 w-7 text-white" />
                </div>
                <h3 className="font-display text-2xl font-bold mb-3" style={{ color: item.color }}>
                  {item.title}
                </h3>
                <p className="text-lg text-slate-600 leading-relaxed">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Upcoming Events ── */}
      {events && events.length > 0 && (
        <section className="py-20" style={{ background: "#ecfdf5" }}>
          <div className="container mx-auto px-4">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-12">
              <div>
                <p className="text-emerald-600 font-bold text-base uppercase tracking-widest mb-2">
                  On the Calendar
                </p>
                <h2 className="font-display text-4xl font-bold text-[#0d4f3c]">
                  Upcoming Events
                </h2>
              </div>
              <Button
                variant="outline"
                size="lg"
                className="text-base font-semibold border-2 border-emerald-300 text-emerald-700 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all"
                nativeButton={false}
                render={<Link href="/events" />}
              >
                View All Events
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {events.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Latest Announcement ── */}
      {announcements && announcements.length > 0 && (
        <section className="py-20">
          <div className="container mx-auto px-4 max-w-3xl">
            <div className="text-center mb-10">
              <p className="text-rose-500 font-bold text-base uppercase tracking-widest mb-2">
                From the Group
              </p>
              <h2 className="font-display text-4xl font-bold text-[#0d4f3c]">
                Latest Announcement
              </h2>
            </div>
            <AnnouncementCard announcement={announcements[0]} />
          </div>
        </section>
      )}

      {/* ── Donation CTA ── */}
      {donationUrl && (
        <section
          className="py-20 relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, #0d4f3c 0%, #065f46 100%)" }}
        >
          <div
            className="absolute inset-0 opacity-10 pointer-events-none"
            style={{
              backgroundImage: "radial-gradient(circle at 20% 50%, #f59e0b 0%, transparent 50%), radial-gradient(circle at 80% 50%, #f43f5e 0%, transparent 50%)",
            }}
          />
          <div className="relative container mx-auto px-4 text-center">
            <Heart className="h-12 w-12 text-rose-400 mx-auto mb-5 fill-rose-400/30" />
            <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-4">
              Support Our Ministry
            </h2>
            <p className="text-xl text-emerald-200 mb-10 max-w-lg mx-auto">
              Your generosity helps us continue doing what we love — gathering, studying, and encouraging together.
            </p>
            <Button
              size="lg"
              className="text-lg px-10 py-6 font-bold shadow-xl hover:shadow-2xl transition-all"
              style={{ background: "#f43f5e" }}
              nativeButton={false}
              render={<a href={donationUrl} target="_blank" rel="noopener noreferrer" />}
            >
              <Heart className="mr-2 h-5 w-5 fill-white/40" />
              Give Now
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
