import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Cormorant_Garamond, Inter_Tight, JetBrains_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { AppShell } from "@/components/layout/AppShell";
import { SidebarProvider } from "@/components/layout/SidebarContext";
import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { siteConfig } from "@/lib/config";
import { getOrgBranding, resolveBranding, type OrgBranding } from "@/lib/branding";
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

export async function generateMetadata(): Promise<Metadata> {
  const b = await getOrgBranding();
  return {
    // No title.template: 25 pages already hardcode "| siteConfig.name" in
    // their static titles, and a template would double the suffix.
    title: b.display_name,
    description: siteConfig.description,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Skip the getUser() call entirely when there are no auth cookies.
  // This avoids noisy "Invalid Refresh Token" errors for unauthenticated visitors.
  const cookieStore = await cookies();
  // CSP allows inline scripts only with the per-request nonce
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const hasAuthCookie = cookieStore.getAll().some((c) => c.name.includes("auth-token"));

  let profile = null;
  let hasServingAccess = false;
  let branding: OrgBranding | null = null;
  if (hasAuthCookie) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Branding rides the existing profiles select as a PostgREST embed
      // (profiles_org_id_fkey) — zero added round trips on this path.
      const [{ data }, { data: groupData }] = await Promise.all([
        supabase.from("profiles").select("*, organizations(branding)").eq("id", user.id).single(),
        supabase.from("profile_groups").select("group_id").eq("profile_id", user.id),
      ]);
      const { organizations: org, ...profileRow } = data ?? {};
      profile = data ? profileRow : null;
      branding = resolveBranding(org?.branding);

      if (profile?.role === "admin") {
        hasServingAccess = true;
      } else if (groupData?.length) {
        const { count } = await supabase
          .from("serving_team_settings")
          .select("group_id", { count: "exact", head: true })
          .eq("enabled", true)
          .in("group_id", groupData.map((g) => g.group_id as string));
        hasServingAccess = (count ?? 0) > 0;
      }
    }
  }

  // Anon path: no existing fetch to ride, so this is one cache()-memoized
  // indexed PK lookup shared with generateMetadata.
  const b = branding ?? (await getOrgBranding());

  return (
    // suppressHydrationWarning: the head script sets data-textsize on <html>
    // before React hydrates, and browsers mask script nonces so the client
    // always reads them as "" — both are expected mismatches.
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        {/* Apply saved display preferences before first paint */}
        <script
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("pref-textsize");if(t==="large"||t==="larger")document.documentElement.dataset.textsize=t}catch(e){}`,
          }}
        />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              :root {
                --color-brand-primary: ${b.accent};
                --color-brand-primary-light: ${siteConfig.colors.primaryLight};
                --color-brand-accent: ${siteConfig.colors.accent};
                --color-brand-warm: ${siteConfig.colors.warm};
                --color-brand-bg-light: ${siteConfig.colors.backgroundLight};
                --color-brand-bg-muted: ${siteConfig.colors.backgroundMuted};
                --primary: ${b.accent};
                --ring: ${b.accent};
                --sidebar-primary: ${b.accent};
                --sidebar-ring: ${b.accent};
              }
            `,
          }}
        />
      </head>
      <body className={`${cormorant.variable} ${interTight.variable} ${jetbrainsMono.variable} antialiased min-h-screen flex flex-col`}>
        <SidebarProvider>
          <Header profile={profile} hasServingAccess={hasServingAccess} />
          <AppShell profile={profile} hasServingAccess={hasServingAccess}>{children}</AppShell>
        </SidebarProvider>
        <Footer />
        <Toaster />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
