import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Playfair_Display, Nunito } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { AppShell } from "@/components/layout/AppShell";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { siteConfig } from "@/lib/config";
import "./globals.css";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  display: "swap",
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
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
    <html lang="en">
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
      <body className={`${playfair.variable} ${nunito.variable} antialiased min-h-screen flex flex-col`}>
        <Header profile={profile} />
        <AppShell profile={profile}>{children}</AppShell>
        <Footer />
        <Toaster />
        <Analytics />
      </body>
    </html>
  );
}
