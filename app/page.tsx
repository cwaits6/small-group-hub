import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { siteConfig } from "@/lib/config";
import { Heart, Users, BookOpen, ArrowRight } from "lucide-react";

export default async function HomePage() {
  const supabase = await createClient();

  const { data: donationSetting } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "donation_url")
    .single();

  const donationUrl = donationSetting?.value;

  return (
    <div>
      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-background">
        {/* Subtle paper-grain texture overlay */}
        <div
          className="absolute inset-0 opacity-[0.035] pointer-events-none"
          style={{
            backgroundImage: "url(\"data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' seed='3'/%3E%3CfeColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.5 0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")",
          }}
        />

        <div className="relative container mx-auto px-4 py-20 md:py-32">
          <div className="max-w-2xl">
            {/* Eyebrow label */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-7 h-px bg-brand-accent" />
              <span className="text-brand-accent text-xs font-semibold tracking-[0.2em] uppercase">
                Welcome Home
              </span>
            </div>

            <h1 className="font-serif text-5xl md:text-7xl font-medium text-foreground mb-6 leading-[1.02] tracking-tight">
              A place to <em className="text-brand-primary not-italic">gather</em>,<br />
              grow, and be <em className="text-brand-primary not-italic">known</em>.
            </h1>

            <p className="text-xl text-[#3F506B] mb-10 max-w-xl leading-relaxed">
              {siteConfig.description} A Sunday class for every season of life — come as you are.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                size="lg"
                className="text-base px-8 py-6 font-semibold shadow-sm hover:shadow-md transition-all bg-brand-primary hover:bg-brand-primary/90 text-white"
                nativeButton={false}
                render={<Link href="/join" />}
              >
                Request to Join
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="text-base px-8 py-6 font-medium border-border text-foreground hover:bg-brand-bg-light"
                nativeButton={false}
                render={<Link href="/login" />}
              >
                Sign In
              </Button>
            </div>
          </div>

          {/* Decorative verse mark — top right */}
          <div className="hidden md:block absolute top-16 right-14 text-right max-w-[260px]">
            <div className="text-[2rem] text-brand-accent leading-none mb-2">&ldquo;</div>
            <p className="font-serif italic text-sm text-muted-foreground leading-relaxed">
              Let us consider how we may spur one another on toward love and good deeds.
            </p>
            <p className="text-xs font-sans uppercase tracking-[0.18em] text-muted-foreground mt-3">
              Hebrews 10:24
            </p>
          </div>
        </div>
      </section>

      {/* ── Pillars ── */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-3">
              What We&apos;re About
            </p>
            <h2 className="font-serif text-4xl font-medium text-foreground">
              {siteConfig.name}
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              {
                icon: Users,
                title: "Community",
                text: "Connect with fellow believers in a warm, supportive environment that feels like family.",
                color: "#2F6BA8",
                bg: "#E2ECF7",
                border: "#2F6BA8",
              },
              {
                icon: BookOpen,
                title: "Bible Study",
                text: "Grow in your faith through engaging, in-depth lessons and open discussion.",
                color: "#3F506B",
                bg: "#E5E0D4",
                border: "#3F506B",
              },
              {
                icon: Heart,
                title: "Encouragement",
                text: "Encourage one another daily — it's not just our name, it's our calling.",
                color: "#E8A93C",
                bg: "#FAEBC2",
                border: "#E8A93C",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl p-8 border-2 transition-all hover:-translate-y-1 hover:shadow-lg"
                style={{ background: item.bg, borderColor: item.border + "40" }}
              >
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
                  style={{ background: item.color }}
                >
                  <item.icon className="h-7 w-7 text-white" />
                </div>
                <h3 className="font-serif text-2xl font-medium mb-3" style={{ color: item.color }}>
                  {item.title}
                </h3>
                <p className="text-base text-[#3F506B] leading-relaxed">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Donation CTA ── */}
      {donationUrl && (
        <section className="py-20 relative overflow-hidden bg-brand-primary">
          <div className="relative container mx-auto px-4 text-center">
            <Heart className="h-12 w-12 text-brand-accent mx-auto mb-5 fill-brand-accent/30" />
            <h2 className="font-serif text-4xl md:text-5xl font-medium text-white mb-4">
              Support Our Ministry
            </h2>
            <p className="text-xl text-white/80 mb-10 max-w-lg mx-auto">
              Your generosity helps us continue doing what we love — gathering, studying, and encouraging together.
            </p>
            <Button
              size="lg"
              className="text-base px-10 py-6 font-bold shadow-xl hover:shadow-2xl transition-all bg-brand-accent hover:bg-brand-accent/90 text-foreground"
              nativeButton={false}
              render={<a href={donationUrl} target="_blank" rel="noopener noreferrer" />}
            >
              <Heart className="mr-2 h-5 w-5 fill-foreground/20" />
              Give Now
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
