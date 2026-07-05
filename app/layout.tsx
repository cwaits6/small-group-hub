import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Cormorant_Garamond, Inter_Tight, JetBrains_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { AppShell } from "@/components/layout/AppShell";
import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { siteConfig } from "@/lib/config";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const interTight = Inter_Tight({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: siteConfig.name,
  description: siteConfig.description,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Skip the getUser() call entirely when there are no auth cookies.
  // This avoids noisy "Invalid Refresh Token" errors for unauthenticated visitors.
  const cookieStore = await cookies();
  const headerStore = await headers();
  const nonce = headerStore.get("x-nonce") ?? "";
  const hasAuthCookie = cookieStore.getAll().some((c) => c.name.includes("auth-token"));

  let profile = null;
  if (hasAuthCookie) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      profile = data;
    }
  }

  return (
    <html lang="en" data-scroll-behavior="smooth">
      <head>
        <style
          dangerouslySetInnerHTML={{
            __html: `
              :root {
                --color-brand-primary: ${siteConfig.colors.primary};
                --color-brand-primary-light: ${siteConfig.colors.primaryLight};
                --color-brand-accent: ${siteConfig.colors.accent};
                --color-brand-warm: ${siteConfig.colors.warm};
                --color-brand-bg-light: ${siteConfig.colors.backgroundLight};
                --color-brand-bg-muted: ${siteConfig.colors.backgroundMuted};
              }
            `,
          }}
        />
      </head>
      <body className={`${cormorant.variable} ${interTight.variable} ${jetbrainsMono.variable} antialiased min-h-screen flex flex-col`}>
        <Header profile={profile} />
        <AppShell profile={profile}>{children}</AppShell>
        <Footer />
        <Toaster />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
