import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { ArrowRight } from "lucide-react";
import { Christicon } from "@christicons/react";

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
                InCouragers
              </span>
            </div>

            <h1 className="font-serif text-4xl md:text-6xl font-medium text-foreground mb-10 leading-[1.1] tracking-tight">
              To be the <em className="text-brand-primary not-italic">body of Christ</em><br />
              through fellowship, discipleship<br />
              and the faithful study of the <em className="text-brand-primary not-italic">Word of God</em>.
            </h1>

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
        </div>
      </section>

      {/* ── Pillars ── */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-3">
              What We Believe
            </p>
            <h2 className="font-serif text-4xl font-medium text-foreground">
              Rooted in Scripture
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              {
                icon: <Christicon name="church 2" size={28} color="#fff" title="Church" />,
                title: "The Body of Christ",
                text: "A New Testament Church of the Lord Jesus Christ is the body of Christ, of which Jesus Christ is the head.",
                color: "var(--color-brand-primary)",
                bg: "var(--color-brand-warm)",
                border: "var(--color-brand-primary)",
              },
              {
                icon: <Christicon name="bible 1" size={28} color="#fff" title="Bible" />,
                title: "The Inspired Word",
                text: "The entire Bible is the Inspired Word of God, authored by the Holy Spirit and penned through God's chosen men.",
                color: "var(--color-brand-primary-light)",
                bg: "var(--color-brand-bg-muted)",
                border: "var(--color-brand-primary-light)",
              },
              {
                icon: <Christicon name="commandments" size={28} color="#fff" title="Commandments" />,
                title: "Our Final Authority",
                text: "Infallible and inerrant — the supreme and final authority for the Christian in all matters of faith and practice.",
                color: "var(--color-brand-accent)",
                bg: "var(--color-brand-bg-light)",
                border: "var(--color-brand-accent)",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl p-8 border-2 transition-all hover:-translate-y-1 hover:shadow-lg"
                style={{ background: item.bg, borderColor: `color-mix(in srgb, ${item.border} 25%, transparent)` }}
              >
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
                  style={{ background: item.color }}
                >
                  {item.icon}
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
            <Christicon name="heart" size={48} title="Heart" className="text-brand-accent mx-auto mb-5 block" />
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
              <Christicon name="heart" size={20} title="Heart" className="mr-2" />
              Give Now
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
